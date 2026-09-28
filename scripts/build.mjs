import { mkdir,rm,cp,readdir } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist/public',{recursive:true});await cp('src','dist/src',{recursive:true});await cp('migrations','dist/migrations',{recursive:true});
const files=await readdir('dist/public');if(!files.includes('index.html')||!files.includes('manifest.webmanifest'))throw new Error('PWA assets are incomplete');console.log('Build complete: dist/');
