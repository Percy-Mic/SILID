const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const grid = r.gridFor('F2');
    const start = r.nearestWalkable(grid, 2.5, 5.5);
    const seen = new Uint8Array(grid.walk.length);
    const q = [start.gx * 38 + start.gz]; seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop(); const gx = Math.floor(i/38), gz = i%38;
      for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=gx+dx, nz=gz+dz; if (nx<0||nx>=82||nz<0||nz>=38) continue;
        const ni=nx*38+nz; if (!grid.walk[ni]||seen[ni]) continue; seen[ni]=1; q.push(ni);
      }
    }
    const cellAt = (x,z) => { const c=r.cellOf(x,z); return { gx:c.gx,gz:c.gz, walk:!!grid.walk[c.gx*38+c.gz], reach:!!seen[c.gx*38+c.gz], x,z }; };
    const rooms = {};
    for (const room of s.levels.find(l=>l.id==='F2').rooms) {
      let total=0, reach=0;
      for (let gx=0;gx<82;gx++) for (let gz=0;gz<38;gz++) {
        const x=-23.4+(gx+.5)*.55, z=-10.4+(gz+.5)*.55;
        if (x<room.x0||x>room.x1||z<room.z0||z>room.z1) continue;
        if (!grid.walk[gx*38+gz]) continue;
        total++; if (seen[gx*38+gz]) reach++;
      }
      rooms[room.id+' '+room.name] = {total, reach};
    }
    const doors = s.architecture.doors.filter(d=>d.level==='F2').map(d=>{
      const cx = d.axis==='x'?d.at:d.c, cz = d.axis==='x'?d.c:d.at;
      return { at:[+cx.toFixed(1),+cz.toFixed(1)], axis:d.axis, w:d.w, ...cellAt(cx,cz), open:d.open };
    });
    const propsNear = s.props.colliders.filter(c=>c.y0<8&&c.y1>4.2).filter(c=>c.z1<4.4&&c.z2>1.6&&c.x1<-14).map(c=>({x1:+c.x1.toFixed(1),x2:+c.x2.toFixed(1),z1:+c.z1.toFixed(1),z2:+c.z2.toFixed(1),y0:c.y0,y1:c.y1}));
    const paths = {};
    for (const [name,x,z] of [['south',6,3],['landing',0,0],['landingW',-17,0],['bed2',-9,7],['family',-17,7],['westDoor',-18,2]]) {
      r.pos.set(2.5,0,5.5); r.footY=4.2; r.level='F2';
      paths[name] = r.planTo(x,z,'F2').length;
    }
    return { reachable: seen.reduce((n,v)=>n+v,0), rooms, doors, propsNear, paths };
  }), null, 1));
  await b.close();
})();
