// Frame probe for the in-hand phone.
//
// The held phone is a real object parented to the camera, so "is it in frame"
// is a projection question, not an opinion about the screenshot. This boots the
// game, takes the phone and projects the eight corners of the model (the pickup
// marker excluded, it is invisible) into normalised device coordinates. A model
// that runs off the right edge has maxX above 1.
//
// Usage: node scripts/phone_frame_probe.cjs
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000, polling: 500 });
  await page.waitForFunction(() => window.__silid.game?._phoneInfo != null, null, { timeout: 90000, polling: 200 })
    .catch(() => errors.push('PHONE NEVER LOADED'));

  const out = await page.evaluate(() => {
    const w = window.__silid;
    const THREE = w.THREE;
    const spot = w.props.interactables.find((i) => i.id === 'phone');
    const dist = 1.15;
    w.spawnAt(spot.x, spot.z + dist, spot.surfaceY - 0.02, 0, Math.atan2(spot.y - (spot.surfaceY + 1.68), dist));
    w.game.update(0.05);
    w.game.nearestInteraction();
    w.game.interact();
    for (let i = 0; i < 20; i++) w.game.update(0.033);

    const held = w.game.heldPhoneGroup;
    const cam = w.player.camera;
    if (!held) return { held: false };

    const phoneOnly = new THREE.Group();
    const bodyBox = new THREE.Box3();
    // measure the phone's own geometry: the group's children are meshes plus the
    // invisible marker, and camera-space maths needs the model's own extents
    const pts = [];
    held.updateMatrixWorld(true);
    for (const c of held.children) {
      if (!c.isMesh || c.userData.isPhoneMarker) continue;
      c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox;
      bodyBox.union(bb.clone().applyMatrix4(c.matrix));
      for (const x of [bb.min.x, bb.max.x]) {
        for (const y of [bb.min.y, bb.max.y]) {
          for (const z of [bb.min.z, bb.max.z]) {
            const v = new THREE.Vector3(x, y, z).applyMatrix4(c.matrix).applyMatrix4(held.matrixWorld);
            pts.push(v.clone().project(cam));
          }
        }
      }
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const localCentre = bodyBox.getCenter(new THREE.Vector3());
    return {
      held: true,
      fov: cam.fov,
      aspect: +cam.aspect.toFixed(3),
      pose: { pos: held.position.toArray().map((v) => +v.toFixed(3)), rot: held.rotation.toArray().slice(0, 3).map((v) => +v.toFixed(3)) },
      bodyLocalY: [+bodyBox.min.y.toFixed(3), +bodyBox.max.y.toFixed(3)],
      bodyLocalX: [+bodyBox.min.x.toFixed(3), +bodyBox.max.x.toFixed(3)],
      ndc: {
        minX: +minX.toFixed(3), maxX: +maxX.toFixed(3),
        minY: +minY.toFixed(3), maxY: +maxY.toFixed(3),
      },
      // fraction of the screen (0..1) the phone covers, clipped to the frame
      screen: {
        leftPct: +(((minX + 1) / 2) * 100).toFixed(1),
        rightPct: +(((maxX + 1) / 2) * 100).toFixed(1),
        bottomPct: +(((maxY + 1) / 2) * 100).toFixed(1),
        topPct: +(((minY + 1) / 2) * 100).toFixed(1),
      },
      clippedRight: maxX > 1,
      clippedBottom: minY < -1,
      camWorld: cam.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)),
    };
  });

  console.log(JSON.stringify({ ...out, errors }, null, 1));
  await browser.close().catch(() => {});
})();
