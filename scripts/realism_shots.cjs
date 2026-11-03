// Realism pass screenshots: the three repaired objects, from the real game.
//
// Each shot spawns the actual player at an authored position and captures the
// rendered frame through CDP. Usage:
//   node scripts/realism_shots.cjs reports/realism/before
// The directory is created; shot names are stable so before/after pairs line up.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/realism/after';

const only = process.argv.slice(3);
const shots = [
  // the master-bedroom dresser: standing height, three-quarter view
  { name: 'drawer_closed', x: null, z: null, yaw: 0, pitch: 0, find: 'cabinet:master_dresser' },
  { name: 'drawer_open', x: null, z: null, yaw: 0, pitch: 0, find: 'cabinet:master_dresser', open: true },
  { name: 'drawer_interior', x: null, z: null, yaw: 0, pitch: 0, find: 'cabinet:master_dresser', open: true, inner: true },
  // the grand stair, from the foyer floor and from mid-flight
  { name: 'stair_foyer', x: -4.25, z: 9.6, y: 0, yaw: -0.62, pitch: 0.02 },
  { name: 'stair_midflight', x: -4.9, z: 7.5, y: 4.2, yaw: -1.30, pitch: -0.30 },
  { name: 'stair_treads', x: -4.35, z: 6.2, y: 4.2, yaw: -1.65, pitch: -0.55 },
  // an interior door, framed the way the reference photograph is: full leaf,
  // casing, and a close view of the hardware
  { name: 'door_front', door: { level: 'F2', at: -9, c: 4 }, dist: 2.1, aim: 1.15 },
  { name: 'door_knob', door: { level: 'F2', at: -9, c: 4 }, dist: 1.05, aim: 1.02 },
  // the same leaf on the ground floor, where the walls are the weathered
  // blue-grey plaster of the reference photograph
  { name: 'door_blue', door: { level: 'GF', at: 6.5, c: 2 }, dist: 2.2, aim: 1.15 },
  { name: 'door_blue_close', door: { level: 'GF', at: 6.5, c: 2 }, dist: 1.1, aim: 1.02 },
  { name: 'door_blue_open', door: { level: 'GF', at: 6.5, c: 2 }, dist: 2.2, aim: 1.15, doorOpen: true },
  // the generator room
  { name: 'generator_wide', x: 3.0, z: 1.5, y: -3.4, yaw: 0.0, pitch: -0.14 },
  { name: 'generator_close', x: 2.7, z: 0.15, y: -3.4, yaw: 0.08, pitch: -0.20 },
  { name: 'generator_threequarter', x: 4.7, z: -0.2, y: -3.4, yaw: 0.42, pitch: -0.18 },
].filter((s) => !only.length || only.includes(s.name));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  const cdp = await page.context().newCDPSession(page);
  // `load` never fires while the optional phone asset 404s; the world is
  // assembled after DOMContentLoaded and announces itself on __silid.
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(800);

  for (const s of shots) {
    const info = await page.evaluate((s) => {
      const w = window.__silid;
      let x = s.x, z = s.z, y = s.y, yaw = s.yaw, pitch = s.pitch;
      if (s.door) {
        // stand square to a real door leaf on the +normal side of its wall line
        const list = w.architecture.doors.filter((d) => !d.arch && !d.entrance &&
          d.level === s.door.level && Math.abs(d.at - s.door.at) < 0.01 && Math.abs(d.c - s.door.c) < 0.01);
        const d = list[0];
        if (d) {
          const nx = d.axis === 'x' ? 0 : 1;
          const nz = d.axis === 'x' ? 1 : 0;
          const dist = s.dist ?? 2.1;
          x = (d.axis === 'x' ? d.at : d.c) + nx * dist;
          z = (d.axis === 'x' ? d.c : d.at) + nz * dist;
          y = d.y;
          yaw = Math.atan2(nx, nz);          // forward = (-sin, -cos) = -normal
          pitch = Math.atan2((d.y + (s.aim ?? 1.15)) - (d.y + 1.68), dist);
        }
      }
      if (s.find) {
        const u = w.cabinets.units.find((v) => ('cabinet:' + v.label) === s.find);
        if (u) {
          // stand back from the front, centred, at a natural eye angle
          const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
          const dist = s.inner ? 1.05 : 2.05;
          x = u.x + fx * dist;
          z = u.z + fz * dist;
          y = u.y;
          // face the cabinet: player forward is (-sin yaw, -cos yaw), and the
          // cabinet's front is (sin rot, cos rot), so yaw = rot.
          yaw = u.rot;
          // The close-up aims AT the drawer, not near it: focus picks the
          // interactable nearest the view ray, so a guesswork pitch opened
          // whichever drawer happened to sit under the crosshair.
          const d0 = u.drawers[s.di ?? 0];
          pitch = s.inner
            ? Math.atan2(d0.yc - 1.68, dist - u.d / 2)
            : -0.46;
        }
      }
      w.spawnAt(x, z, y, yaw, pitch);
      w.player.flashlightOn = true;
      w.player.flash.visible = true;
      w.game._lightTimer = 0;
      let opened = null;
      if (s.open) {
        const u = w.cabinets.units.find((v) => ('cabinet:' + v.label) === s.find);
        const d = u?.drawers[s.di ?? 0];
        if (d && !d.open) {
          // open through the real interaction, not by moving the holder: stand
          // a metre off the front and aim straight at this drawer's centre so
          // nearestInteraction() resolves to it and not its neighbour.
          const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
          const dist = 1.0;
          const aim = Math.atan2(d.yc - 1.68, dist - u.d / 2);
          w.spawnAt(u.x + fx * dist, u.z + fz * dist, u.y, u.rot, aim);
          w.game.update(0.05);
          const focus = w.game.nearestInteraction();
          opened = { wanted: d.index, got: focus?.drawer?.index ?? null, kind: focus?.kind ?? null };
          w.game.interact();
          for (let i = 0; i < 70; i++) w.game.update(0.033);
          opened.open = d.open;
          w.spawnAt(x, z, y, yaw, pitch);
        }
      }
      w.game.update(0.05);
      let doorOpen = null;
      if (s.doorOpen) {
        // swing the leaf through the real interaction, then let it settle
        const t = w.game.nearestInteraction();
        doorOpen = { kind: t?.kind ?? null, before: t?.door?.open ?? null };
        if (t?.kind === 'door' && !t.door.open) {
          w.game.interact();
          for (let i = 0; i < 90; i++) w.game.update(0.033);
        }
        doorOpen.after = t?.door?.open ?? null;
      }
      return { x: +x.toFixed(2), z: +z.toFixed(2), y, yaw: +yaw.toFixed(2), opened, doorOpen };
    }, s);
    await page.waitForTimeout(350);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, s.name + '.png'), Buffer.from(png.data, 'base64'));
    console.log('shot', s.name, JSON.stringify(info));
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  console.log('DONE');
  // Software-rendered Chromium sometimes hangs on close; the PNGs are already
  // on disk, so do not let teardown turn a completed run into a timeout.
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
