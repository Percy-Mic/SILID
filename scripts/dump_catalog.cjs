// Dump every interactive object the running build knows about, with the room
// it stands in, so the interaction catalog is generated from the game rather
// than from memory. Writes reports/mansion/catalog.json.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });

  const out = await page.evaluate(() => {
    const s = window.__silid;
    // nearest level wins: a panel on the basement wall is 2 m below the ground
    // floor, and both levels contain that x/z rectangle.
    const roomOf = (x, z, y) => {
      let best = null, bestDy = Infinity;
      for (const l of s.levels) {
        const dy = Math.abs(l.y - y);
        if (dy > 2.4 || dy >= bestDy) continue;
        for (const r of l.rooms) {
          if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
            best = l.id + ' ' + r.id + ' ' + r.name;
            bestDy = dy;
          }
        }
      }
      return best;
    };
    const items = s.props.interactables.map((i) => ({
      id: i.id, kind: i.kind, name: i.name,
      at: [+i.x.toFixed(2), +i.y.toFixed(2), +i.z.toFixed(2)],
      room: roomOf(i.x, i.z, i.y ?? 0),
      contents: i.drawer?.contents?.id ?? null,
      conditional: !!i.when,
    }));
    const doors = s.architecture.doors.map((d) => ({
      id: d.id ?? null, level: d.level, axis: d.axis,
      at: [+d.c.toFixed(2), +d.at.toFixed(2)], width: d.w,
      arch: !!d.arch, entrance: !!d.entrance, locked: !!d.locked,
    }));
    const counts = {};
    for (const i of items) counts[i.kind] = (counts[i.kind] || 0) + 1;
    return {
      counts, items, doors,
      pickupsOutstanding: [...s.game.inventory],
      apparatus: s.apparatus ? Object.keys(s.apparatus) : null,
    };
  });

  fs.mkdirSync('reports/mansion', { recursive: true });
  fs.writeFileSync('reports/mansion/catalog.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.counts));
  console.log('doors', out.doors.length, 'arch', out.doors.filter((d) => d.arch).length);
  console.log(out.items.map((i) => `${i.kind}\t${i.id}\t${i.room ?? '?'}`).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
