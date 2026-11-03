// Slab + phone probe.
//
// One verification pass for the floors and the phone, in the running game
// rather than in source:
//
//   * every storey is a slab with real thickness, and its plan is cut for the
//     stair well and the courtyard — a ray dropped down the well must pass
//     through F4, F3 and F2 and land on the basement slab, which is exactly
//     what the old footprint-sized box failed;
//   * a horizontal ray inside the well must meet a VERTICAL face at the rim:
//     the floor edge the player sees the thickness of from the staircase;
//   * the phone is the supplied GLB — measured size, its own materials and
//     textures, on the console in the world and in the hand after pickup.
//
// It waits for the phone, because the GLB is a fetch plus two JPEG decodes and
// reading `_phoneInfo` too early reports "not loaded" for a model that is
// merely still arriving. Frames are capped: a software GL context dies after
// about eight CDP captures.
//
// Usage: node scripts/slab_phone_probe.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/slabphone';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000, polling: 500 });

  const t0 = Date.now();
  await page.waitForFunction(() => window.__silid.game?._phoneInfo != null, null, { timeout: 90000, polling: 200 })
    .catch(() => errors.push('PHONE NEVER LOADED'));
  const phoneLoadMs = Date.now() - t0;

  const measured = await page.evaluate(() => {
    const w = window.__silid;
    const THREE = w.THREE;
    const out = {};

    const slabOf = (id) => {
      const m = w.scene.getObjectByName('Floor_' + id);
      if (!m) return null;
      const b = new THREE.Box3().setFromObject(m);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const fr = w.scene.getObjectByName('WellFraming_' + id);
      return {
        thickness: +(b.max.y - b.min.y).toFixed(3),
        top: +b.max.y.toFixed(3),
        materials: mats.map((x) => x.name),
        soffit: !!w.scene.getObjectByName('Soffit_' + id),
        framingTris: fr ? fr.geometry.attributes.position.count / 3 : 0,
      };
    };
    out.slabs = {};
    for (const id of ['B1', 'GF', 'F2', 'F3', 'F4']) out.slabs[id] = slabOf(id);

    const slabs = [];
    w.scene.traverse((o) => { if (o.isMesh && /^(Floor_|Soffit_|WellFraming_)/.test(o.name)) slabs.push(o); });
    out.slabMeshes = slabs.length;
    const ray = new THREE.Raycaster();
    const probe = (x, z, y, dir = [0, -1, 0]) => {
      ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(...dir).normalize());
      ray.far = 60;
      return ray.intersectObjects(slabs, false).map((h) => ({
        n: h.object.name, y: +h.point.y.toFixed(3),
        faceY: +(h.face ? h.face.normal.y : 0).toFixed(2),
        faceVertical: h.face ? Math.abs(h.face.normal.y) < 0.2 : null,
      }));
    };
    out.downWell = probe(-1.5, 7.5, 11.0);        // must reach the basement
    out.downFoyer = probe(-1.5, 3.0, 11.0);       // must stop on every slab
    out.downCourtyard = probe(14, -1.5, 11.0);    // void: basement slab only
    out.wellReveal = probe(-1.5, 7.5, 4.2 - 0.0825, [0, 0, 1]);
    out.foyerLookUp = probe(-1.5, 3.0, 0.5, [0, 1, 0]);

    const info = w.game._phoneInfo;
    out.phone = info ? {
      sizeM: info.size.toArray().map((v) => +v.toFixed(4)),
      sourceSize: info.sourceSize.toArray().map((v) => +v.toFixed(3)),
      scale: +info.scale.toFixed(5),
      parts: info.parts.map((p) => ({ n: p.name, mat: p.matName, map: !!p.src?.map, emissiveMap: !!p.src?.emissiveMap })),
    } : null;

    const spot = w.props.interactables.find((i) => i.id === 'phone');
    out.spot = spot && { x: +spot.x.toFixed(2), y: +spot.y.toFixed(2), z: +spot.z.toFixed(2), surfaceY: +spot.surfaceY.toFixed(3), room: spot.room };
    out.console = w.props.placed.filter((p) => p.name === 'console' && p.room === 'GF-14').length;
    const world = w.scene.getObjectByName('phone_world');
    if (world) {
      const b = new THREE.Box3().setFromObject(world);
      out.worldPhone = {
        visible: world.visible, baseY: +b.min.y.toFixed(3),
        spanY: +(b.max.y - b.min.y).toFixed(3),
        spanX: +(b.max.x - b.min.x).toFixed(3),
        spanZ: +(b.max.z - b.min.z).toFixed(3),
        meshes: world.children.filter((c) => c.isMesh).length,
        parent: world.parent?.type || world.parent?.name,
      };
    } else out.worldPhone = null;
    out.metrics = w.metrics?.();
    return out;
  });

  const cdp = await page.context().newCDPSession(page);
  async function capture(name) {
    for (let i = 0; i < 3; i++) {
      try {
        const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(png.data, 'base64'));
        console.log('shot', name);
        return true;
      } catch (err) {
        console.log('shot', name, 'retry', i + 1, err.message);
        await new Promise((r) => setTimeout(r, 900));
      }
    }
    return false;
  }

  // the slab the player sees standing on the spiral
  await page.evaluate(() => {
    const w = window.__silid;
    w.spawnAt(-1.5, 10.15, 4.2, 0, -0.92);
    w.player.flashlightOn = true; w.player.flash.visible = true; w.game._lightTimer = 0;
    for (let i = 0; i < 6; i++) w.game.update(0.033);
  });
  await page.waitForTimeout(500);
  const shotRim = await capture('f2_rim_from_stair');

  // the underside and the framing, from the foyer floor
  await page.evaluate(() => {
    const w = window.__silid;
    w.spawnAt(-1.5, 3.0, 0, Math.PI, 0.95);
    for (let i = 0; i < 6; i++) w.game.update(0.033);
  });
  await page.waitForTimeout(500);
  const shotSoffit = await capture('foyer_soffit_framing');

  // the phone where it lies
  const seePhone = await page.evaluate(() => {
    const w = window.__silid;
    const spot = w.props.interactables.find((i) => i.id === 'phone');
    const dist = 1.15;
    w.spawnAt(spot.x, spot.z + dist, spot.surfaceY - 0.02, 0, Math.atan2(spot.y - (spot.surfaceY + 1.68), dist));
    w.player.flashlightOn = true; w.player.flash.visible = true;
    for (let i = 0; i < 8; i++) w.game.update(0.033);
    const focus = w.game.nearestInteraction();
    return { focus: focus?.name ?? null, kind: focus?.kind ?? null };
  });
  await page.waitForTimeout(500);
  const shotConsole = await capture('phone_on_console');

  // Take it in one go: focus and interact have to be in the same evaluate, or
  // the frames that run in between settle the prompt onto the console instead.
  const taken = await page.evaluate(() => {
    const w = window.__silid;
    const spot = w.props.interactables.find((i) => i.id === 'phone');
    const dist = 1.15;
    w.spawnAt(spot.x, spot.z + dist, spot.surfaceY - 0.02, 0, Math.atan2(spot.y - (spot.surfaceY + 1.68), dist));
    w.game.update(0.05);
    const focus = w.game.nearestInteraction();
    w.game.interact();
    for (let i = 0; i < 30; i++) w.game.update(0.033);
    const held = w.game.heldPhoneGroup;
    const meshes = held ? held.children.filter((c) => c.isMesh) : [];
    const box = held ? new w.THREE.Box3().setFromObject(held) : null;
    return {
      focus: focus?.name ?? null,
      inventory: [...w.game.inventory],
      held: !!held,
      parent: held?.parent?.type ?? null,
      meshes: meshes.map((c) => ({ n: c.name, order: c.renderOrder, depthTest: c.material.depthTest, map: !!c.material.map, emissiveMap: !!c.material.emissiveMap })),
      worldPhoneVisible: w.game.worldPhone?.visible ?? null,
      markerVisible: w.game.pickupMeshes.get('phone')?.visible ?? null,
      heldSpanY: box ? +(box.max.y - box.min.y).toFixed(3) : null,
      heldSpanX: box ? +(box.max.x - box.min.x).toFixed(3) : null,
    };
  });
  await page.waitForTimeout(400);
  const shotHeld = await capture('phone_in_hand');

  console.log(JSON.stringify({ phoneLoadMs, ...measured, shots: { rim: shotRim, soffit: shotSoffit, console: shotConsole, held: shotHeld }, seePhone, taken, errors }, null, 1));
  await browser.close().catch(() => {});
})();
