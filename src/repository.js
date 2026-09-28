function decodeIdea(row) { if (!row) return null; return { ...row, unresolved_items: JSON.parse(row.unresolved_items || '[]'), next_actions: JSON.parse(row.next_actions || '[]'), ai_suggestions: JSON.parse(row.ai_suggestions || '[]'), tags: typeof row.tags === 'string' ? row.tags.split('\u001f').filter(Boolean) : (row.tags || []) }; }

export class D1Repository {
  constructor(db) { this.db = db; }
  async findRecentCapture(hash, since) { return this.db.prepare('SELECT * FROM captures WHERE content_hash=? AND created_at>=? ORDER BY created_at DESC LIMIT 1').bind(hash, since).first(); }
  async createCapture(c) { await this.db.prepare('INSERT INTO captures(id,source_type,raw_text,content_hash,processing_status,processing_error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(c.id,c.source_type,c.raw_text,c.content_hash,c.processing_status,null,c.created_at,c.updated_at).run(); return c; }
  async getCapture(id) { return this.db.prepare('SELECT * FROM captures WHERE id=?').bind(id).first(); }
  async listCaptures(limit=50) { const r=await this.db.prepare('SELECT * FROM captures ORDER BY created_at DESC LIMIT ?').bind(limit).all();return r.results; }
  async updateCapture(id, status, error, updatedAt) { await this.db.prepare('UPDATE captures SET processing_status=?,processing_error=?,updated_at=? WHERE id=?').bind(status,error,updatedAt,id).run(); return this.getCapture(id); }
  async createIdea(i) {
    const s = [this.db.prepare('INSERT INTO ideas(id,capture_id,title,original_question,summary,conclusion,unresolved_items,next_actions,ai_suggestions,kind,category,importance,source_type,source_excerpt,content_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(i.id,i.capture_id,i.title,i.original_question,i.summary,i.conclusion,JSON.stringify(i.unresolved_items),JSON.stringify(i.next_actions),JSON.stringify(i.ai_suggestions),i.kind,i.category,i.importance,i.source_type,i.source_excerpt,i.content_hash,i.created_at,i.updated_at)];
    for (const tag of i.tags) { const tagId=await hashText(`tag:${tag}`); s.push(this.db.prepare('INSERT OR IGNORE INTO tags(id,name) VALUES(?,?)').bind(tagId,tag),this.db.prepare('INSERT OR IGNORE INTO idea_tags(idea_id,tag_id) VALUES(?,?)').bind(i.id,tagId)); }
    await this.db.batch(s); return i;
  }
  async findRecentIdea(hash, since) { const r=await this.db.prepare('SELECT id FROM ideas WHERE content_hash=? AND created_at>=? ORDER BY created_at DESC LIMIT 1').bind(hash,since).first(); return r?this.getIdea(r.id):null; }
  async listIdeas(limit=50) { const r=await this.db.prepare("SELECT i.*, GROUP_CONCAT(t.name, char(31)) tags FROM ideas i LEFT JOIN idea_tags it ON it.idea_id=i.id LEFT JOIN tags t ON t.id=it.tag_id GROUP BY i.id ORDER BY i.created_at DESC LIMIT ?").bind(limit).all(); return r.results.map(decodeIdea); }
  async getIdea(id) { return decodeIdea(await this.db.prepare("SELECT i.*, GROUP_CONCAT(t.name, char(31)) tags FROM ideas i LEFT JOIN idea_tags it ON it.idea_id=i.id LEFT JOIN tags t ON t.id=it.tag_id WHERE i.id=? GROUP BY i.id").bind(id).first()); }
}

export class MemoryRepository {
  constructor() { this.captures=new Map(); this.ideas=new Map(); }
  async findRecentCapture(hash,since){return [...this.captures.values()].filter(x=>x.content_hash===hash&&x.created_at>=since).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]||null;}
  async createCapture(c){this.captures.set(c.id,{...c,processing_error:null});return this.getCapture(c.id);}
  async getCapture(id){const x=this.captures.get(id);return x?structuredClone(x):null;}
  async listCaptures(limit=50){return [...this.captures.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,limit).map(x=>structuredClone(x));}
  async updateCapture(id,status,error,updated_at){const x=this.captures.get(id);if(!x)return null;Object.assign(x,{processing_status:status,processing_error:error,updated_at});return this.getCapture(id);}
  async createIdea(i){this.ideas.set(i.id,structuredClone(i));return this.getIdea(i.id);}
  async findRecentIdea(hash,since){return [...this.ideas.values()].find(x=>x.content_hash===hash&&x.created_at>=since)||null;}
  async listIdeas(limit=50){return [...this.ideas.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,limit).map(x=>structuredClone(x));}
  async getIdea(id){const x=this.ideas.get(id);return x?structuredClone(x):null;}
}

export async function hashText(value) { const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
