const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const shots=[['foyer_stair',3.3,10.3,1.0,0.28,0],['mb3',-2.5,-8.6,3.0,-0.05,4.2],['gal_stair',-4.4,1.2,-0.55,0.2,0]];
  for(const [n,x,z,yaw,pitch,y] of shots){
    await p.evaluate(([x,z,yaw,pitch,y])=>{const s=window.__silid;s.spawnAt(x,z,y,yaw,pitch);s.renderer.render(s.scene,s.camera);},[x,z,yaw,pitch,y]);
    await p.waitForTimeout(400);
    await p.screenshot({path:'reports/rebuild/'+n+'.png', timeout:120000});
  }
  await b.close();
})();
