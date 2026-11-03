const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const grid = r.gridFor('GF');
    const COLS=82, ROWS=38;
    const start=r.nearestWalkable(grid,0,4), goal=r.nearestWalkable(grid,-4.22,7.5);
    const si=start.gx*ROWS+start.gz, gi=goal.gx*ROWS+goal.gz;
    const came=new Int32Array(COLS*ROWS).fill(-1), seen=new Uint8Array(COLS*ROWS);
    const q=[si]; seen[si]=1; let head=0, pop=0;
    while(head<q.length){const cur=q[head++];pop++;if(cur===gi)break;
      const cx=Math.floor(cur/ROWS),cz=cur%ROWS;
      for(let k=0;k<4;k++){
        const nx=cx+(k===0?1:k===1?-1:0), nz=cz+(k===2?1:k===3?-1:0);
        if(nx<0||nx>=COLS||nz<0||nz>=ROWS)continue;
        const ni=nx*ROWS+nz; if(!grid.walk[ni]||seen[ni])continue;
        seen[ni]=1;came[ni]=cur;q.push(ni);
      }
    }
    return { si, gi, seenGoal:!!seen[gi], popped:pop, queue:q.length, startWalk:grid.walk[si], goalWalk:grid.walk[gi],
      pathLen: r.pathOnLevel('GF',0,4,-4.22,7.5).length };
  }), null, 1));
  await b.close();
})();
