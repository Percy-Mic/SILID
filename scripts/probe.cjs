const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR '+e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const s = window.__silid;
    const at = (x,z,y) => s.floorAt(x,z,y);
    const angles = [90,180,270,360,450].map(d => {
      const a = d*Math.PI/180; return {d, y: at(-1.5+Math.cos(a)*2.2, 7.5+Math.sin(a)*2.2, d<200?1:3)};
    });
    return {
      metrics: s.metrics(),
      floors: {
        foyer: at(2.8, 7.5, 0),
        gallery: at(0, 0, 0),
        f2: at(3, 6, 4.2),
        f3: at(3, 6, 8.0),
        f4: at(3, 6, 11.6),
        basement: at(-16, 6, -3.4),
        outside: at(-40, 20, 1.2),
      },
      stair: angles,
      levelRooms: s.levels.map(l => l.id + ':' + l.rooms.length),
    };
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('ERRS', errs.slice(0,8));
  await b.close();
})();
