export const ABORT_WINDOW_MS=250;
export function holdDuration(value){const n=Number(value);return Number.isFinite(n)?Math.max(300,Math.min(2000,Math.round(n/50)*50)):600;}
// Explicit frames allow deterministic cancellation tests and avoid background timers.
export class HoldGesture{
 constructor({onProgress=()=>{},onReady=()=>{},onActivate=()=>{},onCancel=()=>{}}={}){Object.assign(this,{onProgress,onReady,onActivate,onCancel});this.state=null;}
 begin({id,x,y,direction,duration=600},now){this.cancel();this.state={id,x,y,direction,duration:holdDuration(duration),start:now,readyAt:null};this.onProgress(0,this.state);}
 move(id,x,y){const s=this.state;if(s&&s.id===id&&Math.hypot(x-s.x,y-s.y)>18)this.cancel();}
 end(id){if(this.state?.id===id)this.cancel();}
 cancel(){if(this.state){this.state=null;this.onCancel();}}
 frame(now){const s=this.state;if(!s)return;const progress=Math.max(0,Math.min(1,(now-s.start)/(s.duration-ABORT_WINDOW_MS)));this.onProgress(progress,s);
 if(progress===1&&s.readyAt===null){s.readyAt=now;this.onReady(s);}
 // A stalled frame must not consume the visible opportunity to abort.
 if(s.readyAt!==null&&now-s.readyAt>=ABORT_WINDOW_MS&&now-s.start>=s.duration){this.state=null;this.onActivate(s);}
 }
}
export function installHoldNavigation({enabled,duration,haptics,canGoBack,onNavigate}){
 const ring=document.createElement('div');ring.className='hold-indicator';ring.hidden=true;ring.setAttribute('aria-hidden','true');ring.innerHTML='<svg viewBox="0 0 100 100"><circle class="hold-track" cx="50" cy="50" r="44"/><circle class="hold-fill" cx="50" cy="50" r="44" pathLength="1"/></svg><span></span>';document.body.append(ring);
 let raf=0,blockClickUntil=0;const pointers=new Set();
 const vibrate=ms=>{if(haptics())try{navigator.vibrate?.(ms);}catch{}};
 const hide=()=>{ring.hidden=true;cancelAnimationFrame(raf);};
 const gesture=new HoldGesture({onProgress:(p,s)=>{ring.hidden=false;ring.style.left=s.x+'px';ring.style.top=s.y+'px';ring.style.setProperty('--hold-progress',p);ring.classList.toggle('ready',p===1);ring.querySelector('span').textContent=s.direction>0?'→':'←';},onReady:()=>vibrate(10),onCancel:hide,onActivate:s=>{hide();vibrate(25);blockClickUntil=performance.now()+1000;onNavigate(s.direction);}});
 const cancel=()=>{gesture.cancel();};
 const frame=now=>{if(!enabled()||document.visibilityState!=='visible'){cancel();return;}gesture.frame(now);if(gesture.state)raf=requestAnimationFrame(frame);};
 const interactive='button,a,input,textarea,select,label,summary,details,dialog,[role="button"],[contenteditable="true"]';
 document.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size!==1||!e.isPrimary){cancel();return;}if(!enabled()||e.button!==0||!(e.target instanceof Element)||!e.target.closest('#live')||e.target.closest(interactive))return;
 const direction=e.clientX<innerWidth/2?-1:1;if(direction<0&&!canGoBack())return;
 gesture.begin({id:e.pointerId,x:e.clientX,y:e.clientY,direction,duration:duration()},performance.now());raf=requestAnimationFrame(frame);
 },true);
 document.addEventListener('pointermove',e=>gesture.move(e.pointerId,e.clientX,e.clientY),true);
 for(const name of ['pointerup','pointercancel'])document.addEventListener(name,e=>{pointers.delete(e.pointerId);gesture.end(e.pointerId);},true);
 document.addEventListener('click',e=>{if(performance.now()<blockClickUntil&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();blockClickUntil=0;}},true);
 document.addEventListener('contextmenu',e=>{if(gesture.state)e.preventDefault();});
 for(const name of ['blur','pagehide','resize','orientationchange'])window.addEventListener(name,()=>{cancel();pointers.clear();});
 window.addEventListener('scroll',cancel,true);
 document.addEventListener('visibilitychange',()=>{cancel();pointers.clear();});
 return {cancel};
}
