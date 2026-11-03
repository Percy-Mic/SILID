const { chromium } = require('playwright');
(async () => {
  const [,, url, out, x, z, yaw, pitch, y] = process.argv;
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type()+': '+m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.goto(url || 'http://127.0.0.1:5333/?probe=1', { waitUntil: 'load' });
  try { await p.waitForFunction(() => window.__silid && window.__silid.ready, null, { timeout: 90000 }); }
  catch (e) { console.log('NOT READY', await p.evaluate(() => document.getElementById('boot-msg')?.textContent)); await p.screenshot({ path: out || 'reports/rebuild/err.png' }); console.log(errs.join('\n')); await b.close(); return; }
  await p.evaluate(([x,z,yaw,pitch,y]) => {
    window.__silid.spawnAt(Number(x), Number(z), y === 'null' ? null : Number(y), Number(yaw), Number(pitch));
    const s = window.__silid; s.renderer.render(s.scene, s.camera);
  }, [x||'-53.4', z||'27.2', yaw||'-2.55', pitch||'-0.03', y||'null']);
  await p.waitForTimeout(700);
  await p.screenshot({ path: out || 'reports/rebuild/01_road.png' });
  console.log(JSON.stringify(await p.evaluate(() => window.__silid.metrics())));
  console.log(errs.join('\n'));
  await b.close();
})();
