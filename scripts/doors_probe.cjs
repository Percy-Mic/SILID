// THE DOOR AUDIT.
//
// Every leaf in the house is measured against the opening it claims to fill:
// which rooms it serves, whether its closed collider matches that opening, how
// thick the leaf actually is, and — the one nobody could see from a screenshot
// — whether the swing arc runs through a wall, a stair or a chest of drawers.
// Then a representative set is driven through the real prompt path: stand in
// front of it, ask the game what it offers, press E, let the animation run, and
// check collision before and after.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.env.SILID_OUT || 'reports/doors';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(900);

  const audit = await page.evaluate(() => {
    const w = window.__silid;
    const A = w.architecture;
    const THREE = w.THREE;
    const levels = Object.fromEntries(w.levels.map((l) => [l.id, l]));
    const box = new THREE.Box3();
    const vec = new THREE.Vector3();

    const leafBox = (obj) => {
      obj.updateMatrixWorld(true);
      box.setFromObject(obj);
      const r = (n) => +n.toFixed(3);
      return {
        min: [r(box.min.x), r(box.min.y), r(box.min.z)],
        max: [r(box.max.x), r(box.max.y), r(box.max.z)],
        size: [r(box.max.x - box.min.x), r(box.max.y - box.min.y), r(box.max.z - box.min.z)],
      };
    };

    // point-in-wall test for the swing arc. The door's own collider is the
    // opening, not a wall, so it is excluded: a closed leaf is not a clearance
    // problem for itself.
    const blockers = (d) => A.colliders.filter((c) => c && !c.disabled && c !== d.collider
      && !(c.y1 <= d.y + 0.06 || c.y0 >= d.y + d.head - 0.02));

    const hits = (d, x, z, cols) => {
      let n = 0;
      for (const c of cols) {
        const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
        const l = dx * dx + dz * dz;
        let t = l ? ((x - c.x1) * dx + (z - c.z1) * dz) / l : 0;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(x - (c.x1 + t * dx), z - (c.z1 + t * dz)) < 0.12) n++;
      }
      return n;
    };

    const sweep = (d, obj, sign) => {
      obj.updateMatrixWorld(true);
      const hinge = obj.getWorldPosition(new THREE.Vector3());
      const tip = obj.children[0].localToWorld(new THREE.Vector3(d.leafW, 0, 0));
      const dx = tip.x - hinge.x, dz = tip.z - hinge.z;
      const L = Math.hypot(dx, dz) || 1;
      const cols = blockers(d);
      let blocked = 0, total = 0;
      const openTip = { x: 0, z: 0 };
      for (let ai = 3; ai <= 9; ai++) {
        const a = (ai / 9) * 1.35 * sign;
        const ca = Math.cos(a), sa = Math.sin(a);
        const rx = (dx * ca + dz * sa) / L, rz = (-dx * sa + dz * ca) / L;
        if (ai === 9) { openTip.x = hinge.x + rx * d.leafW; openTip.z = hinge.z + rz * d.leafW; }
        for (let ri = 0; ri <= 5; ri++) {
          const r = 0.35 + ((d.leafW - 0.40) * ri) / 5;
          total++;
          if (hits(d, hinge.x + rx * r, hinge.z + rz * r, cols)) blocked++;
        }
      }
      return {
        blocked, total, pct: +(100 * blocked / total).toFixed(0),
        openTip: [+openTip.x.toFixed(2), +openTip.z.toFixed(2)],
      };
    };

    const roomsAt = (level, x, z) => (level.rooms || [])
      .filter((r) => x >= r.x0 - 0.02 && x <= r.x1 + 0.02 && z >= r.z0 - 0.02 && z <= r.z1 + 0.02)
      .map((r) => r.name);

    const out = [];
    for (const d of A.doors) {
      const lv = levels[d.level];
      const cx = d.axis === 'x' ? d.at : d.c;
      const cz = d.axis === 'x' ? d.c : d.at;
      const nx = d.axis === 'x' ? 0 : 1, nz = d.axis === 'x' ? 1 : 0;
      const leaf = d.leafW ? d.leafW : d.w - 0.05;
      const seg = d.closedSeg;
      const openX = d.axis === 'x' ? d.w / 2 : 0;
      const segOk = seg && Math.abs((seg.x2 - seg.x1) - 2 * openX) < 0.02
        && Math.abs((seg.z2 - seg.z1) - (d.axis === 'x' ? 0 : d.w)) < 0.02;
      const mount = [];
      let sweepData;
      if (d.mesh2) {
        mount.push(leafBox(d.mesh), leafBox(d.mesh2));
        sweepData = [sweep(d, d.mesh, d.swingSign), sweep(d, d.mesh2, -d.swingSign)];
      } else {
        mount.push(leafBox(d.mesh));
        sweepData = [sweep(d, d.mesh, d.swingSign)];
      }
      out.push({
        altSign: d.entrance ? null : sweep(d, d.mesh, -d.swingSign).pct,
        key: `${d.level}_${d.axis}_${d.at}_${d.c}`,
        level: d.level, axis: d.axis, at: d.at, c: d.c,
        w: d.w, head: d.head, y: d.y, style: d.style, entrance: !!d.entrance,
        arch: !!d.arch, open: d.open, leafW: +leaf.toFixed(3),
        rooms: [
          ...roomsAt(lv, cx + nx * 0.5, cz + nz * 0.5),
          ...roomsAt(lv, cx - nx * 0.5, cz - nz * 0.5),
        ],
        colliderOk: segOk,
        colliderDisabled: !!d.collider?.disabled,
        hasCollider: !!d.collider,
        leaves: mount,
        thickness: Math.min(...mount.map((m) => (d.axis === 'x' ? m.size[2] : m.size[0]))),
        sweep: sweepData,
      });
    }
    return out;
  });

  // --- representative doors, driven through the prompt path -----------------
  const pick = (level, axis, at, c) => ({ level, axis, at, c });
  const cases = [
    { label: 'entrance outside', door: pick('GF', 'x', 0, 11), sx: 0, sz: 12.7, side: 'outside' },
    { label: 'entrance inside', door: pick('GF', 'x', 0, 11), sx: 0, sz: 9.3, side: 'inside' },
    { label: 'guest room 1 (bedroom)', door: pick('GF', 'z', 9.5, -17), sx: -15.6, sz: 9.5, side: 'hall' },
    { label: 'formal living', door: pick('GF', 'x', -10, 2), sx: -10, sz: 0.8, side: 'gallery' },
    { label: 'basement cellar', door: pick('B1', 'x', -18, -5.4), sx: -18, sz: -4.0, side: 'landing' },
    { label: 'locked study F3', door: pick('F3', 'x', 13, 4), sx: 11.7, sz: 4, side: 'walkway' },
  ];

  const results = [];
  for (const c of cases) {
    const setup = await page.evaluate((c) => {
      const w = window.__silid;
      const d = w.architecture.doors.find((d) => d.level === c.door.level && d.axis === c.door.axis
        && Math.abs(d.at - c.door.at) < 0.01 && Math.abs(d.c - c.door.c) < 0.01);
      if (!d) return { error: 'door not found' };
      if (d.open) { d.open = false; d.target = 0; d.mesh.rotation.y = 0; if (d.mesh2) d.mesh2.rotation.y = 0; d.collider.disabled = false; }
      const cx = d.axis === 'x' ? d.at : d.c, cz = d.axis === 'x' ? d.c : d.at;
      const yaw = Math.atan2(-(cx - c.sx), -(cz - c.sz));
      w.spawnAt(c.sx, c.sz, d.y + 0.02, yaw, 0);
      w.game.update(0.016);
      const t = w.game.nearestInteraction();
      return {
        key: `${d.level}_${d.axis}_${d.at}_${d.c}`,
        offered: t ? t.kind : null,
        offeredName: t?.name ?? null,
        same: !!(t && t.kind === 'door' && t.door === d),
        blockedBefore: w.player.blocked(cx, cz),
        leafBefore: +d.mesh.rotation.y.toFixed(2),
      };
    }, c);

    let opened = null, closed = null, locked = null;
    if (setup && !setup.error) {
      if (c.label.includes('locked')) {
        locked = await page.evaluate((key) => {
          const w = window.__silid;
          const d = w.architecture.doors.find((d) => `${d.level}_${d.axis}_${d.at}_${d.c}` === key);
          w.game.state.hasKey = false;
          w.game.interact();
          const first = { open: d.open, line: document.getElementById('msg')?.textContent ?? null };
          w.game.state.hasKey = true;
          w.game.interact();
          return { first, afterKey: { open: d.open, disabled: d.collider.disabled } };
        }, setup.key);
        await page.waitForTimeout(700);
      } else {
        await page.evaluate(() => window.__silid.game.interact());
        await page.evaluate(() => { for (let i = 0; i < 90; i++) window.__silid.game.update(1 / 60); });
        await page.waitForTimeout(120);
        opened = await page.evaluate((key) => {
          const w = window.__silid;
          const d = w.architecture.doors.find((d) => `${d.level}_${d.axis}_${d.at}_${d.c}` === key);
          const cx = d.axis === 'x' ? d.at : d.c, cz = d.axis === 'x' ? d.c : d.at;
          return {
            open: d.open,
            rot: +(d.mesh2 ? d.mesh.rotation.y : d.mesh.rotation.y).toFixed(2),
            rot2: d.mesh2 ? +d.mesh2.rotation.y.toFixed(2) : null,
            disabled: d.collider.disabled,
            blockedCentre: w.player.blocked(cx, cz),
          };
        }, setup.key);
        await page.evaluate(() => window.__silid.game.interact());
        await page.evaluate(() => { for (let i = 0; i < 90; i++) window.__silid.game.update(1 / 60); });
        await page.waitForTimeout(120);
        closed = await page.evaluate((key) => {
          const w = window.__silid;
          const d = w.architecture.doors.find((d) => `${d.level}_${d.axis}_${d.at}_${d.c}` === key);
          const cx = d.axis === 'x' ? d.at : d.c, cz = d.axis === 'x' ? d.c : d.at;
          return {
            open: d.open,
            rot: +d.mesh.rotation.y.toFixed(2),
            rot2: d.mesh2 ? +d.mesh2.rotation.y.toFixed(2) : null,
            disabled: d.collider.disabled,
            blockedCentre: w.player.blocked(cx, cz),
          };
        }, setup.key);
      }
    }
    results.push({ label: c.label, ...setup, opened, closed, locked });
    console.log('case', c.label, JSON.stringify({ offered: setup.offered, same: setup.same, opened, closed, locked }));
  }

  const metrics = await page.evaluate(() => window.__silid.metrics());
  const report = {
    when: new Date().toISOString(),
    pageErrors: errors,
    counts: {
      doors: audit.length,
      byStyle: audit.reduce((m, d) => { m[d.style] = (m[d.style] || 0) + 1; return m; }, {}),
      byLevel: audit.reduce((m, d) => { m[d.level] = (m[d.level] || 0) + 1; return m; }, {}),
      entrances: audit.filter((d) => d.entrance).length,
      arches: audit.filter((d) => d.arch).length,
      colliderMismatch: audit.filter((d) => d.hasCollider && !d.colliderOk).map((d) => d.key),
      blockedSwings: audit.filter((d) => d.sweep.some((s) => s.pct >= 15)).map((d) => ({
        key: d.key, style: d.style, rooms: d.rooms, pct: d.sweep.map((s) => s.pct),
      })),
      thinLeaves: audit.filter((d) => d.thickness < 0.07).map((d) => ({ key: d.key, t: d.thickness })),
      duplicateKeys: audit.map((d) => d.key).filter((k, i, a) => a.indexOf(k) !== i),
    },
    metrics,
    interaction: results,
    doors: audit,
  };
  fs.writeFileSync(path.join(OUT, 'doors_audit.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.counts, null, 1));
  console.log('metrics', JSON.stringify(metrics));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
