// Checks the live Three.js scene: every registered exterior window is raycast
// from its own room toward the exterior, and the wall collider is checked at
// the aperture mid-height. This is a geometry audit, not a screenshot-only test.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const report = await page.evaluate(() => {
    const w = window.__silid, T = w.THREE, a = w.architecture, ray = new T.Raycaster();
    w.scene.updateMatrixWorld(true);
    const meshes = [];
    w.scene.traverse(o => { if (o.isMesh && o.visible && /^(Windows_|LitWindows_|Walls_|Exterior_|Facade)/.test(o.name)) meshes.push(o); });
    const byLevel = {}, byFacade = {}, blocked = [];
    let samples = 0, glassFirst = 0, wallFirst = 0, otherFirst = 0, noHit = 0, blockedColliders = 0;
    for (const level of a.levels) {
      const wins = a.windows.filter(v => v.level === level.id);
      byLevel[level.id] = { floorY: level.y, height: level.h, rooms: level.rooms.length, windows: wins.length, windowedRooms: [...new Set(wins.map(v => v.room))] };
    }
    for (const win of a.windows) {
      const edge = win.axis === 'x' ? (win.c < 0 ? 'north' : 'south') : (win.c < 0 ? 'west' : 'east');
      const key = `${win.level}:${edge}`;
      byFacade[key] = (byFacade[key] || 0) + 1;
      const inward = win.c < 0 ? 1 : -1;
      const innerLine = win.reveal ?? win.c;
      for (const frac of [0.25, 0.5, 0.75]) for (const yOff of [0.4, 0.8, 1.2]) {
        const u = win.a + (win.b - win.a) * frac;
        const y = win.floorY + win.sill + yOff;
        const start = win.axis === 'x' ? new T.Vector3(u, y, innerLine + inward * 0.35) : new T.Vector3(innerLine + inward * 0.35, y, u);
        const dir = win.axis === 'x' ? new T.Vector3(0, 0, -inward) : new T.Vector3(-inward, 0, 0);
        ray.set(start, dir); ray.far = 4;
        const hit = ray.intersectObjects(meshes, false)[0];
        samples++;
        const name = hit?.object.name || 'none';
        if (!hit) { noHit++; blocked.push({ key, room: win.room, u: +u.toFixed(2), yOff, first: name }); }
        else if (name === `Windows_${win.level}` || name === `LitWindows_${win.level}`) glassFirst++;
        else if (name === `Walls_${win.level}` || name === `Exterior_${win.level}`) { wallFirst++; blocked.push({ key, room: win.room, u: +u.toFixed(2), yOff, first: name, distance: +hit.distance.toFixed(3) }); }
        else { otherFirst++; blocked.push({ key, room: win.room, u: +u.toFixed(2), yOff, first: name, distance: +hit.distance.toFixed(3) }); }
      }
      const u = (win.a + win.b) / 2, y = win.floorY + win.sill + 0.8;
      const atAperture = a.colliders.some(c => {
        if (c.kind !== 'wall' || c.y0 > y || c.y1 < y) return false;
        const xLength = Math.abs(c.x2 - c.x1), zLength = Math.abs(c.z2 - c.z1);
        if (win.axis === 'x') return zLength < 0.01 && Math.abs(c.z1 - win.c) < 0.02 && u >= Math.min(c.x1, c.x2) - 0.02 && u <= Math.max(c.x1, c.x2) + 0.02;
        return xLength < 0.01 && Math.abs(c.x1 - win.c) < 0.02 && u >= Math.min(c.z1, c.z2) - 0.02 && u <= Math.max(c.z1, c.z2) + 0.02;
      });
      if (atAperture) blockedColliders++;
    }
    return {
      byLevel, byFacade, windows: a.windows.length, samples, glassFirst, wallFirst, otherFirst, noHit, blockedColliders,
      blocked: blocked.slice(0, 120),
      wallMeshes: a.levels.map(l => ({ level: l.id, interior: !!w.scene.getObjectByName(`Walls_${l.id}`), exterior: !!w.scene.getObjectByName(`Exterior_${l.id}`), glass: !!w.scene.getObjectByName(`Windows_${l.id}`) })),
      missingDoors: a.missingDoors,
    };
  });
  fs.writeFileSync('reports/wallwin/runtime_audit.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
