const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

async function request(path, options = {}, timeout = 5000) {
  try {
    const response = await fetch(`${OLLAMA_URL}${path}`, { ...options, signal: AbortSignal.timeout(timeout===180000?(Number(process.env.OLLAMA_TIMEOUT_MS)||600000):timeout) });
    if (!response.ok) throw new Error(`Ollama أعاد HTTP ${response.status}.`);
    return response.json();
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بـ Ollama. تحقق من تشغيله أو خفّض حجم التحليل.');
    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) throw new Error('Ollama غير متاح محليًا. شغّله وثبّت نموذجًا محليًا مثل qwen3:8b.');
    throw error;
  }
}

export async function ollamaStatus() {
  try {
    const [tags, version] = await Promise.all([request('/api/tags'), request('/api/version')]);
    const models = (tags.models || []).map(model => model.name);
    const configured = process.env.OLLAMA_MODEL || 'qwen3:8b';
    const modelInfo=(tags.models||[]).find(model=>model.name===configured||model.name.startsWith(`${configured}:`));
    const visionModel=process.env.OLLAMA_VISION_MODEL||'';
    return { available: true, version: version.version, models, model: configured, modelBytes:Number(modelInfo?.size)||null, modelAvailable: models.some(name => name === configured || name.startsWith(`${configured}:`)), visionModel, visionAvailable:Boolean(visionModel&&models.some(name=>name===visionModel||name.startsWith(`${visionModel}:`))), local: true };
  } catch (error) {
    return { available: false, models: [], model: process.env.OLLAMA_MODEL || 'qwen3:8b', modelAvailable: false, local: true, error: error.message };
  }
}

function validWordList(words, duration) {
  return (Array.isArray(words) ? words : []).map(w => ({word:String(w.word || '').trim().slice(0,100),start:Number(w.start),end:Number(w.end)}))
    .filter(w => w.word && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end > w.start && w.start < duration && w.end <= duration + .1)
    .sort((a,b)=>a.start-b.start);
}

export function alignClipToUtterances(start,end,words,utterances,duration){
  const validWords=validWordList(words,duration);
  if(!validWords.length)return null;
  const first=validWords.find(w=>w.end>=start&&w.start<=start)||validWords.find(w=>w.start>=start);
  const last=[...validWords].reverse().find(w=>w.start<=end&&w.end>=end)||[...validWords].reverse().find(w=>w.end<=end);
  if(!first||!last)return null;
  start=Math.max(0,first.start);end=Math.min(duration,last.end);
  const validUtterances=(Array.isArray(utterances)?utterances:[]).map(u=>({start:Number(u.start),end:Number(u.end)})).filter(u=>Number.isFinite(u.start)&&Number.isFinite(u.end)&&u.start>=0&&u.end>u.start&&u.end<=duration+.1).sort((a,b)=>a.start-b.start);
  const startSentence=validUtterances.find(u=>start>u.start+.06&&start<u.end-.06);
  const endSentence=validUtterances.find(u=>end>u.start+.06&&end<u.end-.06);
  if(startSentence)start=Math.max(0,startSentence.start);
  if(endSentence)end=Math.min(duration,endSentence.end);
  const snappedFirst=validWords.find(w=>w.start>=start-.015);
  const snappedLast=[...validWords].reverse().find(w=>w.end<=end+.015);
  if(!snappedFirst||!snappedLast)return null;
  start=Math.max(0,snappedFirst.start);end=Math.min(duration,snappedLast.end);
  return end>start?{start,end}:null;
}

async function inferJson(status, prompt) {
  const data = await request('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    model: status.model, stream: false, think: false, format: 'json', keep_alive: 0, options: { temperature: 0.15, num_ctx: Number(process.env.OLLAMA_NUM_CTX)||2048, num_predict: 768 },
    messages: [{ role: 'system', content: 'أنت محرر فيديو. حلل النص فقط، ولا تختلق وقائع أو كلامًا. أعد JSON مطابقًا للمطلوب.' }, { role: 'user', content: prompt }]
  }) }, Number(process.env.OLLAMA_TIMEOUT_MS)||600000);
  const content=String(data.message?.content||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  try { return JSON.parse(content); } catch {
    const first=content.indexOf('{'),last=content.lastIndexOf('}');
    if(first>=0&&last>first){try{return JSON.parse(content.slice(first,last+1));}catch{}}
    throw new Error('استجابة Ollama ليست JSON مكتملًا. خفّض طول التحليل أو جرّب نموذجًا محليًا أصغر.');
  }
}

async function readyModel() {
  const status = await ollamaStatus();
  if (!status.available) throw new Error(status.error);
  if (!status.modelAvailable) throw new Error(`النموذج ${status.model} غير مثبت. نفّذ: ollama pull ${status.model}`);
  return status;
}

export async function describeSceneFrames(frames=[]) {
  const status=await ollamaStatus();
  if(!status.available||!status.visionAvailable)return {descriptions:[],available:false,model:status.visionModel||null};
  const descriptions=[];
  for(const frame of frames.slice(0,4)){
    try{
      const data=await request('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:status.visionModel,stream:false,format:'json',options:{temperature:0.1,num_ctx:Number(process.env.OLLAMA_NUM_CTX)||4096,num_predict:250},messages:[{role:'user',content:`صف بصريًا وباختصار العناصر الظاهرة في إطار من فيديو عند ${Number(frame.time).toFixed(1)} ثانية. لا تستنتج معلومات غير مرئية. أعد JSON: {"description":"وصف محايد قصير"}`,images:[frame.image]}]})},90000);
      const result=JSON.parse(data.message?.content||'{}');
      descriptions.push({time:Number(frame.time),description:String(result.description||'').slice(0,300)});
    }catch(error){return {descriptions,available:false,model:status.visionModel,error:error.message};}
  }
  return {descriptions,available:true,model:status.visionModel};
}

export async function suggestClips({ duration, words, candidates = [], scenes = [], utterances = [] }) {
  const status = await readyModel();
  const validWords = validWordList(words, duration);
  if (!validWords.length) throw new Error('لا توجد كلمات موقّتة صالحة للتحليل.');
  const utteranceContext = (Array.isArray(utterances) ? utterances : []).slice(0, 800).map(u => ({start:Number(u.start),end:Number(u.end),text:String(u.text||'').slice(0,600)}));
  const prompt = `اختر حتى خمسة مقاطع قصيرة ذات قيمة تحريرية من كلام عربي أو متعدد اللغات. قيّم اكتمال الفكرة والسياق والافتتاحية التعليمية/القصصية/السؤال والجواب/العاطفية أو الطريفة. أعد حدودًا داخل مدة المصدر وعلى الكلام المسموع، واجعل كل مقطع يحافظ على شرح مكتمل مع أقل قدر ممكن من الحشو. لا تستخدم ارتفاع الصوت وحده كدليل على الأهمية. confidence تقدير تحريري من 0 إلى 1 وليس توقعًا للانتشار. أعد JSON: {"clips":[{"start":0,"end":10,"title":"عنوان قصير","reason":"سبب مستند إلى الكلام","confidence":0.8,"category":"educational|story|hook|qa|emotional|funny","style":"اقتراح بصري قصير"}]}. المدة ${duration.toFixed(2)} ثانية. المقاطع المكتشفة بصريًا ${JSON.stringify(scenes).slice(0,5000)}. مؤشرات الطاقة للمساعدة فقط ${JSON.stringify(candidates).slice(0,2500)}. جمل Whisper ${JSON.stringify(utteranceContext).slice(0,9000)}. الكلمات الموقّتة ${JSON.stringify(validWords).slice(0,16000)}`;
  const parsed = await inferJson(status, prompt);
  const clips = (Array.isArray(parsed.clips) ? parsed.clips : []).map(item => {
    let start = Number(item.start), end = Number(item.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const aligned=alignClipToUtterances(start,end,validWords,utteranceContext,duration);
    if(!aligned)return null;
    ({start,end}=aligned);
    if (end - start < 2 || end - start > 180) return null;
    const transcript = validWords.filter(w => w.start >= start && w.end <= end).map(w=>w.word).join(' ');
    if (!transcript) return null;
    const confidence = Number(item.confidence), semantic=Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence)):0;
    const overlappingUtterances=utteranceContext.filter(u=>Number.isFinite(u.start)&&Number.isFinite(u.end)&&u.end>start&&u.start<end);
    const speechCompleteness=overlappingUtterances.length?overlappingUtterances.reduce((sum,u)=>sum+Math.max(0,Math.min(end,u.end)-Math.max(start,u.start))/(u.end-u.start),0)/overlappingUtterances.length:0.5;
    const audioRows=(Array.isArray(candidates)?candidates:[]).filter(x=>Number(x.end)>start&&Number(x.start)<end);
    const audioActivity=audioRows.length?audioRows.reduce((sum,x)=>sum+Math.max(0,Math.min(end,Number(x.end))-Math.max(start,Number(x.start)))*(Number(x.score)||0),0)/audioRows.reduce((sum,x)=>sum+Math.max(0,Math.min(end,Number(x.end))-Math.max(start,Number(x.start))),0):0.5;
    const visualRows=(Array.isArray(scenes)?scenes:[]).filter(x=>Number(x.end)>start&&Number(x.start)<end);
    const mean=(key,fallback)=>{const values=visualRows.map(x=>Number(x[key])).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:fallback;};
    const visualQuality=Math.max(0,Math.min(1,mean('visualQuality',0.5)));
    const motion=Math.max(0,Math.min(1,mean('motion',0.5)));
    const subjectVisibility=Math.max(0,Math.min(1,mean('faceVisibility',0.5)));
    const scoreFactors={semantic:semantic,speechCompleteness:Math.max(0,Math.min(1,speechCompleteness)),audioActivity:Math.max(0,Math.min(1,audioActivity)),visualQuality,motion,subjectVisibility};
    const score=semantic*.5+scoreFactors.speechCompleteness*.2+scoreFactors.audioActivity*.1+visualQuality*.1+motion*.05+subjectVisibility*.05;
    return {start,end,title:String(item.title||'لحظة مقترحة').slice(0,100),reason:String(item.reason||'').slice(0,300),category:String(item.category||'').slice(0,30),confidence:semantic,score:Number(score.toFixed(3)),scoreFactors,transcript,style:String(item.style||'').slice(0,120),source:'ollama',approved:false};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
  const unique=[];
  for(const clip of clips) if(unique.every(item=>clip.start>=item.end||clip.end<=item.start)) unique.push(clip);
  return {clips:unique.slice(0,5),model:status.model,local:true};
}

export async function suggestEdits({ words, duration }) {
  const status = await readyModel();
  const safeWords = validWordList(words,duration);
  if (!safeWords.length) throw new Error('أنشئ التفريغ المحلي أولًا للحصول على اقتراحات تحرير مرتبطة بالكلام.');
  const parsed = await inferJson(status, `اقترح حتى 5 قرارات تحريرية اختيارية من قائمة آمنة: highlight, subtle_zoom, vertical_crop, cinematic_color, transition. لا تنشئ مرشحات أو إعدادات برمجية. اربط كل اقتراح بعبارة فعلية في التفريغ وحدد توقيتها. أعد JSON: {"recommendations":[{"type":"highlight","start":0,"end":2,"phrase":"عبارة حرفية","reason":"سبب مختصر","value":1}]}. المدة ${duration}. الكلمات: ${JSON.stringify(safeWords).slice(0,16000)}`);
  const allowed = new Set(['highlight','subtle_zoom','vertical_crop','cinematic_color','transition']);
  const recommendations = (Array.isArray(parsed.recommendations)?parsed.recommendations:[]).map(x=>{
    const start=Number(x.start),end=Number(x.end), phrase=String(x.phrase||'').slice(0,100);
    if(!allowed.has(x.type)||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration||!phrase||!safeWords.some(w=>w.start<end&&w.end>start))return null;
    return {id:crypto.randomUUID(),type:x.type,start,end,phrase,reason:String(x.reason||'').slice(0,250),value:Math.max(0.1,Math.min(2,Number(x.value)||1)),approved:false};
  }).filter(Boolean).slice(0,5);
  return {recommendations,model:status.model,local:true};
}
