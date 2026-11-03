const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:5199/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });
  const res = await page.evaluate(async () => {
    const w = window.__silid;
    const spec = w.rooms.entries.find((r) => r.id === 'the_billiards_room');
    const e = await w.loadRoom(spec);
    w.spawnAt(-10.5, -4.6, 8.0, 0, 0.06);
    w.player.enabled = true;
    w.renderer.render(w.scene, w.camera);
    return { ok: !!e, lid: !!spec.lidGroup, tris: e && e.tris, m: w.metrics() };
  });
  console.log(JSON.stringify(res));
  await page.screenshot({ path: 'reports/rooms/ingame/the_billiards_room.jpg', type: 'jpeg', quality: 82, timeout: 300000 });
  await page.evaluate(() => { const w = window.__silid; w.player.yaw += Math.PI; w.player.syncCamera(); w.renderer.render(w.scene, w.camera); });
  await page.screenshot({ path: 'reports/rooms/ingame/the_billiards_room_door.jpg', type: 'jpeg', quality: 82, timeout: 300000 });
  await browser.close();
})();
