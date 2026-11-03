const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, g = s.game, pl = s.player;
    const u = s.cabinets.units[0];
    const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
    const px = u.x + fx * 1.0, pz = u.z + fz * 1.0;
    const pitch = Math.atan2(u.drawers[0].yc - 1.68, 1.0);
    s.spawnAt(px, pz, u.y, Math.atan2(fx, fz), pitch);
    pl.update(0.016, g);
    const fwd = pl.forward();
    const eye = pl.pos;
    const rows = s.props.interactables.filter(i => i.unit === u).map(i => {
      const dx = i.x - eye.x, dy = i.y - eye.y, dz = i.z - eye.z;
      const d = Math.hypot(dx,dy,dz);
      const dot3 = (dx*fwd.x + dy*fwd.y + dz*fwd.z)/d;
      return { id:i.id, y:+i.y.toFixed(2), dy:+dy.toFixed(2), d:+d.toFixed(2), dot3:+dot3.toFixed(3) };
    });
    return { eye:{x:+eye.x.toFixed(2),y:+eye.y.toFixed(2),z:+eye.z.toFixed(2)}, yaw:+pl.yaw.toFixed(2), pitch:+pl.pitch.toFixed(2), fwd:{x:+fwd.x.toFixed(2),y:+fwd.y.toFixed(2),z:+fwd.z.toFixed(2)}, rows, nearest: g.nearestInteraction()?.id };
  }), null, 1));
  await b.close();
})();
