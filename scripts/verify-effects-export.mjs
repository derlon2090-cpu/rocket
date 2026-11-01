import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEffect} from '../src/effects/EffectEngine.js';

const require=createRequire(import.meta.url);
const ffprobe=require('ffprobe-static').path;
const ffmpeg=require('ffmpeg-static');
const execFileAsync=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.resolve(process.argv[2]||path.join(root,'final.mp4'));
const base=process.env.APP_URL||'http://127.0.0.1:8787';
if(!fs.existsSync(input))throw new Error(`Input video not found: ${input}`);
let serverLogs='';
let testServer=null;
if(!process.env.APP_URL){({httpServer:testServer}=await import('../server.mjs'));let ready=false;for(let i=0;i<60;i++){try{const health=await fetch(`${base}/api/health`);if(health.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}if(!ready)throw new Error('In-process API server did not start.');}
try{
const form=new FormData();form.append('file',new Blob([fs.readFileSync(input)],{type:'video/mp4'}),path.basename(input));
const upload=await fetch(`${base}/api/upload`,{method:'POST',body:form});
if(!upload.ok)throw new Error(`Upload failed: ${await upload.text()}`);
const {media}=await upload.json();
const effects=[{...createEffect('exposure'),value:.35,end:media.duration},{...createEffect('contrast'),value:1.15,end:media.duration},{...createEffect('saturation'),value:1.12,end:media.duration},{...createEffect('blur'),value:1.25,end:media.duration},{...createEffect('vignette'),value:.28,end:media.duration},{...createEffect('grain'),value:.12,end:media.duration}];
const response=await fetch(`${base}/api/export`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mediaId:media.id,start:0,end:Math.min(8,media.duration),aspect:'9:16',crop:50,caption:false,words:[],effects})});
if(!response.ok)throw new Error(`Export request failed: ${await response.text()}`);
const {job}=await response.json();let result;
for(let attempt=0;attempt<360;attempt++){
  await new Promise(resolve=>setTimeout(resolve,1000));
  let status;try{status=await fetch(`${base}/api/jobs/${job.id}`).then(r=>r.json());}catch(error){throw new Error(`Job status request failed: ${error.message}; API listening=${testServer?.listening??'external'}; worker=${job.id}. ${serverLogs}`);}
  if(status.status==='failed')throw new Error(`Export failed: ${status.error}`);
  if(status.status==='completed'){result=status.result;break;}
}
if(!result?.downloadUrl)throw new Error('Export timed out.');
const output=path.join(root,'data','exports',path.basename(decodeURIComponent(result.downloadUrl)));
const {stdout}=await execFileAsync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,codec_type','-of','json',output]);
const metadata=JSON.parse(stdout),videoStream=metadata.streams.find(stream=>stream.codec_type==='video');if(!metadata.streams.some(stream=>stream.codec_type==='video'))throw new Error('Export has no video stream.');if(videoStream.codec_name!=='h264'||videoStream.width!==1080||videoStream.height!==1920||videoStream.r_frame_rate!=='30/1')throw new Error(`Unexpected export format: ${JSON.stringify(metadata)}`);if(!metadata.streams.some(stream=>stream.codec_type==='audio'))throw new Error('Export did not preserve the source audio stream.');await execFileAsync(ffmpeg,['-v','error','-i',output,'-f','null','-']);const framesDir=await fs.promises.mkdtemp(path.join(root,'data','frames-'));try{await execFileAsync(ffmpeg,['-v','error','-i',output,'-vf',"select='eq(n,0)+eq(n,30)+eq(n,60)'",'-vsync','0','-frames:v','3',path.join(framesDir,'frame-%02d.png')]);const frames=await fs.promises.readdir(framesDir);if(frames.length!==3)throw new Error(`Expected 3 reference frames, extracted ${frames.length}.`);}finally{await fs.promises.rm(framesDir,{recursive:true,force:true});}
console.log(JSON.stringify({input,output,metadata,decodedFrames:3,fullDecode:'passed',effects:effects.map(effect=>effect.type)},null,2));
}finally{if(testServer)await new Promise(resolve=>testServer.close(resolve));}
