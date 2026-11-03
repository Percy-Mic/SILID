// Runtime mansion audit. Loads the real Vite game with ?probe=1 and reports
// what the built architecture actually contains: doors that failed to cut,
// floor holes, stair ramps, collider counts, and a vertical sample of the
// stair tower. Nothing here is a mock — it reads window.__silid, which main.js
// publishes only after buildArchitecture(), furnish() and the player exist.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 240)));

  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(800);

  const out = await page.evaluate(() => {
    const s = window.__silid;
    const a = s.architecture;

    // sample the helix from the foyer floor upward at the stair's mid radius
    // and report where a walker's feet would be, plus how much headroom the
    // query thinks they have.
    const samples = [];
    for (let i = 0; i <= 24; i++) {
      const y = i * 0.5;
      const ang = Math.PI / 2 + (i / 24) * Math.PI * 2;
      const x = -1.5 + Math.cos(ang) * 2.1;
      const z = 7.5 + Math.sin(ang) * 2.1;
      samples.push({ y, foot: s.floorAt(x, z, y) });
    }

    const floorHoles = a.holes.map((h) => h.level + ':' + (h.kind === 'circle'
      ? 'circle@' + h.x + ',' + h.z + ' r' + h.r
      : 'rect ' + h.x0 + '..' + h.x1 + ' x ' + h.z0 + '..' + h.z1));

    // Every room must have walkable floor at its own level somewhere near its
    // centre, and not be filled with furniture. This catches a floor hole
    // under a room, a room whose only floor is the storey below, and a piece
    // of furniture that was placed across the whole room.
    const pl = s.player;
    const roomChecks = [];
    for (const level of s.levels) {
      for (const r of level.rooms) {
        if (r.kind === 'courtyard') continue;
        pl.footY = level.y;
        let floorOk = 0, freeOk = 0, sampled = 0;
        for (let ix = 1; ix <= 3; ix++) {
          for (let iz = 1; iz <= 3; iz++) {
            const x = r.x0 + (r.x1 - r.x0) * (ix / 4);
            const z = r.z0 + (r.z1 - r.z0) * (iz / 4);
            sampled++;
            const f = s.floorAt(x, z, level.y);
            if (f !== null && Math.abs(f - level.y) < 0.12) floorOk++;
            if (!pl.blocked(x, z)) freeOk++;
          }
        }
        if (floorOk < sampled || freeOk === 0) {
          roomChecks.push({ id: r.id, level: level.id, name: r.name, floorOk, freeOk, sampled });
        }
      }
    }

    return {
      metrics: s.metrics(),
      levels: s.levels.map((l) => ({ id: l.id, y: l.y, h: l.h, rooms: l.rooms.length })),
      missingDoors: a.missingDoors,
      doorCount: a.doors.length,
      archCount: a.doors.filter((d) => d.arch).length,
      doorsWithoutCollider: a.doors.filter((d) => !d.arch && !d.collider).map((d) => d.level + ' ' + d.axis + ' ' + d.at + ',' + d.c),
      ramps: a.ramps,
      floorHoles,
      colliders: a.colliders.length,
      propColliders: s.props.colliders.length,
      stairSamples: samples,
      levelUnderStairHead: a.ramps.map((r) => r.index + ':' + r.y0 + '->' + r.y1),
      landings: a.extraFloors.length,
      roomChecks,
    };
  });

  console.log(JSON.stringify({ ...out, errors }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
