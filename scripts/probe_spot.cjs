// Report what the running game thinks is under a coordinate: floor height,
// room, and whether the player capsule is blocked there. Used to pick stand
// points for the QA screenshots.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const spots = process.argv.slice(2).map((s) => s.split(',').map(Number));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await page.evaluate((spots) => spots.map(([x, z, y]) => {
    const s = window.__silid;
    const f = s.floorAt(x, z, y);
    s.spawnAt(x, z, y);
    const pl = s.player;
    const room = s.levels.map((l) => {
      for (const r of l.rooms) {
        if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return l.id + '/' + r.id + ' ' + r.name;
      }
      return null;
    }).filter(Boolean);
    return {
      at: [x, z, y], floorBelow: f, footY: +pl.footY.toFixed(2),
      blocked: pl.blocked(x, z), rooms: room,
      level: s.game.currentLevel()?.id ?? null,
    };
  }), spots);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
