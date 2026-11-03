const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 500 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, r = w.resident;
    const door = w.architecture.doors.find((d) => d.level === 'GF' && d.collider);
    const cx = door.axis === 'x' ? door.at : door.c;
    const cz = door.axis === 'x' ? door.c : door.at;
    const nx = door.axis === 'x' ? 0 : 1, nz = door.axis === 'x' ? 1 : 0;
    door.open = false; door.target = 0; door.mesh.rotation.y = 0; door.collider.disabled = false;
    r.pos.set(cx - nx * 0.8, 0, cz - nz * 0.8); r.footY = door.y;
    const px = cx + nx * 0.9, pz = cz + nz * 0.9;
    // the collider as the sight test sees it
    const cols = w.architecture.colliders.filter((c) => !c.disabled && Math.hypot(
      (Math.max(c.x1, Math.min(cx, c.x2)) - cx), (Math.max(c.z1, Math.min(cz, c.z2)) - cz)) < 1.2);
    return {
      door: { axis: door.axis, at: door.at, c: door.c, y: door.y, open: door.open, disabled: door.collider.disabled,
        kind: door.collider.kind, x1: door.collider.x1, x2: door.collider.x2, z1: door.collider.z1, z2: door.collider.z2,
        y0: door.collider.y0, y1: door.collider.y1 },
      blocked: r.sightBlocked(r.pos.x, r.pos.z, px, pz, r.footY + 1.3),
      eyeY: r.footY + 1.3,
      near: cols.map((c) => ({ k: c.kind, x1: +c.x1.toFixed(2), z1: +c.z1.toFixed(2), x2: +c.x2.toFixed(2), z2: +c.z2.toFixed(2), y0: c.y0, y1: c.y1 })),
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
