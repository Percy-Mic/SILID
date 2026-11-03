const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const out = {};
    const grid = r.gridFor('F2');
    // flood from f_hall cell
    const start = r.nearestWalkable(grid, 2.5, 5.5);
    out.start = start;
    const seen = new Uint8Array(grid.walk.length);
    const q = [start.gx * 38 + start.gz];
    seen[q[0]] = 1;
    let n = 0;
    while (q.length) {
      const i = q.pop(); n++;
      const gx = Math.floor(i / 38), gz = i % 38;
      for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=gx+dx, nz=gz+dz;
        if (nx<0||nx>=82||nz<0||nz>=38) continue;
        const ni=nx*38+nz;
        if (!grid.walk[ni] || seen[ni]) continue;
        seen[ni]=1; q.push(ni);
      }
    }
    out.reachable = n;
    const probe = (x,z) => {
      const c = r.nearestWalkable(grid, x, z, 9);
      return c ? { gx:c.gx, gz:c.gz, x:+( -23.4+(c.gx+0.5)*0.55).toFixed(2), z:+(-10.4+(c.gz+0.5)*0.55).toFixed(2), reachable: !!seen[c.gx*38+c.gz] } : null;
    };
    out.targets = {
      master: probe(-2,-6), bed3: probe(-10,-6), hall: probe(2.5,5.5),
      landing: probe(0,0), masterDoor: probe(-2,-2.5), stairFan: probe(-4.5,6.4),
      masterCenter: probe(-4,-4),
    };
    // blocked reasons along a line near the master door
    out.masterDoorCols = s.architecture.colliders.filter(c => !c.disabled &&
      c.x1 < -0.5 && c.x2 > -3.5 && c.z1 < -0.5 && c.z2 > -4).map(c=>({kind:c.kind,x1:+c.x1.toFixed(2),x2:+c.x2.toFixed(2),z1:+c.z1.toFixed(2),z2:+c.z2.toFixed(2),y0:c.y0,y1:c.y1}));
    out.propCols = s.props.colliders.filter(c => c.x1 < -0.5 && c.x2 > -3.5 && c.z1 < -0.5 && c.z2 > -4 && c.y0 < 5 && c.y1 > 4.2).map(c=>({kind:c.kind,x1:+c.x1.toFixed(2),x2:+c.x2.toFixed(2),z1:+c.z1.toFixed(2),z2:+c.z2.toFixed(2)}));
    // path results
    r.pos.set(2.5,0,5.5); r.footY=4.2; r.level='F2';
    out.pathToMaster = r.planTo(-2,-6,'F2').length;
    out.pathToBed3 = r.planTo(-10,-6,'F2').length;
    out.pathToLanding = r.planTo(0,0,'F2').length;
    return out;
  }), null, 1));
  await b.close();
})();
