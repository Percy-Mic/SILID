const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, T=s.THREE;
    s.spawnAt(-2.5,-8.6,4.2,3.0,-0.05); s.camera.updateMatrixWorld();
    const rc=new T.Raycaster();
    const hits=[];
    for(const [nx,ny] of [[-0.35,0.1],[-0.2,0.05],[0.0,0.0],[-0.5,0.15],[-0.62,0.2]]) {
      rc.setFromCamera(new T.Vector2(nx,ny), s.camera);
      const h=rc.intersectObjects(s.scene.children,true)[0];
      if(h) hits.push({n:h.object.name||h.object.type, mat: h.object.material?.name||h.object.material?.uuid?.slice(0,6), p:[+h.point.x.toFixed(2),+h.point.y.toFixed(2),+h.point.z.toFixed(2)]});
    }
    return hits;
  }),null,1));
  await b.close();
})();
