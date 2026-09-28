export const LIMITS = Object.freeze({ payloadBytes: 1_000_000, rawText: 500_000, title: 120, body: 20_000, category: 60, excerpt: 4_000, list: 5, listItem: 500, tags: 5, tag: 30 });
export const KINDS = ['idea', 'question', 'problem', 'decision', 'plan', 'reference', 'other'];
export const IMPORTANCE = ['low', 'medium', 'high'];

export class ValidationError extends Error {
  constructor(message, details = []) { super(message); this.name = 'ValidationError'; this.details = details; }
}

function text(value, name, max, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string') throw new ValidationError(`${name} must be a string`);
  const clean = value.trim();
  if (!optional && !clean) throw new ValidationError(`${name} is required`);
  if (clean.length > max) throw new ValidationError(`${name} exceeds ${max} characters`);
  return clean;
}

function list(value, name) {
  if (!Array.isArray(value)) throw new ValidationError(`${name} must be an array`);
  if (value.length > LIMITS.list) throw new ValidationError(`${name} may contain at most ${LIMITS.list} items`);
  return value.map((item, i) => text(item, `${name}[${i}]`, LIMITS.listItem));
}

export function normalizeTags(value) {
  if (!Array.isArray(value)) throw new ValidationError('tags must be an array');
  const result = [];
  for (const input of value) {
    const tag = text(input, 'tag', LIMITS.tag).replace(/^[#＃]+/, '').replace(/\s+/g, ' ').toLowerCase();
    if (tag && !result.includes(tag)) result.push(tag);
  }
  if (result.length > LIMITS.tags) throw new ValidationError(`tags may contain at most ${LIMITS.tags} unique items`);
  return result;
}

export function validateStructuredIdea(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('idea must be an object');
  const allowed = new Set(['title','original_question','summary','conclusion','unresolved_items','next_actions','ai_suggestions','kind','category','tags','importance','source_excerpt']);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new ValidationError(`unknown fields: ${unknown.join(', ')}`);
  const kind = text(value.kind, 'kind', 20);
  const importance = text(value.importance, 'importance', 20);
  if (!KINDS.includes(kind)) throw new ValidationError(`kind must be one of: ${KINDS.join(', ')}`);
  if (!IMPORTANCE.includes(importance)) throw new ValidationError(`importance must be one of: ${IMPORTANCE.join(', ')}`);
  return {
    title: text(value.title, 'title', LIMITS.title),
    original_question: text(value.original_question, 'original_question', LIMITS.body),
    summary: text(value.summary, 'summary', LIMITS.body),
    conclusion: text(value.conclusion, 'conclusion', LIMITS.body),
    unresolved_items: list(value.unresolved_items, 'unresolved_items'),
    next_actions: list(value.next_actions, 'next_actions'),
    ai_suggestions: list(value.ai_suggestions, 'ai_suggestions'),
    kind,
    category: text(value.category, 'category', LIMITS.category),
    tags: normalizeTags(value.tags),
    importance,
    source_excerpt: text(value.source_excerpt, 'source_excerpt', LIMITS.excerpt, { optional: true })
  };
}

export function validateRawImport(value) {
  if (!value || typeof value !== 'object') throw new ValidationError('request body must be an object');
  return { raw_text: text(value.raw_text, 'raw_text', LIMITS.rawText) };
}

export async function parseJsonRequest(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > LIMITS.payloadBytes) throw new ValidationError('payload too large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > LIMITS.payloadBytes) throw new ValidationError('payload too large');
  try { return JSON.parse(raw); } catch { throw new ValidationError('invalid JSON'); }
}
