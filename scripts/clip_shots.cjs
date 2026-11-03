// CLIP SHOTS — one screenshot per verified clip, from the room side, looking
// at where the piece actually enters the masonry.
//
// Usage: node scripts/clip_shots.cjs [auditJson] [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const IN = process.argv[2] || 'reports/clip_audit_verified.json';
const OUT = process.argv[3] || 'reports/clip_audit';

(async () => {
  const rows = JSON.parse(fs.readFileSync(IN, 'utf8')).filter((r) => r.band && r.record);
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000, polling: 500 });

  const cdp = await page.context().newCDPSession(page);
  const shots = [];

  for (const r of rows) {
    const cam = await page.evaluate((r) => {
      const w = window.__silid;
      const LEVELS = w.levels;
      const lev = LEVELS.find((l) => l.id === r.level);
      const base = r.record.y;
      const { axis, line, half, span } = r.band;
      const side = (axis === 'x' ? r.record.z : r.record.x) < line ? -1 : 1;
      const along = axis === 'x'
        ? Math.max(span[0], Math.min(span[1], r.record.x))
        : Math.max(span[0], Math.min(span[1], r.record.z));

      const back = half + 2.6;
      const cx = axis === 'x' ? along : line + side * back;
      const cz = axis === 'x' ? line + side * back : along;
      const cy = base + 1.55;

      const tx = axis === 'x' ? along : line - side * 0.05;
      const tz = axis === 'x' ? line - side * 0.05 : along;
      const ty = base + 0.5;

      const dx = tx - cx, dz = tz - cz;
      const horiz = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(ty - cy, horiz);

      w.spawnAt(cx, cz, cy, yaw, pitch);
      // Diagnostic light only, in this probe's page: the game's own torch is
      // driven from player.update, which does not run while we hold the frame
      // for a screenshot, and the rooms are lit for play, not for inspection.
      const THREE = w.THREE;
      if (!window.__clipLight) {
        window.__clipLight = new THREE.PointLight(0xfff1dc, 160, 20, 2);
        w.scene.add(window.__clipLight);
      }
      window.__clipLight.position.set(cx, cy, cz);
      return { cx: +cx.toFixed(2), cz: +cz.toFixed(2), cy: +cy.toFixed(2), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), level: r.level };
    }, r);

    await page.waitForTimeout(700);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const name = `${r.name}_${r.level}_${Math.round(cam.cx * 10)}_${Math.round(cam.cz * 10)}.png`;
    fs.writeFileSync(path.join(OUT, name), Buffer.from(png.data, 'base64'));
    shots.push(name);
    console.log('shot', name, '| cam', cam.cx, cam.cy, cam.cz, '| depth', r.exactDepth + 'm');

    // second angle: swung 55 degrees so the wall junction reads in profile,
    // which is where an embed into a reveal is actually visible
    const side = await page.evaluate((r) => {
      const w = window.__silid;
      const base = r.record.y;
      const { axis, line, half, span } = r.band;
      const s = (axis === 'x' ? r.record.z : r.record.x) < line ? -1 : 1;
      const along = axis === 'x'
        ? Math.max(span[0], Math.min(span[1], r.record.x))
        : Math.max(span[0], Math.min(span[1], r.record.z));
      const back = half + 2.0;
      const cx = axis === 'x' ? along + 1.7 : line + s * back;
      const cz = axis === 'x' ? line + s * back : along + 1.7;
      const cy = base + 1.35;
      const tx = axis === 'x' ? along : line - s * 0.05;
      const tz = axis === 'x' ? line - s * 0.05 : along;
      const ty = base + 0.45;
      const dx = tx - cx, dz = tz - cz;
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(ty - cy, Math.hypot(dx, dz));
      w.spawnAt(cx, cz, cy, yaw, pitch);
      if (window.__clipLight) window.__clipLight.position.set(cx, cy, cz);
      return { cx: +cx.toFixed(2), cz: +cz.toFixed(2) };
    }, r);
    await page.waitForTimeout(700);
    const png2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const name2 = `${r.name}_${r.level}_angle_${Math.round(side.cx * 10)}_${Math.round(side.cz * 10)}.png`;
    fs.writeFileSync(path.join(OUT, name2), Buffer.from(png2.data, 'base64'));
    shots.push(name2);
    console.log('shot', name2, '| angle cam', side.cx, side.cz);
  }

  if (errors.length) console.log('page errors:', errors.slice(0, 3));
  console.log('shots:', shots.length, '->', OUT);
  await browser.close();
})();