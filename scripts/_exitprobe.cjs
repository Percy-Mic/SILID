const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, g = s.game, pl = s.player;
    const a = s.hiding.spots.find(x => x.type === 'armoire' && x.level === 'F2');
    pl.teleport(a.out.x, a.out.z, a.levelY);
    const hits = [];
    for (const c of s.architecture.colliders) {
      if (c.disabled) continue;
      const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
      const l = dx*dx+dz*dz; let t = l ? ((pl.pos.x-c.x1)*dx+(pl.pos.z-c.z1)*dz)/l : 0;
      t = Math.max(0,Math.min(1,t));
      const d = Math.hypot(pl.pos.x-(c.x1+t*dx), pl.pos.z-(c.z1+t*dz));
      if (d < 0.5 && (c.y0===undefined || (pl.footY+1.65>c.y0 && pl.footY+0.05<c.y1))) hits.push({kind:c.kind, x1:c.x1,x2:c.x2,z1:c.z1,z2:c.z2,y0:c.y0,y1:c.y1,d:+d.toFixed(2)});
    }
    for (const c of s.props.colliders) {
      if (pl.pos.x > c.x1-0.4 && pl.pos.x < c.x2+0.4 && pl.pos.z > c.z1-0.4 && pl.pos.z < c.z2+0.4 && pl.footY+1.65>c.y0 && pl.footY+0.05<c.y1) hits.push({kind:c.kind,x1:c.x1,x2:c.x2,z1:c.z1,z2:c.z2,y0:c.y0,y1:c.y1,box:true});
    }
    return { armoire: {x:a.x,z:a.z,rot:a.rot,out:a.out,inside:a.inside}, player:{x:pl.pos.x,z:pl.pos.z,foot:pl.footY}, hits };
  }), null, 1));
  await b.close();
})();
