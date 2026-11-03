// Wall/window evidence shots: the same windows seen from outside and from the
// room they are supposed to light. Probe lighting only; nothing in the game is
// changed. The camera is placed by the plan, not by eye.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.env.SILID_OUT || 'reports/wallwin';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    for (const [name, hex, inten, pos] of [
      ['PROBE_Hemi', 0xbcc9d6, 2.6, null],
      ['PROBE_Key', 0xffe7c8, 2.1, [12, 16, 26]],
      ['PROBE_Fill', 0x9fb4c6, 0.7, [-16, 9, -20]],
    ]) {
      const l = name === 'PROBE_Hemi'
        ? new T.HemisphereLight(hex, 0x3b3a33, inten)
        : new T.DirectionalLight(hex, inten);
      if (pos) l.position.set(...pos);
      l.name = name;
      w.scene.add(l);
    }
    w.renderer.toneMappingExposure = 1.25;
  });

  const rows = [];

  // --- outside: stand back from a facade and look at it ---------------------
  const outside = async (name, x, z, yaw, pitch, y) => {
    await page.evaluate(({ x, z, yaw, pitch, y }) => {
      const w = window.__silid;
      w.spawnAt(x, z, y, yaw, pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
    }, { x, z, yaw, pitch, y });
    await page.waitForTimeout(300);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', clip: { x: 0, y: 0, width: 1200, height: 700, scale: 0.72 },
    });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
    rows.push({ name, kind: 'outside', x, z });
  };

  // --- inside: stand in a named room and look at one wall -------------------
  const inside = async (name, roomId, yaw) => {
    const info = await page.evaluate(({ roomId, yaw }) => {
      const w = window.__silid;
      const room = w.architecture.rooms.find((r) => r.id === roomId);
      if (!room) return null;
      const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
      w.spawnAt(cx, cz, room.floorY, yaw, 0.02);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      return { cx, cz, room: room.name };
    }, { roomId, yaw });
    await page.waitForTimeout(300);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', clip: { x: 0, y: 0, width: 1200, height: 700, scale: 0.72 },
    });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
    rows.push({ name, kind: 'inside', ...info });
  };

  // South and east elevations face the approach; the north and west views
  // complete the exterior check on the service side and rear elevations.
  await outside('out_south_gf', 0, 34, 0, 0.12, 0);
  await outside('out_south_f2', 0, 34, 0, 0.62, 4.2);
  await outside('out_south_f3', 0, 34, 0, 0.95, 8.0);
  await outside('out_east', 36, 0, Math.PI / 2, 0.30, 4.2);
  await outside('out_north', 0, -28, Math.PI, 0.35, 4.2);
  await outside('out_west', -38, 0, -Math.PI / 2, 0.30, 4.2);

  // Interior views from rooms that share south, north, east and west walls.
  await inside('in_ff2_11_bedroom5_south', 'FF2-11', Math.PI);
  await inside('in_ff2_03_master_north', 'FF2-03', 0);
  await inside('in_ff3_06_master_suite_south', 'FF3-06', Math.PI);
  await inside('in_gf_01_kitchen_north', 'GF-01', 0);
  await inside('in_gf_16_guestroom4_east', 'GF-16', -Math.PI / 2);
  await inside('in_gf_04_staffroom_west', 'GF-04', Math.PI / 2);
  // Rooms whose bay had to be re-seated off the facade rhythm to clear a
  // partition return: their windows must still read as windows, not slots.
  await inside('in_gf_02_pantry_west', 'GF-02', Math.PI / 2);
  await inside('in_gf_15_sittingroom_south', 'GF-15', Math.PI);
  await inside('in_ff2_05_masterbath_north', 'FF2-05', 0);
  await inside('in_gf_14_foyer_entrance', 'GF-14', Math.PI);

  console.log(JSON.stringify(rows, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
