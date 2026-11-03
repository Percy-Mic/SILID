const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs=[];
  p.on('console',(m)=>logs.push(m.type()+': '+m.text().slice(0,180)));
  p.on('pageerror',(e)=>logs.push('pageerror '+e.message));
  p.on('requestfailed',(r)=>logs.push('reqfail '+r.url()+' '+r.failure()?.errorText));
  p.on('response',(r)=>{ if(r.url().includes('/assets/rooms/')) logs.push('resp '+r.status()+' '+r.url()); });
  await p.goto('http://127.0.0.1:5199/?probe=1');
  await p.waitForFunction(()=>window.__silid?.ready,null,{timeout:300000});
  await p.evaluate(()=>{ window.__silid.spawnAt(10.5,4.1,-3.4,Math.PI,0); window.__silid.player.enabled=true; });
  await p.waitForTimeout(12000);
  const s = await p.evaluate(()=>({ stats: window.__silid.roomStats(), pos: window.__silid.camera.position.toArray().map(v=>+v.toFixed(2)) }));
  console.log(JSON.stringify(s));
  console.log(logs.filter(l=>!l.startsWith('log:')).slice(0,15).join('\n'));
  await b.close();
})();
