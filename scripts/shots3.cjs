const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const shots = [
    ['mb2', -2.5, -8.6, 3.0, -0.05, 4.2],
    ['foyer2', 0, 8.6, Math.PI, -0.03, 0],
    ['gallery2', -9, 0.6, -Math.PI/2, -0.02, 0],
    ['kitchen2', -20.5, -7.4, 1.6, -0.05, 0],
    ['gen2', 3, -1.2, 0.0, -0.06, -3.4],
    ['tunnel2', 22, 5.9, -Math.PI/2, -0.02, -3.42],
  ];
  for (const [n,x,z,yaw,pitch,y] of shots) {
    await p.evaluate(([x,z,yaw,pitch,y])=>{const s=window.__silid;s.spawnAt(x,z,y===null?null:y,yaw,pitch);s.renderer.render(s.scene,s.camera);},[x,z,yaw,pitch,y]);
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'reports/rebuild/'+n+'.png', timeout: 120000 });
  }
  console.log('metrics', JSON.stringify(await p.evaluate(()=>window.__silid.metrics())));
  if(errs.length) console.log('ERR', errs.slice(0,5).join(' | '));
  await b.close();
})();
