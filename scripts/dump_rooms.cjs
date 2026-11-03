// Per-room inventory from the running build: every placed furniture template,
// every interactable and every light, grouped by level and room. Feeds
// MANSION_ROOM_BIBLE.md and MANSION_INTERACTION_CATALOG.md with facts rather
// than intentions. Writes reports/mansion/rooms.json.
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
    const rooms = [];
    for (const l of s.levels) {
      for (const r of l.rooms) {
        const inside = (x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
        // The roof deck covers the whole footprint, so a geometry test would
        // attribute every pavilion's furniture to it. Furniture knows the room
        // it was dressed for; use that.
        const furn = s.props.placed
          .filter((p) => p.level === l.id && p.room === r.id)
          .map((p) => p.name);
        // Interactions do not carry a room id consistently, so a point belongs
        // to the FIRST room that contains it, which is the same order roomAt()
        // uses.
        const owner = (x, z) => l.rooms.find((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) || null;
        const counts = {};
        for (const f of furn) counts[f] = (counts[f] || 0) + 1;
        // An object belongs to the level whose floor is nearest to it: the
        // basement workshop is directly under the courtyard, and a 2.4 m window
        // put its shelves in the courtyard's inventory.
        const items = s.props.interactables
          .filter((i) => {
            if (!inside(i.x, i.z)) return false;
            if (owner(i.x, i.z) !== r) return false;
            const y = i.y ?? l.y;
            let best = null, bestDy = Infinity;
            for (const k of s.levels) {
              const dy = Math.abs(k.y - y);
              if (dy < bestDy) { bestDy = dy; best = k; }
            }
            return best === l;
          })
          .map((i) => (i.kind === 'drawer' ? 'drawer:' + i.unit.label + ':' + i.drawer.index : i.id));
        // Lights carry the room they were authored for; fall back to geometry
        // only when the placer did not name one. The roof deck would otherwise
        // inherit every pavilion lamp.
        const lights = s.props.lights.filter((p) => (p.room
          ? p.room === r.id
          : (owner(p.x, p.z) === r && Math.abs(p.y - (l.y + 3)) < 2.6)));
        rooms.push({
          level: l.id, id: r.id, name: r.name, kind: r.kind,
          rect: [r.x0, r.z0, r.x1, r.z1],
          area: +((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(1),
          furniture: counts, furnitureCount: furn.length,
          interactables: items, lights: lights.length,
        });
      }
    }
    return { rooms, hung: s.props.issues ?? [], rejected: s.props.rejected ?? [] };
  });

  fs.mkdirSync('reports/mansion', { recursive: true });
  fs.writeFileSync('reports/mansion/rooms.json', JSON.stringify(out, null, 1));
  const empty = out.rooms.filter((r) => r.furnitureCount === 0);
  console.log('rooms', out.rooms.length, 'empty', empty.length);
  console.log('empty:', empty.map((r) => r.level + ' ' + r.id + ' ' + r.name + ' (' + r.kind + ')').join(' | '));
  console.log('issues', out.hung.length, 'rejected', out.rejected.length);
  for (const r of out.rooms) {
    console.log(`${r.level} ${r.id} ${r.name} [${r.kind}] ${r.area}m2 -> ${r.furnitureCount} pieces, ${r.interactables.length} interactive, ${r.lights} lights`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
