const PREFIX='interview-cockpit:'+self.registration.scope+':',CACHE=PREFIX+'v11';
const ASSETS=['./','./index.html','./styles.css','./app.mjs','./core.mjs','./section-progress.mjs','./hold.mjs','./edl.mjs','./fonts/AtkinsonHyperlegibleNext.ttf','./interview.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'})))));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(e.request,{ignoreSearch:true});if(cached)return cached;try{return await fetch(e.request);}catch{if(e.request.mode==='navigate')return c.match('./index.html');throw Error('Offline nicht verfügbar');}}));});

self.addEventListener('message',event=>{
  if(event.data==='activate-confirmed-update')event.waitUntil(self.skipWaiting());
});
