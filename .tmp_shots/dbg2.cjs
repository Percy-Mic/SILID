const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror',(e)=>console.log('PAGEERROR:', e.message, '\n', (e.stack||'').split('\n').slice(0,4).join('\n')));
  p.on('console',(m)=>{ if(m.type()==='error') console.log('CONSOLE.ERR:', m.text().slice(0,300)); });
  await p.goto('http://127.0.0.1:5199/?probe=1');
  await p.waitForFunction(()=>window.__silid?.ready,null,{timeout:300000});
  for (let i=0;i<4;i++){
    await p.waitForTimeout(1500);
    const s = await p.evaluate(()=>({t:window.__silid.roomStats().ticks, f:window.__silid.metrics().fps, pos:window.__silid.camera.position.toArray().map(v=>+v.toFixed(1))}));
    console.log(i, JSON.stringify(s));
  }
  await b.close();
})();
