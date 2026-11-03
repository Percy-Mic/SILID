// Samples rendered tone of specific surfaces. WebGL cannot be read back after
// compositing (no preserveDrawingBuffer), so the point is projected to screen
// coordinates, a screenshot is taken, and the pixels are sampled from it.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.evaluate(() => {
    const w = window.__silid;
    w.spawnAt(0, 46, null, 0, 0.30);
    w.player.flashlightOn = false; if (w.player.flash) w.player.flash.visible = false;
    w.game._lightTimer = 0; w.game.update(0.05);
  });
  await p.waitForTimeout(500);
  const pts = await p.evaluate(() => {
    const w = window.__silid, T = w.THREE, cam = w.camera;
    const W = window.innerWidth, H = window.innerHeight;
    const world = {
      wallGF: [-14, 3.0, 11.21], wallF2: [-14, 7.0, 11.21], wallF3: [-14, 11.0, 11.21],
      stoneTrim: [-13.6, 12.0, 11.2], slate: [0, 15.6, 9.6], skyUp: [-120, 120, -40],
      ground: [0, 0.05, 20], gableStone: [0, 15.2, 11.1],
    };
    const out = {};
    for (const [k, v] of Object.entries(world)) {
      const q = new T.Vector3(...v).project(cam);
      out[k] = [Math.round((q.x * 0.5 + 0.5) * W), Math.round((-q.y * 0.5 + 0.5) * H)];
    }
    return out;
  });
  const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('reports/exterior_gothic/tone_probe.png', Buffer.from(png.data, 'base64'));
  fs.writeFileSync('reports/exterior_gothic/tone_points.json', JSON.stringify(pts, null, 2));
  console.log(JSON.stringify(pts));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
