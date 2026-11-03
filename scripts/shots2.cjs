const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 90000 });
  const shots = [
    ['front', -6, 22, Math.PI, -0.02, null],
    ['bedroom_f2', -2, -9.4, Math.PI, -0.04, 4.2],
    ['basement', -16, 2.4, -1.2, -0.02, -3.4],
    ['generator', 2.6, -3.2, 0.1, -0.05, -3.4],
    ['tunnel', 19, 6, -Math.PI/2, -0.02, -3.4],
    ['cave', 38, 6, -Math.PI/2, -0.02, -3.42],
    ['stairview', 2.9, 9.6, 1.5, -0.1, 0],
  ];
  for (const [name,x,z,yaw,pitch,y] of shots) {
    await p.evaluate(([x,z,yaw,pitch,y]) => {
      const s=window.__silid; s.spawnAt(x,z,y===null?null:y,yaw,pitch);
      s.renderer.render(s.scene,s.camera);
    }, [x,z,yaw,pitch,y]);
    await p.waitForTimeout(500);
    await p.screenshot({ path: 'reports/rebuild/'+name+'.png', timeout: 120000 });
  }
  console.log('ok', JSON.stringify(await p.evaluate(()=>window.__silid.metrics())));
  if (errs.length) console.log('ERRS', errs.slice(0,10).join(' | '));
  await b.close();
})();
