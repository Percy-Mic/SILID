// IN-GAME SHOTS — the underground route, photographed through the real render.
//
// Every image here is taken with the game's own camera in the running build,
// lit by the game's own flashlight: no Blender render, no wireframe, no
// composite and no probe lights. The player is placed on a floor the game
// itself resolves, the HUD pass is run so the prompt is the one a player sees,
// and the frame is captured from the compositor through CDP — Playwright's own
// screenshot waits for a stability the render loop never reaches.
//
//   node scripts/underground_shots.cjs            (needs the dev server up)
//   SILID_URL=http://127.0.0.1:5199/?probe=1 node scripts/underground_shots.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5199/?probe=1';
const OUT = 'reports/underground/shots';

// x, z, footY, look-at x, look-at z, file, note
const SHOTS = [
  [12.0, 6.0, -3.4, 26.0, 6.0, '01_basement_corridor', 'the basement, looking east down the service corridor'],
  [30.0, 6.0, -3.4, 44.0, 6.0, '02_basement_depth', 'mid-basement: conduits, shelves and the far doorway'],
  [46.5, 6.0, -3.4, 54.0, 6.0, '03_tunnel_entrance', 'the tunnel mouth: the descending passage beyond the basement'],
  [51.0, 6.0, -3.0, 58.0, 6.0, '04_tunnel_vault', 'the vaulted passage, rising toward the chamber'],
  [56.5, 6.0, -1.95, 62.0, 6.0, '05_court_lit', 'the cistern court under its lantern'],
  [54.4, 6.0, -2.01, 56.2, 6.0, '06_service_door', 'the service door at the end of the route, with its prompt'],
  [70.4, 7.9, 0.78, 60.0, 7.9, '07_forest_emergence', 'standing in the forest, looking back at the concealed exit'],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const cdp = await page.context().newCDPSession(page);

  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(1500);

  const rows = [];
  for (const [x, z, fy, tx, tz, name, note] of SHOTS) {
    const info = await page.evaluate(({ x, z, fy, tx, tz }) => {
      const w = window.__silid;
      const p = w.player, g = w.game;
      const yaw = Math.atan2(-(tx - x), -(tz - z));
      w.spawnAt(x, z, fy, yaw, -0.04);
      p.enabled = true;
      p.flashlightOn = true;
      p.crouch = 0;
      g.update(1 / 30);
      g.update(1 / 30);
      const prompt = document.getElementById('prompt');
      return {
        footY: +p.footY.toFixed(2),
        surface: p.surface,
        prompt: prompt && prompt.classList.contains('on') ? prompt.textContent.replace(/\s+/g, ' ').trim() : null,
      };
    }, { x, z, fy, tx, tz });
    await page.waitForTimeout(450);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
    rows.push({ name, note, at: [x, z], ...info });
    console.log(name.padEnd(22), 'floor', String(info.footY).padEnd(6), info.surface.padEnd(6),
      info.prompt ? '| prompt: ' + info.prompt : '');
  }

  const metrics = await page.evaluate(() => (window.__silid.metrics ? window.__silid.metrics() : null));
  fs.writeFileSync(`${OUT}/../shots.json`, JSON.stringify({ shots: rows, metrics, errors }, null, 1));
  console.log('--- console/page errors ---', errors.length ? errors.slice(0, 6) : '(none)');
  console.log('wrote', `${OUT}/../shots.json`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
