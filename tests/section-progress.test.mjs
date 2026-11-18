import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionProgress,sectionColor} from '../dist/section-progress.mjs';
const interview=JSON.parse(readFileSync(new URL('../dist/interview.json',import.meta.url),'utf8'));
test('section boundary announces the next group only on its final question',()=>{
 assert.equal(sectionProgress(interview,'q1').next,null);
 const m=sectionProgress(interview,'q2');assert.equal(m.next.id,'B');assert.equal(m.position,2);assert.equal(m.active.questions.length,2);
 assert.equal(sectionProgress(interview,'q5').next.id,'C');
 assert.equal(sectionProgress(interview,'q14').next,null);
});
test('jumping does not falsely mark skipped questions as completed',()=>{
 const m=sectionProgress(interview,'q8',new Set(['q1','q2','__intro']));assert.equal(m.completed,2);assert.equal(m.total,14);assert.equal(m.position,3);
 assert.equal(m.sections.flatMap(s=>s.questions).filter(q=>q.current).length,1);
 assert.equal(m.sections[1].questions.some(q=>q.completed),false);
});
test('return visits distinguish current question from completion; intro/outro have no handoff',()=>{
 const m=sectionProgress(interview,'q2',new Set(['q1','q2']));assert.equal(m.active.questions[1].current,true);assert.equal(m.active.questions[1].completed,true);
 for(const id of ['__intro','__outro']){const model=sectionProgress(interview,id);assert.equal(model.active,undefined);assert.equal(model.next,null);}
});
test('palette follows the document grouping and imported categories have a safe fallback',()=>{
 assert.deepEqual(interview.sections.map(s=>sectionColor(s.color)),['#FAE2D5','#C1F0C7','#F2CEED','#CAEDFB','#FFFFCC']);assert.equal(sectionColor('unknown'),'#FAE2D5');
});
