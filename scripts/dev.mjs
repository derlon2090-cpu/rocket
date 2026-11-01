import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const children=[
  spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'--host','127.0.0.1'],{cwd:root,stdio:'inherit'}),
  spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,stdio:'inherit'}),
];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill();process.exitCode=code;}
for(const child of children){child.on('error',error=>{console.error(error);stop(1)});child.on('exit',(code,signal)=>{if(!stopping){console.error(`Development process ended (${signal||code}).`);stop(code||1);}});}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0));
