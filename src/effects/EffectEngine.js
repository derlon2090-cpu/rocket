const definitions = {
  exposure:{name:'Exposure',min:-2,max:2,default:0,unit:' EV'},
  contrast:{name:'Contrast',min:0,max:2,default:1,unit:'×'},
  saturation:{name:'Saturation',min:0,max:2,default:1,unit:'×'},
  temperature:{name:'Temperature',min:-1,max:1,default:0,unit:''},
  tint:{name:'Tint',min:-1,max:1,default:0,unit:''},
  highlights:{name:'Highlights',min:-1,max:1,default:0,unit:''},
  shadows:{name:'Shadows',min:-1,max:1,default:0,unit:''},
  blur:{name:'Gaussian blur',min:0,max:20,default:0,unit:' px'},
  sharpen:{name:'Sharpen',min:0,max:2,default:0,unit:'×'},
  glow:{name:'Glow',min:0,max:1,default:0,unit:'%'},
  vignette:{name:'Vignette',min:0,max:1,default:0,unit:'%'},
  grain:{name:'Film grain',min:0,max:1,default:0,unit:'%'},
  zoom:{name:'Zoom',min:1,max:2,default:1,unit:'×'},
  opacity:{name:'Fade transition',min:0,max:1,default:1,unit:'% temporary'},
  shake:{name:'Camera shake',min:0,max:20,default:0,unit:' px'}
};

export function createEffect(type) {
  const definition=definitions[type];
  if(!definition) throw new Error(`Unknown effect: ${type}`);
  return {id:crypto.randomUUID(),type,enabled:true,value:definition.default,start:0,end:null,keyframes:[],version:1};
}

export function validateEffects(effects,duration) {
  if(!Array.isArray(effects)||effects.length>24) throw new Error('Invalid effects stack.');
  return effects.map(effect=>{
    const def=definitions[effect?.type];
    if(!def||typeof effect.id!=='string') throw new Error('Invalid effect in stack.');
    const value=Number(effect.value),start=Number(effect.start),end=effect.end==null?duration:Number(effect.end),keyframes=Array.isArray(effect.keyframes)?effect.keyframes:[];
    if(!Number.isFinite(value)||value<def.min||value>def.max||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration+.01||keyframes.length>1000||keyframes.some(k=>!Number.isFinite(Number(k.time))||!Number.isFinite(Number(k.value))||Number(k.time)<start||Number(k.time)>end||Number(k.value)<def.min||Number(k.value)>def.max)) throw new Error(`Invalid parameters for ${def.name}.`);
    return {id:effect.id,type:effect.type,enabled:effect.enabled===true,value,start,end,keyframes:keyframes.map(k=>({time:Number(k.time),value:Number(k.value)})).sort((a,b)=>a.time-b.time),version:1};
  });
}

export function effectStyles(effects,time) {
  const valueAt=(effect)=>{const points=[{time:effect.start,value:effect.value},...(effect.keyframes||[]),{time:effect.end,value:effect.keyframes?.at(-1)?.value??effect.value}].sort((a,b)=>a.time-b.time);let left=points[0],right=points.at(-1);for(let i=1;i<points.length;i++)if(time<=points[i].time){left=points[i-1];right=points[i];break;}if(right.time<=left.time)return left.value;const p=Math.max(0,Math.min(1,(time-left.time)/(right.time-left.time)));return left.value+(right.value-left.value)*p;};
  const active=effects.filter(effect=>effect.enabled&&time>=effect.start&&time<=effect.end).map(effect=>({...effect,value:valueAt(effect)}));
  const values=Object.fromEntries(Object.keys(definitions).map(type=>[type,active.filter(e=>e.type===type).reduce((sum,e)=>type==='contrast'||type==='saturation'||type==='zoom'||type==='opacity'?sum*e.value:sum+e.value,type==='contrast'||type==='saturation'||type==='zoom'||type==='opacity'?1:0)]));
  const brightness=Math.pow(2,values.exposure);
  const sepia=Math.min(1,Math.abs(values.temperature));
  const tintHue=values.tint*110+(values.temperature<0?210:25);
  const sharpenContrast=1+values.sharpen*.15;
  return {
    filter:`brightness(${brightness}) contrast(${(values.contrast||1)*sharpenContrast}) saturate(${values.saturation||1}) blur(${values.blur}px) sepia(${sepia}) hue-rotate(${tintHue}deg) brightness(${Math.max(.3,1+(values.highlights+values.shadows)*.15)}) drop-shadow(0 0 ${values.glow*18}px rgba(255,255,255,${values.glow*.55}))`,
    transform:`scale(${values.zoom||1}) translate(${values.shake?Math.sin(time*38)*values.shake:0}px,${values.shake?Math.cos(time*31)*values.shake:0}px)`,
    opacity:values.opacity??1,
    overlays:{vignette:Math.min(1,values.vignette),grain:Math.min(1,values.grain),glow:Math.min(1,values.glow)}
  };
}

export const effectDefinitions=definitions;
