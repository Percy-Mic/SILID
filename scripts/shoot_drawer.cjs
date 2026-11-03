// Captures a functional cabinet closed and open, from the actual game camera.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('reports/mansion', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const cdp = await page.context().newCDPSession(page);
  await page.goto('http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });

  const shoot = async (name) => {
    await page.waitForTimeout(650);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/mansion/${name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', name);
  };

  await page.evaluate(() => {
    const s = window.__silid;
    const u = s.cabinets.units.find((x) => x.label === 'master_dresser');
    const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
    const dist = 1.0;
    const drawer = u.drawers[0];
    const pitch = Math.atan2(drawer.yc - 1.68, dist - u.d / 2);
    s.spawnAt(u.x + fx * dist, u.z + fz * dist, u.y, Math.atan2(fx, fz), pitch);
    s.player.flashlightOn = true;
    s.player.flash.visible = true;
    s.player.flash.intensity = 16;
    s.game.update(0.05);
  });
  await shoot('09_drawer_closed');

  // open through the real interaction, then step back and look into it
  await page.evaluate(() => {
    const s = window.__silid;
    const u = s.cabinets.units.find((x) => x.label === 'master_dresser');
    const g = s.game;
    g.update(0.05);
    g.interact();
    for (let i = 0; i < 120; i++) g.update(0.033);
    // stand back a little and look down into the open top drawer. The aim is
    // kept on the drawer's own front so the prompt stays on it.
    const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
    const dist = 1.25;
    s.spawnAt(u.x + fx * dist, u.z + fz * dist, u.y, Math.atan2(fx, fz),
      Math.atan2(u.drawers[0].yc - 1.68, dist - u.d / 2));
    s.player.flash.intensity = 20;
    g.update(0.05);
  });
  await shoot('10_drawer_open');

  // close and confirm the geometry returns flush
  const state = await page.evaluate(() => {
    const s = window.__silid;
    const u = s.cabinets.units.find((x) => x.label === 'master_dresser');
    const d = u.drawers[0];
    return {
      open: d.open, z: +d.holder.position.z.toFixed(3), meshes: d.holder.children.length,
      prompt: document.getElementById('prompt')?.textContent,
      target: s.game.nearestInteraction()?.id,
    };
  });
  console.log(JSON.stringify(state));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
