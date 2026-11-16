import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCockpitCSV,csvSyncs,resolveEDL,tcFrames,framesTC} from '../dist/edl.mjs';
const rows=parseCockpitCSV(readFileSync(new URL('../integrations/davinci-resolve/examples/interview-beispiel.csv',import.meta.url),'utf8'));
test('real exporter CSV: wall time retains pauses and precise sync anchor',()=>{
 assert.equal(csvSyncs(rows)[0].id,'sync-1');
 const result=resolveEDL(rows,{syncId:'sync-1',syncTimecode:'01:00:12:00'});
 assert.match(result.text,/01:00:22:00/); // question begins 10 s after sync
 assert.match(result.text,/\|D:1500/); // 60 s wall time, not 40 s active time
 assert.match(result.text,/ResolveColorYellow/);
 assert.ok(result.skipped>0); // introduction before sync is excluded
});
test('quoted multiline notes, BOM, escaped quote and semicolon survive parsing',()=>{
 const input='\uFEFFTyp;Start ISO;Ende ISO;Bereich;Fragen-ID;Frage / Marker;Sync;Notiz\r\nsync;2026-01-01T00:00:00Z;;;;;sync-1;\r\nquestion;2026-01-01T00:00:01Z;2026-01-01T00:00:02Z;A;q1;"a; ""b""";sync-1;"line\n|M:bad"';
 const parsed=parseCockpitCSV(input);assert.equal(parsed[1]['Frage / Marker'],'a; "b"');
 const edl=resolveEDL(parsed,{syncId:'sync-1'});assert.equal(edl.count,1);assert.equal((edl.text.match(/\|M:/g)||[]).length,1);
});
test('invalid CSV, missing sync, invalid timecodes fail visibly',()=>{
 assert.throws(()=>parseCockpitCSV('foo,bar'));
 assert.throws(()=>parseCockpitCSV('"unterminated'));
 assert.throws(()=>resolveEDL(rows,{syncId:'missing'}));
 assert.throws(()=>tcFrames('01:00:00:25','25'));
 assert.throws(()=>tcFrames('01:01:00:00','29.97df'));
});
test('timecode round trips including drop-frame minute and ten-minute boundaries',()=>{
 for(const fps of ['24','25','23.976','29.97','29.97df','59.94df','60'])for(const n of [0,1,1799,1800,17982,107892,215999])assert.equal(tcFrames(framesTC(n,fps),fps),n);
 assert.equal(framesTC(1800,'29.97df'),'00:01:00:02');assert.equal(framesTC(17982,'29.97df'),'00:10:00:00');
});
test('segment selection excludes other recordings, crossing questions become points',()=>{
 const modified=structuredClone(rows);modified.push({Typ:'sync',Sync:'sync-2','Start ISO':'2026-11-16T12:01:00Z'});
 const r=resolveEDL(modified,{syncId:'sync-1'});assert.equal(r.points,1);assert.ok(r.skipped>=2);
});
test('same-frame labels merge and point-only mode uses one frame',()=>{
 const modified=structuredClone(rows);const q=modified.find(x=>x.Typ==='question'&&x.Sync==='sync-1');modified.push({...q,Typ:'marker','Frage / Marker':'same frame'});
 const r=resolveEDL(modified,{syncId:'sync-1',ranges:false});assert.match(r.text,/same frame/);assert.ok(!r.text.includes('|D:1500'));
});
