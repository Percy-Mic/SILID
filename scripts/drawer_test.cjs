// Drawer interaction test. Stands the real player in front of each functional
// cabinet, aims at the drawer, presses the actual interact path, and checks:
//   * the prompt appears and names the right action;
//   * the drawer body translates on its slides and stays open;
//   * the interior is a cavity (the front is a separate mesh from the box);
//   * the stored item can be taken and lands in the inventory;
//   * the player is not pushed by the drawer.
const { chromium } = require('playwright');
const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });

  const out = await page.evaluate(() => {
    const s = window.__silid;
    const g = s.game, pl = s.player;
    pl.enabled = true;

    const face = (u, dy, dist = 1.0) => {
      // stand in front of the cabinet front and aim at one particular drawer
      const fx = Math.sin(u.rot), fz = Math.cos(u.rot);    // local +z in world
      const px = u.x + fx * dist, pz = u.z + fz * dist;
      // aim at the front face, not the cabinet centre
      const pitch = Math.atan2(dy - 1.68, dist - u.d / 2);
      // facing the cabinet is facing -front; yaw for direction d is atan2(-dx,-dz)
      s.spawnAt(px, pz, u.y, Math.atan2(fx, fz), pitch);
      return { px, pz };
    };

    const ensureOpen = () => {
      const t = g.nearestInteraction();
      if (t?.kind === 'drawer' && !t.drawer.open) g.interact();
    };

    const rows = [];
    // Cupboards share the cabinets registry but have doors, not drawer stacks.
    for (const u of s.cabinets.units.filter((u) => u.drawers.length)) {
      const want = u.drawers.find((d) => d.contents) || u.drawers[0];
      const start = face(u, want.yc);
      g.update(0.05);
      const target = g.nearestInteraction();
      const drawer = target?.drawer;
      const before = { x: pl.pos.x, z: pl.pos.z };
      const hz0 = drawer ? drawer.holder.position.z : 0;
      g.interact();
      for (let i = 0; i < 90; i++) { g.update(0.033); }
      const hz1 = drawer ? drawer.holder.position.z : 0;
      const pulled = { x: pl.pos.x, z: pl.pos.z };

      // search (if it stores something), then close — each its own press
      let itemTaken = null;        const c = drawer?.contents;
        if (c) {
        // make sure it is the drawer we aimed at that is open
        if (!drawer.open) g.interact();
        for (let i = 0; i < 60; i++) g.update(0.033);
        g.update(0.05);
        const prompt = document.getElementById('prompt')?.textContent || '';
        const n = g.inventory.size;
        g.interact();
        itemTaken = {
          prompt, gained: g.inventory.size > n,
          taken: c.taken, inventory: [...g.inventory],
        };
        for (let i = 0; i < 20; i++) g.update(0.033);
      }

      // close again through the same path
      g.update(0.05);
      const t3 = g.nearestInteraction();
      g.interact();
      for (let i = 0; i < 80; i++) g.update(0.033);

      rows.push({
        label: u.label, room: u.room,
        start, targetId: target?.id || null,
        promptKind: target?.kind || null,
        promptName: target?.name || null,
        travel: +(hz1 - hz0).toFixed(3),
        pushed: +Math.hypot(pulled.x - before.x, pulled.z - before.z).toFixed(3),
        closeTarget: t3?.id || null,
        closedAgain: drawer ? !drawer.open : null,
        itemTaken,
      });
    }

    // a drawer's cavity is not a solid cube: count the separate meshes in the
    // moving drawer group and confirm the front is its own object
    const u0 = s.cabinets.units.find((u) => u.drawers.length);
    const d0 = u0.drawers[0];
    const meshNames = [];
    d0.holder.traverse((o) => { if (o.isMesh) meshNames.push(o.material?.name || '?'); });
    return { rows, drawerMeshes: meshNames, drawerMeshCount: meshNames.length };
  });

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
