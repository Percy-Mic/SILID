// The entrance, driven through the game's own target picker (game.interact()
// takes no argument; it resolves the nearest interaction itself). Pointer lock
// is unavailable headless, so this is the closest equivalent of pressing E.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(700);
  const out = await p.evaluate(() => {
    const w = window.__silid;
    const door = w.architecture.doors.find((d) => d.entrance);
    const px = door.axis === 'x' ? door.at : door.c + 1.4;
    const pz = door.axis === 'x' ? door.c + 1.4 : door.at;
    w.spawnAt(px, pz, null, door.axis === 'x' ? 0 : Math.PI / 2, 0);
    w.game.update(0.05);
    const t = w.game.nearestInteraction();
    const mesh = door.mesh;
    const angle = () => +(mesh ? Math.max(Math.abs(mesh.rotation.y), ...mesh.children.map((c) => Math.abs(c.rotation.y))) : -1).toFixed(3);
    const a0 = angle();
    w.game.interact();
    const seen = [];
    for (let i = 0; i < 40; i++) { w.game.update(0.05); seen.push(angle()); }
    const a1 = angle();
    const open = !!door.open;
    w.game.interact();
    for (let i = 0; i < 40; i++) w.game.update(0.05);
    return {
      doorAt: [door.at, door.c], playerAt: [+px.toFixed(2), +pz.toFixed(2)],
      target: t ? { kind: t.kind, name: t.name } : null,
      a0, a1, open, distinctAngles: new Set(seen).size, backTo: +angle().toFixed(3),
      locked: !!door.locked,
    };
  });
  console.log(JSON.stringify({ out, errs }, null, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
