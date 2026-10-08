// Cambiar VERSION al publicar una actualización de los archivos de la app.
const VERSION='correlativas-v2';
const ROOT=new URL('./',self.location.href).href;
const CACHE=VERSION+'-'+new URL(ROOT).pathname;
const ASSETS=['./','./index.html','./styles.css','./app.js','./data.js','./engine.js','./icons.js','./cloud.js','./firebase-config.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('correlativas-')&&key.endsWith('-'+new URL(ROOT).pathname)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  // Nunca se guardan respuestas de Auth ni de Firestore en este caché.
  if(url.origin===self.location.origin&&url.href.startsWith(ROOT)){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
      return response;
    }).catch(()=>caches.match(event.request).then(hit=>hit||(event.request.mode==='navigate'?caches.match(ROOT+'index.html'):Response.error()))));
  }else if(url.origin==='https://www.gstatic.com'&&url.pathname.startsWith('/firebasejs/')){
    event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}return response;
    })));
  }
});
