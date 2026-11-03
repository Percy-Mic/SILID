const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  fs.mkdirSync('reports/exterior/iso', { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xc4d4e4, 0x40443c, 2.6));
    const sun = new T.DirectionalLight(0xf2f0e8, 2.6);
    sun.position.set(60, 120, 80); w.scene.add(sun);
    const fill = new T.DirectionalLight(0x9fb4c8, 1.0);
    fill.position.set(-70, 50, -60); w.scene.add(fill);
    w.renderer.toneMappingExposure = 1.5;
  });
  const shoot = async (name, hide) => {
    await p.evaluate((hide) => {
      const w = window.__silid;
      if (w.__hidden) w.__hidden.forEach((o) => { o.visible = true; });
      w.__hidden = [];
      for (const o of w.scene.children) if (hide.includes(o.name)) { o.visible = false; w.__hidden.push(o); }
      w.spawnAt(0, 30, null, 0, 0.34);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, hide);
    await p.waitForTimeout(400);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/exterior/iso/${name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', name);
  };
  await shoot('a_all', []);
  await shoot('b_noivy', ['FacadeIvy']);
  await shoot('c_notrim', ['FacadeTrim']);
  await shoot('d_ivyonly', ['FacadeStone', 'FacadeShell', 'FacadeDamp', 'FacadeTrim', 'FacadeSlate', 'FacadeIron', 'FacadeGlass', 'FacadeBrick']);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
