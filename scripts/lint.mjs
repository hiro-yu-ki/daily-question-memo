import { readFile } from 'node:fs/promises';import { execFileSync } from 'node:child_process';
const files=['src/worker.js','src/validation.js','src/ai.js','src/repository.js','src/auth.js','public/app.js','public/sw.js'];
for(const file of files){execFileSync(process.execPath,['--check',file],{stdio:'inherit'});const text=await readFile(file,'utf8');if(/console\.log\([^)]*(secret|password|token)/i.test(text))throw new Error(`${file}: possible credential logging`);}console.log(`Linted ${files.length} files`);
