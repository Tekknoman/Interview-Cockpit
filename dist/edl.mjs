// Resolve timeline-marker EDL. All timing uses wall time, including pauses.
export const FRAME_RATES={'25':{fps:25,nominal:25},'24':{fps:24,nominal:24},'23.976':{fps:24000/1001,nominal:24},'30':{fps:30,nominal:30},'29.97':{fps:30000/1001,nominal:30},'29.97df':{fps:30000/1001,nominal:30,drop:2},'50':{fps:50,nominal:50},'60':{fps:60,nominal:60},'59.94df':{fps:60000/1001,nominal:60,drop:4}};
function rate(key){const r=FRAME_RATES[key];if(!r)throw Error('Unbekannte Bildrate.');return r;}
export function tcFrames(tc,key='25'){
 const r=rate(key),m=/^(\d{2}):(\d{2}):(\d{2})[:;](\d{2})$/.exec(tc.trim());
 if(!m)throw Error('Timecode muss HH:MM:SS:FF sein.');
 const [h,min,s,f]=m.slice(1).map(Number);
 if(h>23||min>59||s>59||f>=r.nominal||(r.drop&&min%10!==0&&s===0&&f<r.drop))throw Error('Ungültiger Timecode für diese Bildrate.');
 return ((h*3600+min*60+s)*r.nominal+f)-(r.drop||0)*((h*60+min)-Math.floor((h*60+min)/10));
}
export function framesTC(frame,key='25'){
 const r=rate(key);if(!Number.isInteger(frame)||frame<0)throw Error('Negative oder ungültige Frameposition.');
 let n=frame;
 if(r.drop){const ten=r.nominal*600-r.drop*9,minute=r.nominal*60-r.drop,d=Math.floor(n/ten),rest=n%ten;n+=r.drop*9*d+(rest>=r.drop?r.drop*Math.floor((rest-r.drop)/minute):0);}
 const f=n%r.nominal,s=Math.floor(n/r.nominal)%60,min=Math.floor(n/r.nominal/60)%60,h=Math.floor(n/r.nominal/3600);
 if(h>23)throw Error('EDL-Timecode überschreitet 24 Stunden.');
 return [h,min,s,f].map(x=>String(x).padStart(2,'0')).join(':');
}
export function parseCockpitCSV(text){
 if(typeof text!=='string'||text.length>10000000)throw Error('CSV ist leer oder zu gross (max. 10 MB).');
 text=text.replace(/^\uFEFF/,'');const delimiter=text.slice(0,text.indexOf('\n')<0?text.length:text.indexOf('\n')).includes(';')?';':',';
 const table=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else throw Error('Ungültige CSV-Anführungszeichen.');}else if(c===delimiter&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))table.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('Nicht geschlossene CSV-Anführungszeichen.');if(field||row.length){row.push(field);table.push(row);}
 const headers=table.shift()||[];
 for(const key of ['Typ','Start ISO','Ende ISO','Bereich','Fragen-ID','Frage / Marker','Sync'])if(!headers.includes(key))throw Error('Kein Cockpit-CSV: Spalte «'+key+'» fehlt.');
 return table.map(cells=>Object.fromEntries(headers.map((key,i)=>[key,cells[i]||''])));
}
export function csvSyncs(rows){return rows.filter(r=>r.Typ==='sync'&&r.Sync&&Number.isFinite(Date.parse(r['Start ISO']))).map(r=>({id:r.Sync,at:Date.parse(r['Start ISO']),recording:r.Aufnahmezeit||'00:00'}));}
const clean=s=>String(s||'').replace(/[\r\n|\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim();
export function resolveEDL(rows,{fps='25',syncId,timelineStart='01:00:00:00',syncTimecode='01:00:00:00',ranges=true,clips=true,title='Interview'}={}){
 const r=rate(fps),syncs=csvSyncs(rows),anchor=syncs.find(x=>x.id===syncId);
 if(!anchor)throw Error('Zuerst im Interview einen Sync-Punkt setzen oder ein CSV mit Sync-Punkt laden.');
 const start=tcFrames(timelineStart,fps),anchorFrame=tcFrames(syncTimecode,fps),next=syncs.filter(x=>x.at>anchor.at).sort((a,b)=>a.at-b.at)[0];
 let skipped=0,points=0;const markers=[];
 for(const row of rows){if(row.Typ!=='question'&&!(clips&&row.Typ==='marker'))continue;
 const at=Date.parse(row['Start ISO']);
 if(row.Sync!==syncId||!Number.isFinite(at)||at<anchor.at||(next&&at>=next.at)){skipped++;continue;}
 const frame=anchorFrame+Math.round((at-anchor.at)/1000*r.fps);
 if(frame<start){skipped++;continue;}
 const end=Date.parse(row['Ende ISO']);let duration=1;
 if(ranges&&row.Typ==='question'&&Number.isFinite(end)&&end>at&&(!next||end<=next.at))duration=Math.max(1,Math.round((end-at)/1000*r.fps));else if(ranges&&row.Typ==='question')points++;
 framesTC(frame+duration,fps);
 const name=row.Typ==='question'?`${row['Fragen-ID']} · ${row['Bereich']} · ${row['Frage / Marker']}`:row['Frage / Marker'];
 markers.push({frame,duration,name:clean(name),color:row.Typ==='marker'?'Yellow':'Blue',note:clean(row.Notiz)});
 }
 markers.sort((a,b)=>a.frame-b.frame);
 // Resolve stores one marker at each frame. Keep both labels instead of silently losing one.
 const merged=[];for(const m of markers){const last=merged.at(-1);if(last?.frame===m.frame){last.name+=' / '+m.name;last.duration=Math.max(last.duration,m.duration);last.note=[last.note,m.note].filter(Boolean).join(' / ');}else merged.push({...m});}
 if(!merged.length)throw Error('Keine passenden Fragen oder Clip-Marker für diesen Sync-Punkt.');
 const lines=[`TITLE: ${clean(title)}`,`FCM: ${r.drop?'DROP FRAME':'NON-DROP FRAME'}`,''];
 merged.forEach((m,i)=>{const a=framesTC(m.frame,fps),b=framesTC(m.frame+1,fps);lines.push(`${String(i+1).padStart(3,'0')}  001      V     C        ${a} ${b} ${a} ${b}`,` |C:ResolveColor${m.color} |M:${m.name}${m.note?' — '+m.note:''} |D:${m.duration}`,'');});
 return {text:lines.join('\r\n'),count:merged.length,skipped,points};
}
