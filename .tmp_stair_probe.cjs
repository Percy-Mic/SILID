const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const w = window.__silid;
    return {
      ramps: w.architecture.ramps.map(r => ({ k: r.kind, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0: r.y0, y1: r.y1, steps: r.steps })),
      extra: w.architecture.extraFloors.map(f => ({ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, y: f.y })),
      at: [8.6, 8.2, 7.5].map(z => w.floorAt(-4.6, z, 0)),
      atUp: [8.6, 8.2, 7.5].map(z => w.floorAt(-4.6, z, 1.0)),
    };
  });
  console.log('RAMPS', JSON.stringify(out.ramps)); console.log('AT', JSON.stringify(out.at), JSON.stringify(out.atUp));
  await b.close();
})();
