const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    for (const d of A.doors) if (d.collider) d.collider.disabled = true;
    pl.footY=-3.4;
    const lv=s.levels.find(l=>l.id==='B1'), f=lv.footprint, step=0.25;
    const NX=Math.round((f.x1-f.x0)/step), NZ=Math.round((f.z1-f.z0)/step);
    const open=new Uint8Array(NX*NZ);
    for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++)open[i*NZ+j]=pl.blocked(f.x0+i*step,f.z0+j*step)?0:1;
    const comp=new Int32Array(NX*NZ).fill(-1); let nc=0;
    for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++){const k=i*NZ+j; if(!open[k]||comp[k]>=0)continue;
      const st=[k]; comp[k]=nc; while(st.length){const c=st.pop(); const ci=(c/NZ)|0, cj=c%NZ;
        for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const ni=ci+di,nj=cj+dj; if(ni<0||nj<0||ni>=NX||nj>=NZ)continue; const nk=ni*NZ+nj; if(!open[nk]||comp[nk]>=0)continue; comp[nk]=nc; st.push(nk);}}
      nc++;}
    const col=[];
    for (let x=-18; x<=14; x+=0.5) { const i=Math.round((x-f.x0)/step), j=Math.round((3-f.z0)/step); col.push([+x.toFixed(2), open[i*NZ+j], comp[i*NZ+j]]); }
    return {nc, col};
  })));
  await b.close();
})();
