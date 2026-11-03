const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 60000 });
  await p.waitForTimeout(800);
  const out = await p.evaluate(() => {
    const s = window.__silid.scene;
    const rows = [];
    s.traverse((o) => {
      if (!o.isMesh || !o.name.startsWith('SM_Road')) return;
      const m = o.material;
      const uv = o.geometry.attributes.uv;
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      if (uv) for (let i = 0; i < uv.count; i++) {
        u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i));
        v0 = Math.min(v0, uv.getY(i)); v1 = Math.max(v1, uv.getY(i));
      }
      rows.push({
        name: o.name,
        pos: o.position.toArray().map((v) => +v.toFixed(2)),
        uv: [u0, u1, v0, v1].map((v) => +v.toFixed(2)),
        repeat: m.map ? m.map.repeat.toArray() : null,
        aniso: m.map ? m.map.anisotropy : null,
        color: m.color ? '#' + m.color.getHexString() : null,
        colorMap: m.map ? m.map.image.width + 'x' + m.map.image.height : null,
        rough: m.roughness, metal: m.metalness,
        offsets: [m.polygonOffset, m.polygonOffsetFactor],
      });
    });
    return { rows, renderer: { aniso: window.__silid.renderer.capabilities.getMaxAnisotropy() } };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
