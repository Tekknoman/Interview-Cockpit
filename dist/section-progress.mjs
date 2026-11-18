// Section colours from Interview-Leitfaden.docx, grouping table.
export const FOCUS_SECTION_COLORS={mint:'#FAE2D5',blue:'#C1F0C7',amber:'#F2CEED',violet:'#CAEDFB',rose:'#FFFFCC'};
export function sectionColor(key){return FOCUS_SECTION_COLORS[key]??FOCUS_SECTION_COLORS.mint;}
export function rgb(hex){return hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)).join(',');}
export function sectionProgress(interview,currentId,completedIds=new Set()){
 let number=0;const sections=interview.sections.map(section=>({id:section.id,title:section.title,color:sectionColor(section.color),questions:section.questions.map((q,index)=>({id:q.id,number:++number,index,current:q.id===currentId,completed:completedIds.has(q.id)}))}));
 const active=sections.find(s=>s.questions.some(q=>q.current));const index=active?.questions.findIndex(q=>q.current)??-1;
 const next=active&&index===active.questions.length-1?sections[sections.indexOf(active)+1]??null:null;
 return {sections,total:number,completed:sections.reduce((sum,s)=>sum+s.questions.filter(q=>q.completed).length,0),active,position:index+1,next};
}
