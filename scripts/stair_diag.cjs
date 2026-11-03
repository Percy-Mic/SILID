// What is actually in front of the eye at the stair shot points, and what is
// overhead. Read-only: it spawns, casts rays through the real scene graph and
// prints the first named mesh each ray meets, so a photograph that looks like a
// wall of timber can be traced to the object that made it.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const PTS = [
  { name: '01_foot', x: -4.29, z: 10.4, y: 0, yaw: 0, pitch: 0.16 },
  { name: '02_first_flight', x: -4.29, z: 8.9, y: 0.2, yaw: 0, pitch: 0.10 },
  { name: '03_half_landing', x: -4.2, z: 5.1, y: 2.1, yaw: -Math.PI / 2, pitch: -0.02 },
  { name: '04_f2_arrival', x: -2.87, z: 10.2, y: 4.2, yaw: Math.PI, pitch: -0.10 },
  { name: '05_well_from_f2', x: -5.2, z: 5.0, y: 4.2, yaw: -1.2, pitch: -0.25 },
  { name: '06_looking_up', x: -3.6, z: 9.0, y: 0, yaw: 0, pitch: 0.55 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });

  const out = await page.evaluate((PTS) => {
    const w = window.__silid, T = w.THREE;
    const res = [];
    for (const p of PTS) {
      w.spawnAt(p.x, p.z, p.y, p.yaw, p.pitch);
      const eye = w.player.eye ? w.player.eye() : null;
      const cam = w.camera;
      const origin = cam.position.clone();
      // forward through the camera's own matrix
      const fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
      const rc = new T.Raycaster(origin, fwd, 0.001, 40);
      const hits = rc.intersectObject(w.scene, true).slice(0, 4).map((h) => ({
        name: h.object.name || h.object.type,
        parent: h.object.parent && h.object.parent.name,
        d: +h.distance.toFixed(3),
        y: +h.point.y.toFixed(2),
      }));
      // straight down: what is the eye standing over
      const rd = new T.Raycaster(origin, new T.Vector3(0, -1, 0), 0.001, 12);
      const down = rd.intersectObject(w.scene, true).slice(0, 3).map((h) => ({
        name: h.object.name || h.object.type, d: +h.distance.toFixed(3), y: +h.point.y.toFixed(2),
      }));
      // straight up: head clearance
      const ru = new T.Raycaster(origin.clone().setY(origin.y), new T.Vector3(0, 1, 0), 0.001, 12);
      const up = ru.intersectObject(w.scene, true).slice(0, 2).map((h) => ({
        name: h.object.name || h.object.type, d: +h.distance.toFixed(3), y: +h.point.y.toFixed(2),
      }));
      res.push({
        name: p.name, pos: [+origin.x.toFixed(2), +origin.y.toFixed(2), +origin.z.toFixed(2)],
        foot: +w.player.footY.toFixed(2), fwd: hits, down, up,
        floorAt: w.architecture ? (typeof w.architecture.floorHeightAt === 'function'
          ? +w.architecture.floorHeightAt(origin.x, origin.z, origin.y).toFixed(2) : null) : null,
      });
    }
    return res;
  }, PTS);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
