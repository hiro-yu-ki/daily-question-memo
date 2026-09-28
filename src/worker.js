import { parseJsonRequest,validateRawImport,validateStructuredIdea,ValidationError } from './validation.js';
import { createAIProvider } from './ai.js';
import { D1Repository,MemoryRepository,hashText } from './repository.js';
import { checkSecret,clearLoginFailures,createSession,loginAllowed,recordLoginFailure,verifySession } from './auth.js';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const problem=(message,status=400,details)=>json({error:{message,...(details?.length?{details}:{})}},status);
const recent=()=>new Date(Date.now()-600_000).toISOString();

async function processCapture(repo,ai,capture){
  await repo.updateCapture(capture.id,'processing',null,new Date().toISOString());
  try{const data=await ai.structure(capture.raw_text);const now=new Date().toISOString();const idea=await repo.createIdea({...data,id:crypto.randomUUID(),capture_id:capture.id,source_type:capture.source_type,content_hash:await hashText(JSON.stringify(data)),created_at:now,updated_at:now});await repo.updateCapture(capture.id,'ready',null,now);return idea;}
  catch(error){const message=(error?.message||'AI processing failed').slice(0,500);await repo.updateCapture(capture.id,'failed',message,new Date().toISOString());throw new Error(message);}
}

export function createApp(deps={}){return async function app(request,env={}){
  const url=new URL(request.url);const repo=deps.repo||(env.DB?new D1Repository(env.DB):new MemoryRepository());const ai=deps.ai||createAIProvider(env);
  try{
    if(url.pathname==='/health')return json({status:'ok'});
    if(url.pathname==='/api/v1/auth/login'&&request.method==='POST'){
      const ip=request.headers.get('cf-connecting-ip')||'local';if(env.LOGIN_RATE_LIMITER){const {success}=await env.LOGIN_RATE_LIMITER.limit({key:ip});if(!success)return problem('Too many login attempts',429);}else if(!loginAllowed(ip))return problem('Too many login attempts',429);
      const body=await parseJsonRequest(request);if(!(await checkSecret(body.password,env.WEB_PASSWORD))){recordLoginFailure(ip);return problem('Invalid credentials',401);}if(!env.SESSION_SECRET)return problem('Server authentication is not configured',503);clearLoginFailures(ip);
      const token=await createSession(env.SESSION_SECRET);const session=await verifySession(new Request(request.url,{headers:{cookie:`memo_session=${token}`}}),env.SESSION_SECRET);return json({ok:true,csrf_token:session.csrf},200,{'set-cookie':`memo_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`});
    }
    if(url.pathname==='/api/v1/ideas/from-gpt'&&request.method==='POST'){
      const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!(await checkSecret(bearer,env.GPT_ACTION_SECRET)))return problem('Unauthorized',401);
      const data=validateStructuredIdea(await parseJsonRequest(request));const hash=await hashText(JSON.stringify(data));const prior=await repo.findRecentIdea(hash,recent());if(prior)return json({id:prior.id,status:'ready',duplicate:true});const now=new Date().toISOString();const idea=await repo.createIdea({...data,id:crypto.randomUUID(),capture_id:null,source_type:'custom_gpt',content_hash:hash,created_at:now,updated_at:now});return json({id:idea.id,status:'ready',duplicate:false},201);
    }
    const session=await verifySession(request,env.SESSION_SECRET);if(!session)return problem('Unauthorized',401);
    if(url.pathname==='/api/v1/auth/session'&&request.method==='GET')return json({ok:true,csrf_token:session.csrf});
    if(!['GET','HEAD'].includes(request.method)&&request.headers.get('x-csrf-token')!==session.csrf)return problem('Invalid CSRF token',403);
    if(url.pathname==='/api/v1/auth/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':'memo_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
    if(url.pathname==='/api/v1/captures/import'&&request.method==='POST'){
      const {raw_text}=validateRawImport(await parseJsonRequest(request));const hash=await hashText(raw_text);const duplicate=await repo.findRecentCapture(hash,recent());if(duplicate)return json({capture:duplicate,duplicate:true});const now=new Date().toISOString();const capture=await repo.createCapture({id:crypto.randomUUID(),source_type:'chatgpt_import',raw_text,content_hash:hash,processing_status:'raw',created_at:now,updated_at:now});
      try{const idea=await processCapture(repo,ai,capture);return json({capture:await repo.getCapture(capture.id),idea,duplicate:false},201);}catch{return json({capture:await repo.getCapture(capture.id),duplicate:false},202);}
    }
    const retry=url.pathname.match(/^\/api\/v1\/captures\/([^/]+)\/process$/);if(retry&&request.method==='POST'){const capture=await repo.getCapture(retry[1]);if(!capture)return problem('Capture not found',404);if(capture.processing_status==='ready')return problem('Capture is already processed',409);try{return json({capture:await repo.getCapture(capture.id),idea:await processCapture(repo,ai,capture)});}catch{return json({capture:await repo.getCapture(capture.id)},202);}}
    if(url.pathname==='/api/v1/ideas'&&request.method==='GET')return json({ideas:await repo.listIdeas(100)});
    if(url.pathname==='/api/v1/captures'&&request.method==='GET')return json({captures:await repo.listCaptures(100)});
    const detail=url.pathname.match(/^\/api\/v1\/ideas\/([^/]+)$/);if(detail&&request.method==='GET'){const idea=await repo.getIdea(detail[1]);if(!idea)return problem('Idea not found',404);const capture=idea.capture_id?await repo.getCapture(idea.capture_id):null;return json({idea,raw_text:capture?.raw_text??null});}
    return problem('Not found',404);
  }catch(error){if(error instanceof ValidationError)return problem(error.message,400,error.details);console.error('request_failed',{path:url.pathname,error_type:error?.name||'Error'});return problem('Internal server error',500);}
};}

const app=createApp();
export default{async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path.startsWith('/api/')||path==='/health')return app(request,env,ctx);return env.ASSETS?.fetch(request)??new Response('Static assets unavailable',{status:404});}};
