const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const out = {};
    for (const lvl of s.levels) {
      const walk = new Uint8Array(82*38);
      for (let gx=0;gx<82;gx++)for(let gz=0;gz<38;gz++){
        const x=-23.4+(gx+.5)*.55,z=-10.4+(gz+.5)*.55;
        const f=s.floorAt(x,z,lvl.y);
        if(f===null||Math.abs(f-lvl.y)>0.55)continue;
        if(r.blockedAt(x,z,lvl.y,0.34))continue;
        walk[gx*38+gz]=1;
      }
      const startPt = lvl.id==='GF'||lvl.id==='B1'?[0,4]:[-4.5,6.4];
      let sc=r.nearestWalkable({walk},startPt[0],startPt[1]);
      if(!sc){out[lvl.id]='no start';continue;}
      const seen=new Uint8Array(walk.length);const q=[sc.gx*38+sc.gz];seen[q[0]]=1;
      while(q.length){const i=q.pop(),gx=Math.floor(i/38),gz=i%38;
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=gx+dx,nz=gz+dz;
          if(nx<0||nx>=82||nz<0||nz>=38)continue;const ni=nx*38+nz;
          if(!walk[ni]||seen[ni])continue;seen[ni]=1;q.push(ni);}}
      const rooms={};
      for(const room of lvl.rooms){let t=0,rr=0;
        for(let gx=0;gx<82;gx++)for(let gz=0;gz<38;gz++){const x=-23.4+(gx+.5)*.55,z=-10.4+(gz+.5)*.55;
          if(x<room.x0||x>room.x1||z<room.z0||z>room.z1)continue;if(!walk[gx*38+gz])continue;t++;if(seen[gx*38+gz])rr++;}
        if(t>0) rooms[room.id]={t,r:rr};}
      out[lvl.id]=rooms;
    }
    return out;
  }), null, 1));
  await b.close();
})();
