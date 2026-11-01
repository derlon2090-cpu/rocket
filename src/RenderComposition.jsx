import React from 'react';
import {AbsoluteFill,Audio,Html5Video,Sequence,spring,useCurrentFrame,useVideoConfig} from 'remotion';
import {effectStyles} from './effects/EffectEngine.js';

function Caption({words,start=0,end,fps,style='cyan'}){
  const frame=useCurrentFrame();
  const seconds=start+frame/fps;
  const wordIndex=words.findIndex(word=>seconds>=word.start&&seconds<=word.end);
  const nextIndex=words.findIndex(word=>word.start>seconds);
  const active=wordIndex>=0?wordIndex:nextIndex>0?nextIndex-1:-1;
  const {width}=useVideoConfig();
  const enter=spring({frame:frame%8,fps,config:{damping:12,stiffness:220,mass:.4}});
  if(!words.length||seconds<start||seconds>end||active<0||seconds>words[words.length-1].end)return null;
  const visible=words.slice(Math.max(0,active-1),Math.min(words.length,active+2));
  const accent=style==='gold'?'#ffd166':style==='white'?'#fff':'#38deed';
  return <div dir="auto" style={{position:'absolute',left:'7%',right:'7%',bottom:'13%',textAlign:'center',fontFamily:'Thmanyah Sans,Thmanyah,Arial,Tahoma,sans-serif',fontWeight:900,fontSize:width<1200?'6.2cqw':'3.2cqw',lineHeight:1.65,filter:'drop-shadow(0 3px 10px #000b)',display:'flex',justifyContent:'center',flexWrap:'wrap',gap:'.22em'}}>{visible.map((word,index)=><span key={`${word.start}-${index}`} style={{color:word===words[active]?accent:'white',transform:word===words[active]?`translateY(${(1-enter)*8}px) scale(${.94+.06*enter})`:'none',textShadow:word===words[active]?`0 0 24px ${accent}a0`:'0 3px 9px #0008'}}>{word.word}</span>)}</div>;
}

function ClipPicture({clip,fit='cover'}){
  const {fps}=useVideoConfig();
  const frame=useCurrentFrame();
  const sourceTime=(clip.sourceStart||0)+frame/fps;
  const cropPoints=(clip.cropPath||[]).filter(point=>Number.isFinite(Number(point.time))&&Number.isFinite(Number(point.x))).sort((a,b)=>a.time-b.time);
  let cropX=Number(clip.crop?.x??50);
  if(cropPoints.length){let left=cropPoints[0],right=cropPoints.at(-1);for(let i=1;i<cropPoints.length;i++)if(sourceTime<=cropPoints[i].time){left=cropPoints[i-1];right=cropPoints[i];break;}const blend=right.time>left.time?Math.max(0,Math.min(1,(sourceTime-left.time)/(right.time-left.time))):0;cropX=Number(left.x)+(Number(right.x)-Number(left.x))*blend;}
  const fx=effectStyles(clip.effects||[],sourceTime);
  const sourceStart=Math.max(0,Number(clip.sourceStart)||0);
  const sourceEnd=Math.max(sourceStart+1/fps,Number(clip.sourceEnd)||Number(clip.end)||1);
  const duration=Math.max(1,Math.round((clip.end-clip.start)*fps));
  return <AbsoluteFill style={{overflow:'hidden',filter:fx.filter,transform:fx.transform||'none',opacity:fx.opacity??1}}>
    <Html5Video src={clip.src} trimBefore={Math.round(sourceStart*fps)} durationInFrames={duration} muted={clip.muted??false} style={{width:'100%',height:'100%',objectFit:fit,objectPosition:`${Math.max(0,Math.min(100,cropX))}% center`}}/>
    {fx.overlays.vignette>0&&<AbsoluteFill style={{background:`radial-gradient(ellipse at center,transparent 42%,rgba(0,0,0,${fx.overlays.vignette*.82}) 100%)`,pointerEvents:'none'}}/>}
    {fx.overlays.grain>0&&<svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:fx.overlays.grain*.24,pointerEvents:'none'}}><filter id={`grain-${clip.id}`}><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter={`url(#grain-${clip.id})`}/></svg>}
  </AbsoluteFill>;
}

function ProjectLayers({project,settings}){
  const {fps}=useVideoConfig();
  const videoLayers=project.tracks.filter(track=>track.type==='video').flatMap(track=>track.clips.map(clip=>{
    const sourceStart=Number(clip.sourceStart)||0;
    const sourceEnd=Number(clip.sourceEnd)||sourceStart+(clip.end-clip.start);
    const words=(settings.words||[]).filter(word=>word.end>sourceStart&&word.start<sourceEnd).map(word=>({word:word.word,start:Math.max(0,word.start-sourceStart),end:Math.max(0,Math.min(sourceEnd,word.end)-sourceStart)}));
    return <Sequence key={clip.id} from={Math.round(clip.start*fps)} durationInFrames={Math.max(1,Math.round((clip.end-clip.start)*fps))} layout="none"><ClipPicture clip={clip}/>{settings.caption&&<Caption words={words} start={0} end={clip.end-clip.start} fps={fps} style={settings.captionStyle}/>}</Sequence>;
  }));
  const audioLayers=project.tracks.filter(track=>track.type==='audio').flatMap(track=>track.clips.map(clip=><Sequence key={clip.id} from={Math.round(clip.start*fps)} durationInFrames={Math.max(1,Math.round((clip.end-clip.start)*fps))}><Audio src={clip.src} startFrom={Math.round((clip.sourceStart||0)*fps)} endAt={Math.round((clip.sourceEnd||clip.end)*fps)} volume={clip.volume??1}/></Sequence>));
  const textLayers=project.tracks.filter(track=>track.type==='text').flatMap(track=>track.clips.filter(clip=>clip.text).map(clip=><Sequence key={clip.id} from={Math.round(clip.start*fps)} durationInFrames={Math.max(1,Math.round((clip.end-clip.start)*fps))}><div dir={clip.direction||'auto'} style={{position:'absolute',left:clip.x||'8%',right:clip.right||'8%',bottom:clip.bottom||'13%',textAlign:clip.align||'center',fontFamily:clip.fontFamily||'Thmanyah Sans,Thmanyah,Arial,Tahoma,sans-serif',fontSize:clip.fontSize||54,fontWeight:clip.fontWeight||800,color:clip.color||'#fff',WebkitTextStroke:clip.outline||'1px #111',textShadow:clip.shadow||'0 3px 12px #000',background:clip.background||'transparent',padding:clip.padding||0}}>{clip.text}</div></Sequence>));
  return <>{videoLayers}{audioLayers}{textLayers}</>;
}

export function RenderComposition({media,start=0,end=10,aspect='9:16',words=[],caption=true,captionStyle='cyan',effects=[],project=null,settings={}}){
  const {fps}=useVideoConfig();
  const duration=Math.max(1,Math.round((project?.duration||end-start)*fps));
  if(project)return <AbsoluteFill style={{background:'#050c16',containerType:'inline-size'}}><ProjectLayers project={project} settings={{...settings,...(project.settings||{}),duration}}/></AbsoluteFill>;
  const localWords=words.map(word=>({...word,start:Math.max(0,word.start-start),end:Math.max(0,word.end-start)})).filter(word=>word.end>0&&word.start<end-start);
  return <AbsoluteFill style={{background:'#050c16',containerType:'inline-size'}}>
    <ClipPicture clip={{id:'legacy',src:media.src,sourceStart:start,sourceEnd:end,start:0,end:end-start,effects,crop:media.crop,cropPath:media.cropPath}}/>
    <AbsoluteFill style={{background:'linear-gradient(180deg,#0004 0%,transparent 22%,transparent 64%,#0007 100%)',pointerEvents:'none'}}/>
    {caption&&<Caption words={localWords} start={0} end={end-start} fps={fps} style={captionStyle}/>}
  </AbsoluteFill>;
}
