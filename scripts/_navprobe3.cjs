const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const pt = { x: -18, z: 2 };
    const out = { blocked: r.blockedAt(pt.x, pt.z, 4.2), arch: [], props: [], floor: s.floorAt(pt.x, pt.z, 4.2) };
    for (const c of s.architecture.colliders) {
      if (c.disabled) continue;
      const dx=c.x2-c.x1, dz=c.z2-c.z1, l=dx*dx+dz*dz;
      let t=l?((pt.x-c.x1)*dx+(pt.z-c.z1)*dz)/l:0; t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(pt.x-(c.x1+t*dx), pt.z-(c.z1+t*dz));
      if (d<0.7) out.arch.push({kind:c.kind,d:+d.toFixed(2),x1:+c.x1.toFixed(2),x2:+c.x2.toFixed(2),z1:+c.z1.toFixed(2),z2:+c.z2.toFixed(2),y0:c.y0,y1:c.y1});
    }
    for (const c of s.props.colliders) {
      if (pt.x>c.x1-0.5&&pt.x<c.x2+0.5&&pt.z>c.z1-0.5&&pt.z<c.z2+0.5&&c.y0<5.8&&c.y1>4.3) out.props.push({x1:+c.x1.toFixed(2),x2:+c.x2.toFixed(2),z1:+c.z1.toFixed(2),z2:+c.z2.toFixed(2),y0:c.y0,y1:c.y1});
    }
    // scan a line across the doorway
    out.scan = [];
    for (let z=1.0; z<=3.0; z+=0.2) out.scan.push({z:+z.toFixed(1), blocked:r.blockedAt(-18,z,4.2), walk: r.gridFor('F2').walk[r.cellOf(-18,z).gx*38+r.cellOf(-18,z).gz]});
    return out;
  }), null, 1));
  await b.close();
})();
