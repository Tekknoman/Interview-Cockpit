export const VERSION=1;
export function validateInterview(raw){
 if(!raw||typeof raw!== 'object'||Array.isArray(raw))throw Error('Das Interview muss ein JSON-Objekt sein.');
 const str=(v,n,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${n}: Text fehlt oder ist zu lang (max. ${max}).`);return v.trim();};
 const secs=(v,n)=>{if(!Number.isFinite(v)||v<10||v>7200)throw Error(`${n}: 10 bis 7200 Sekunden angeben.`);return Math.round(v);};
 if(raw.version!==1)throw Error('Unterstützte Interview-Version: 1.');
 if(!Array.isArray(raw.sections)||!raw.sections.length||raw.sections.length>30)throw Error('1–30 Themenbereiche angeben.');
 let ids=new Set(),qids=new Set(),count=0;
 const interview={version:1,title:str(raw.title,'Titel',200),guest:typeof raw.guest==='string'?raw.guest.slice(0,200):'',introSeconds:secs(raw.introSeconds??180,'Einstieg'),outroSeconds:secs(raw.outroSeconds??120,'Abschluss'),sections:raw.sections.map((s,i)=>{
  if(!s||typeof s!=='object')throw Error('Ungültiger Themenbereich.');
  const id=str(s.id,`Bereich ${i+1}: ID`,60);if(['__intro','__outro','__proto__','constructor','prototype'].includes(id))throw Error('Diese Bereichs-ID ist reserviert.');if(ids.has(id))throw Error('Bereichs-IDs müssen eindeutig sein.');ids.add(id);
  if(!Array.isArray(s.questions)||!s.questions.length||s.questions.length>100)throw Error('Jeder Bereich benötigt 1–100 Fragen.');
  return {id,title:str(s.title,'Bereichstitel',200),color:['mint','blue','amber','violet','rose'].includes(s.color)?s.color:'mint',questions:s.questions.map(q=>{
   if(!q||typeof q!=='object')throw Error('Ungültige Frage.'); const id=str(q.id,'Fragen-ID',80);if(['__intro','__outro','__proto__','constructor','prototype'].includes(id))throw Error('Diese Fragen-ID ist für Einstieg und Abschluss reserviert.');if(qids.has(id))throw Error('Fragen-IDs müssen eindeutig sein.');qids.add(id);count++;
   if(q.followUps!==undefined&&(!Array.isArray(q.followUps)||q.followUps.length>12))throw Error('Maximal 12 Nachfragen pro Frage.');
   return {id,text:str(q.text,'Frage'),seconds:secs(q.seconds,'Fragenzeit'),essential:q.essential===true,followUps:(q.followUps??[]).map(x=>str(x,'Nachfrage')),transition:typeof q.transition==='string'?q.transition.slice(0,2000):'',hint:typeof q.hint==='string'?q.hint.slice(0,1000):''};
  })};
 })};if(count>200)throw Error('Maximal 200 Fragen insgesamt.');return interview;
}
export function stepsFor(interview){let n=0;return [{id:'__intro',kind:'intro',sectionId:'__intro',sectionTitle:'Einstieg',color:'mint',seconds:interview.introSeconds,text:'**Ankommen. Einverständnis klären.** Aufnahme starten.',transition:'Vielen Dank, dass Sie sich Zeit für unser Gespräch nehmen.',hint:'Nutzung der Aufnahme und anonymisierte Beispiele klären. Danach alle Aufnahmegeräte starten und das Sync-Signal auslösen.',followUps:['Wie sollen wir Ihre aktuelle Funktion in unserer Präsentation korrekt nennen?']},...interview.sections.flatMap(s=>s.questions.map(q=>({...q,kind:'question',number:++n,sectionId:s.id,sectionTitle:s.title,color:s.color}))),{id:'__outro',kind:'outro',sectionId:'__outro',sectionTitle:'Abschluss',color:'mint',seconds:interview.outroSeconds,text:'**Danke sagen.** Ergänzungen und nächste Schritte klären.',transition:'Vielen Dank für die Einblicke. Bevor wir die Aufnahme beenden …',hint:'Gibt es eine Passage, die wir nicht verwenden sollen? Verwendung der Ausschnitte und weiteres Vorgehen bestätigen.',followUps:['Möchten Sie noch etwas ergänzen?']}];}
export function freshSession(interview,now=Date.now()) {return {version:1,id:globalThis.crypto?.randomUUID?.()??`s-${now}-${Math.random().toString(36).slice(2)}`,interview:validateInterview(interview),createdAt:now,status:'ready',current:0,runs:[],visits:[],events:[],syncs:[],notes:{},endedAt:null};}
export function activeMs(s,now=Date.now()){return s.runs.reduce((sum,r)=>sum+Math.max(0,(r.end??now)-r.start),0);}
export function currentVisit(s){return s.visits.at(-1);}
export function stepSpent(s,id,now=Date.now()){return s.visits.filter(v=>v.stepId===id).reduce((sum,v)=>sum+Math.max(0,(v.activeEnd??activeMs(s,now))-v.activeStart),0);}
export function event(s,type,now=Date.now(),extra={}){const e={id:globalThis.crypto?.randomUUID?.()??`${now}-${Math.random()}`,type,at:now,activeMs:activeMs(s,now),stepId:stepsFor(s.interview)[s.current]?.id,...extra};s.events.push(e);return e;}
export function start(s,now=Date.now()){if(s.status!=='ready')return;s.status='running';s.runs.push({start:now,end:null});s.visits.push({stepId:stepsFor(s.interview)[0].id,start:now,end:null,activeStart:0,activeEnd:null});event(s,'start',now);}
export function pause(s,now=Date.now()){if(s.status!=='running')return;s.runs.at(-1).end=now;s.status='paused';event(s,'pause',now);}
export function resume(s,now=Date.now()){if(s.status!=='paused')return;s.runs.push({start:now,end:null});s.status='running';event(s,'resume',now);}
export function move(s,index,now=Date.now()){const steps=stepsFor(s.interview);if(!['running','paused'].includes(s.status)||!Number.isInteger(index)||index<0||index>=steps.length||index===s.current)return;const v=currentVisit(s);v.end=now;v.activeEnd=activeMs(s,now);const from=s.current;s.current=index;s.visits.push({stepId:steps[index].id,start:now,end:null,activeStart:activeMs(s,now),activeEnd:null});event(s,'question_change',now,{from,to:index});}
export function finish(s,now=Date.now()){if(!['running','paused'].includes(s.status))return;const v=currentVisit(s);v.end=now;v.activeEnd=activeMs(s,now);if(s.status==='running')s.runs.at(-1).end=now;s.status='ended';s.endedAt=now;event(s,'finish',now);}
export function addSync(s,offsetSeconds=0,now=Date.now(),method='manual'){if(!['running','paused'].includes(s.status))return;const sync={id:`sync-${s.syncs.length+1}`,at:now,offsetSeconds,method};s.syncs.push(sync);event(s,'sync',now,{syncId:sync.id,offsetSeconds,method});return sync;}
export function recordingAt(s,at){const sync=s.syncs.filter(x=>x.at<=at).at(-1);return sync?{syncId:sync.id,seconds:sync.offsetSeconds+(at-sync.at)/1000}:null;}
export function fmt(ms){const sign=ms<0?'−':'';let sec=Math.floor(Math.abs(ms)/1000);return sign+`${Math.floor(sec/3600)?String(Math.floor(sec/3600)).padStart(2,'0')+':':''}${String(Math.floor(sec/60)%60).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;}
export function metrics(s,now=Date.now()){const steps=stepsFor(s.interview),step=steps[s.current],active=activeMs(s,now),plannedBefore=steps.slice(0,s.current).reduce((n,q)=>n+q.seconds*1000,0),spent=stepSpent(s,step.id,now),total=steps.reduce((n,q)=>n+q.seconds*1000,0);return {active,spent,total,remaining:total-active,stepRemaining:step.seconds*1000-spent,delta:active-plannedBefore-spent,plannedBefore};}
export function validateSession(raw){
 if(!raw||raw.version!==1||typeof raw.id!=='string'||!['ready','running','paused','ended'].includes(raw.status))throw Error('Ungültige Sitzung.');
 const s=structuredClone(raw);s.interview=validateInterview(raw.interview);const steps=stepsFor(s.interview),ids=new Set(steps.map(x=>x.id));
 const time=v=>Number.isFinite(v)&&v>=0;
 if(!Number.isInteger(s.current)||s.current<0||s.current>=steps.length||!time(s.createdAt))throw Error('Ungültige Sitzungsposition.');
 for(const key of ['runs','visits','events','syncs'])if(!Array.isArray(s[key])||s[key].length>20000)throw Error('Ungültiges Protokoll.');
 if(!s.notes||typeof s.notes!=='object'||Array.isArray(s.notes))throw Error('Ungültige Notizen.');
 for(const [id,v] of Object.entries(s.notes))if(!ids.has(id)||typeof v!=='string'||v.length>20000)throw Error('Ungültige Notiz.');
 let end=0;for(const [i,r] of s.runs.entries()){if(!time(r.start)||r.start<end||(r.end!==null&&(!time(r.end)||r.end<r.start))||(r.end===null&&(i!==s.runs.length-1||s.status!=='running')))throw Error('Ungültige Zeitintervalle.');end=r.end??r.start;}
 if(s.status==='running'&&s.runs.at(-1)?.end!==null)throw Error('Laufendes Zeitintervall fehlt.');
 for(const v of s.visits)if(!ids.has(v.stepId)||!time(v.start)||!time(v.activeStart)||(v.end!==null&&(!time(v.end)||v.end<v.start))||(v.activeEnd!==null&&(!time(v.activeEnd)||v.activeEnd<v.activeStart)))throw Error('Ungültiger Fragenverlauf.');
 if(['running','paused'].includes(s.status)&&(s.visits.at(-1)?.end!==null||s.visits.at(-1)?.stepId!==steps[s.current].id))throw Error('Aktuelle Frage fehlt.');
 for(const e of s.events)if(!time(e.at)||!time(e.activeMs)||typeof e.type!=='string'||typeof e.id!=='string')throw Error('Ungültiges Ereignis.');
 for(const x of s.syncs)if(!time(x.at)||!Number.isFinite(x.offsetSeconds)||x.offsetSeconds<0||typeof x.id!=='string')throw Error('Ungültiger Sync-Punkt.');
 return s;
}
export function protocolRows(s,now=Date.now()){
 const steps=stepsFor(s.interview);const rows=s.visits.map((v,i)=>{const q=steps.find(q=>q.id===v.stepId),rec=recordingAt(s,v.start),end=v.end===null?null:recordingAt(s,v.end);return {type:'question',at:v.start,end:v.end,stepId:v.stepId,label:q.text.replaceAll('**',''),section:q.sectionTitle,visit:i+1,durationMs:(v.activeEnd??activeMs(s,now))-v.activeStart,activeMs:v.activeStart,recordingSeconds:rec?.seconds??null,recordingEndSeconds:end?.seconds??null,syncId:rec?.syncId??'',note:s.notes[v.stepId]??''};});
 for(const e of s.events){const q=steps.find(x=>x.id===e.stepId),rec=recordingAt(s,e.at);rows.push({type:e.type,at:e.at,end:null,stepId:e.stepId,label:e.label??e.type,section:q?.sectionTitle??'',visit:null,durationMs:null,activeMs:e.activeMs,recordingSeconds:rec?.seconds??null,syncId:rec?.syncId??'',note:e.note??''});}
 return rows.sort((a,b)=>a.at-b.at);
}
export function csvFor(s,now=Date.now()) {const clean=v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';};const rows=protocolRows(s,now),headers=['Typ','Start ISO','Ende ISO','Bereich','Fragen-ID','Frage / Marker','Interviewzeit','Aktive Dauer','Aufnahmezeit','Aufnahme Ende','Sync','Notiz'];return '\uFEFF'+[headers,...rows.map(r=>[r.type,new Date(r.at).toISOString(),r.end?new Date(r.end).toISOString():'',r.section,r.stepId,r.label,fmt(r.activeMs),r.durationMs===null?'':fmt(r.durationMs),r.recordingSeconds===null?'':fmt(r.recordingSeconds*1000),r.recordingEndSeconds==null?'':fmt(r.recordingEndSeconds*1000),r.syncId,r.note])].map(r=>r.map(clean).join(';')).join('\r\n');}
export function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function pack(session,revision=1,writer=''){const body=JSON.stringify({session,revision,writer});return JSON.stringify({body,checksum:hash(body)});}
export function unpack(value){try{const p=JSON.parse(value);if(hash(p.body)!==p.checksum)return null;const b=JSON.parse(p.body);b.session=validateSession(b.session);if(!Number.isSafeInteger(b.revision)||b.revision<0)return null;return b;}catch{return null;}}
