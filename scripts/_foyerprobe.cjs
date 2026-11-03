const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident, pl = s.player;
    const grid = r.gridFor('GF');
    const start = r.nearestWalkable(grid,0,4);
    const seen = new Uint8Array(82*38); const q=[start.gx*38+start.gz]; seen[q[0]]=1;
    while(q.length){const i=q.pop(),gx=Math.floor(i/38),gz=i%38;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=gx+dx,nz=gz+dz;
        if(nx<0||nx>=82||nz<0||nz>=38)continue;const ni=nx*38+nz;
        if(!grid.walk[ni]||seen[ni])continue;seen[ni]=1;q.push(ni);}}
    const cells=[];
    for(let x=-5;x<=1;x+=0.55)for(let z=4;z<=11;z+=0.55){
      const c=r.cellOf(x,z); cells.push({x:+x.toFixed(2),z:+z.toFixed(2),walk:grid.walk[c.gx*38+c.gz],reach:seen[c.gx*38+c.gz]});
    }
    const props = s.props.colliders.filter(c=>c.x1>-6&&c.x2<1&&c.z1>2&&c.z2<11.5&&c.y0<2&&c.y1>0).map(c=>({x1:+c.x1.toFixed(2),x2:+c.x2.toFixed(2),z1:+c.z1.toFixed(2),z2:+c.z2.toFixed(2),y:[c.y0,c.y1]}));
    // real player walk from foyer to the stair foot
    pl.enabled=true; pl.teleport(0,4,0); pl.yaw=0; pl.pitch=0;
    const aim=(x,z)=>{pl.yaw=Math.atan2(-(x-pl.pos.x),-(z-pl.pos.z));};
    let stuck=null;
    for(let i=0;i<500;i++){
      aim(-3.5,7.2); pl.keys.KeyW=true; const bx=pl.pos.x,bz=pl.pos.z;
      pl.update(0.033, s.game);
      if(Math.hypot(pl.pos.x-bx,pl.pos.z-bz)<1e-5){stuck={x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),foot:+pl.footY.toFixed(2)};break;}
      if(Math.hypot(pl.pos.x+3.5,pl.pos.z-7.2)<0.4)break;
    }
    pl.keys.KeyW=false;
    return { cells: cells.filter(c=>c.walk&&!c.reach).slice(0,12), unreachableCount:cells.filter(c=>c.walk&&!c.reach).length, props,
      playerWalk:{x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),foot:+pl.footY.toFixed(2),stuck},
      stairFootReach:[
        {x:-3.5,z:7.5},{x:-4.4,z:7.5},{x:-1.5,z:5.2},{x:-1.5,z:9.8},{x:0.9,z:7.5}
      ].map(pt=>{const c=r.cellOf(pt.x,pt.z);return {...pt,walk:grid.walk[c.gx*38+c.gz],reach:seen[c.gx*38+c.gz]};})};
  }), null, 1));
  await b.close();
})();
