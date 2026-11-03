const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const rooms = ['FF2-03','FF2-06','GF-06','GF-01','GF-14','FF3-06'];
  const out = await p.evaluate((rooms) => {
    const s = window.__silid;
    return {
      placed: s.props.placed.filter(x => rooms.includes(x.room)),
      rejected: s.props.rejected.slice(0, 30),
      interactables: s.props.interactables.map(i => ({id:i.id,kind:i.kind,x:+i.x.toFixed(2),y:+i.y.toFixed(2),z:+i.z.toFixed(2),room:i.room})),
    };
  }, rooms);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
