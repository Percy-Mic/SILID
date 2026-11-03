const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  for (const [n,x,z,yaw,pitch,y] of [['gen3',4.6,-5.6,-2.3,-0.02,-3.4],['gen4',1.2,-1.4,2.6,-0.05,-3.4],['lib3',-9.4,-6.4,-0.4,-0.1,0]]) {
    await p.evaluate(([x,z,yaw,pitch,y])=>{const s=window.__silid;s.spawnAt(x,z,y,yaw,pitch);s.renderer.render(s.scene,s.camera);},[x,z,yaw,pitch,y]);
    await p.waitForTimeout(400);
    await p.screenshot({path:'reports/rebuild/'+n+'.png', timeout:120000});
  }
  if(errs.length) console.log('ERR',errs.slice(0,3).join(' | '));
  await b.close();
})();
