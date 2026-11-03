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
    const out=[];
    for (const [nx,ny] of [[-0.35,0.1],[-0.15,0.05],[0.05,0.0],[0.25,-0.05],[-0.5,0.15]]) {
      rc.setFromCamera(new T.Vector2(nx,ny), s.camera);
      const hits=rc.intersectObjects(s.scene.children,true).slice(0,3);
      out.push(hits.map(h=>({n:h.object.name||h.object.type, p:[+h.point.x.toFixed(2),+h.point.y.toFixed(2),+h.point.z.toFixed(2)], d:+h.distance.toFixed(2)})));
    }
    return out;
  }),null,1));
  await b.close();
})();
