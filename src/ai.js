import { validateStructuredIdea, ValidationError } from './validation.js';

export function parseAIOutput(output) {
  if (typeof output !== 'string') throw new ValidationError('AI output must be text');
  const cleaned = output.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { throw new ValidationError('AI returned invalid JSON'); }
  return validateStructuredIdea(parsed);
}

export class MockAIProvider {
  async structure(rawText) {
    if (rawText.includes('[[MOCK_TIMEOUT]]')) throw new Error('AI timeout');
    if (rawText.includes('[[MOCK_ERROR]]')) throw new Error('AI provider error');
    if (rawText.includes('[[MOCK_INVALID]]')) return parseAIOutput('{bad json');
    const compact = rawText.replace(/\s+/g, ' ').trim();
    const first = compact.split(/[。！？!?\n]/)[0].slice(0, 80) || '取り込んだ会話';
    return validateStructuredIdea({ title: first, original_question: first, summary: compact.slice(0, 1000), conclusion: '会話原文を確認し、必要に応じて結論を追記してください。', unresolved_items: [], next_actions: ['内容を見直す'], ai_suggestions: ['カテゴリと重要度を確認する'], kind: 'idea', category: '未分類', tags: ['import'], importance: 'medium', source_excerpt: compact.slice(0, 500) });
  }
}

export class OpenAIProvider {
  constructor({ apiKey, model = 'gpt-5.6-luna', fetcher = fetch, timeoutMs = 20_000 }) {
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    this.apiKey = apiKey; this.model = model; this.fetcher = fetcher; this.timeoutMs = timeoutMs;
  }
  async structure(rawText) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher('https://api.openai.com/v1/responses', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, reasoning: { effort: 'low' }, max_output_tokens: 3000, input: [{ role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] }, { role: 'user', content: [{ type: 'input_text', text: rawText }] }], text: { format: { type: 'json_schema', name: 'structured_idea', strict: true, schema: IDEA_JSON_SCHEMA } } }) });
      if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
      const data = await response.json();
      const output = data.output_text ?? data.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text;
      return parseAIOutput(output);
    } catch (error) { if (error?.name === 'AbortError') throw new Error('AI timeout'); throw error; }
    finally { clearTimeout(timer); }
  }
}

const STRING_LIST = { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 500 } };
const IDEA_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title','original_question','summary','conclusion','unresolved_items','next_actions','ai_suggestions','kind','category','tags','importance','source_excerpt'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 120 },
    original_question: { type: 'string', minLength: 1, maxLength: 20000 },
    summary: { type: 'string', minLength: 1, maxLength: 20000 },
    conclusion: { type: 'string', minLength: 1, maxLength: 20000 },
    unresolved_items: STRING_LIST,
    next_actions: STRING_LIST,
    ai_suggestions: STRING_LIST,
    kind: { type: 'string', enum: ['idea','question','problem','decision','plan','reference','other'] },
    category: { type: 'string', minLength: 1, maxLength: 60 },
    tags: { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 30 } },
    importance: { type: 'string', enum: ['low','medium','high'] },
    source_excerpt: { type: 'string', maxLength: 4000 }
  }
};

const SYSTEM_PROMPT = `会話を次のキーだけを持つJSONへ整理してください: title, original_question, summary, conclusion, unresolved_items, next_actions, ai_suggestions, kind, category, tags, importance, source_excerpt。kindはidea/question/problem/decision/plan/reference/other、importanceはlow/medium/high。配列は各5件以下。事実を捏造しないでください。`;
export function createAIProvider(env) { return env.AI_PROVIDER === 'openai' ? new OpenAIProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }) : new MockAIProvider(); }
