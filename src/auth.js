const encoder = new TextEncoder();
const attempts = new Map();
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
async function hmac(value,secret) { const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']); return base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))); }
async function safeEqual(a,b) { if(typeof a!=='string'||typeof b!=='string')return false;const [left,right]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(a)),crypto.subtle.digest('SHA-256',encoder.encode(b))]);if(typeof crypto.subtle.timingSafeEqual==='function')return crypto.subtle.timingSafeEqual(left,right);const x=new Uint8Array(left),y=new Uint8Array(right);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0; }
export function loginAllowed(ip,now=Date.now()){const recent=(attempts.get(ip)||[]).filter(t=>now-t<60_000);attempts.set(ip,recent);return recent.length<5;}
export function recordLoginFailure(ip,now=Date.now()){attempts.set(ip,[...(attempts.get(ip)||[]).filter(t=>now-t<60_000),now]);}
export function clearLoginFailures(ip){attempts.delete(ip);}
export async function createSession(secret){const payload=base64url(encoder.encode(JSON.stringify({exp:Date.now()+7*86400_000,csrf:crypto.randomUUID()})));return `${payload}.${await hmac(payload,secret)}`;}
export async function verifySession(request,secret){const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('memo_session='))?.slice(13);if(!token||!secret)return null;const [payload,sig]=token.split('.');if(!payload||!(await safeEqual(sig||'',await hmac(payload,secret))))return null;try{const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));return data.exp>Date.now()?data:null;}catch{return null;}}
export async function checkSecret(actual,expected){return Boolean(expected)&&safeEqual(actual||'',expected);}
