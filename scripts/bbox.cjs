const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 90000 });
  const r = await p.evaluate(() => {
    const s = window.__silid.scene; const out = [];
    s.traverse(o => { if (o.isMesh && o.geometry && o.name) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld); out.push({n:o.name, min:[bb.min.x,bb.min.y,bb.min.z].map(v=>+v.toFixed(1)), max:[bb.max.x,bb.max.y,bb.max.z].map(v=>+v.toFixed(1))}); }});
    return out.filter(o=>/Walls|Exterior|Floor|Stair|Terrain|Road|Car|Scene/.test(o.n)).slice(0,30);
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
