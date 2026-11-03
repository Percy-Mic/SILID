const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const w = window.__silid;
    const pick = (lvl, c) => w.architecture.windows
      .filter((x) => x.level === lvl && x.axis === 'z' && Math.abs(x.c - c) < 0.05)
      .map((x) => ({ at: +((x.a + x.b) / 2).toFixed(2), w: +(x.b - x.a).toFixed(2), sill: x.sill, head: x.head }));
    const f4 = w.levels.find((l) => l.id === 'F4');
    return {
      westGF: pick('GF', -24), westF2: pick('F2', -24), westF3: pick('F3', -24),
      eastGF: pick('GF', 22), eastF2: pick('F2', 22), eastF3: pick('F3', 22),
      f4: f4.rooms.map((r) => ({ id: r.id, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 })),
      doorsGF: w.levels.find((l) => l.id === 'GF').doors.filter((d) => d.axis === 'z' && (Math.abs(d.c + 24) < 0.1 || Math.abs(d.c - 22) < 0.1)),
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
