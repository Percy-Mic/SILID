// Do the road material's maps actually contain an image, and does the mesh use them?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 60000 });
  await p.waitForTimeout(600);
  const out = await p.evaluate(() => {
    const stats = (img) => {
      if (!img) return null;
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      let sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const v = d[i]; sum += v; sum2 += v * v; n++; }
      const mean = sum / n;
      return { mean: +mean.toFixed(2), sd: +Math.sqrt(sum2 / n - mean * mean).toFixed(2), src: img.width + 'x' + img.height };
    };
    const rows = [];
    window.__silid.scene.traverse((o) => {
      if (!o.isMesh || !['SM_Road', 'SM_RoadPatch', 'SM_RoadBreak', 'SM_RoadShoulder'].includes(o.name)) return;
      const m = o.material;
      rows.push({
        name: o.name,
        map: stats(m.map?.image),
        normalMap: stats(m.normalMap?.image),
        roughMap: stats(m.roughnessMap?.image),
        mapUuid: m.map?.uuid?.slice(0, 8),
        hasMap: !!m.map,
        vertexColors: m.vertexColors,
      });
    });
    return rows;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
