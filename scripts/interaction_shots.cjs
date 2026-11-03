// Interaction screenshots: the furniture photographed AFTER the player has
// actually worked it. Nothing is posed by hand except the camera — each drawer
// and cupboard is opened through Game.interact(), the same path the player's E
// key uses, so what the photograph shows is the state the game reached.
//
// A flat probe light is added because the house is a night scene; it is removed
// at the end and never touches the game's own lighting rig.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.env.SILID_OUT || 'reports/interactions/shots';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    const hemi = new T.HemisphereLight(0xa9b6c2, 0x3a362e, 3.2);
    hemi.name = 'PROBE_Hemi';
    w.scene.add(hemi);
    const key = new T.DirectionalLight(0xffe2bd, 2.0);
    key.position.set(6, 9, 10);
    key.name = 'PROBE_Key';
    w.scene.add(key);
    const fill = new T.DirectionalLight(0x8ea3b6, 0.55);
    fill.position.set(-8, 4, -10);
    fill.name = 'PROBE_Fill';
    w.scene.add(fill);
    w.renderer.toneMappingExposure = 1.3;
    w.player.flashlightOn = false;
    if (w.player.flash) w.player.flash.visible = false;
  });

  const rows = [];

  // Stand in front of a piece of furniture, at `dist`, eye height, aimed at the
  // height `lookY`. Returns the interaction the game offers from there.
  const stand = async (target, dist, lookY) => page.evaluate(({ target, dist, lookY }) => {
    const w = window.__silid, g = w.game;
    let x, z, rot;
    if (target.kind === 'unit') {
      const u = w.cabinets.units.find((c) => c.label === target.label);
      if (!u) return null;
      x = u.x; z = u.z; rot = u.rot;
      w.spawnAt(u.x + Math.sin(u.rot) * dist, u.z + Math.cos(u.rot) * dist, u.y,
        u.rot, Math.atan2((lookY ?? 1.0) - 1.62, dist));
      g.update(0.05);
      const t = g.nearestInteraction();
      return { target: t?.kind || null, prompt: document.getElementById('prompt')?.textContent || '' };
    } else {
      const s = w.hiding.spots.find((h) => h.type === 'armoire') || w.hiding.spots[0];
      if (!s) return null;
      // stand clear of the leaves along the armoire's own front normal, so the
      // camera sees the cavity rather than a door edge
      const fx = Math.sin(s.rot), fz = Math.cos(s.rot);
      w.spawnAt(s.out.x + fx * dist, s.out.z + fz * dist, s.levelY, s.rot,
        Math.atan2((lookY ?? 1.2) - 1.68, 0.82 + dist));
      g.update(0.05);
      const t = g.nearestInteraction();
      return { target: t?.kind || null, prompt: document.getElementById('prompt')?.textContent || '' };
    }
    const fx = Math.sin(rot), fz = Math.cos(rot);
    const px = x + fx * dist, pz = z + fz * dist;
    const pitch = Math.atan2((lookY ?? 1.0) - 1.62, dist);
    w.spawnAt(px, pz, null, Math.atan2(fx, fz), pitch);
    g.update(0.05);
    const t = g.nearestInteraction();
    return { target: t?.kind || null, prompt: document.getElementById('prompt')?.textContent || '' };
  }, { target, dist, lookY });

  const settle = (n = 60) => page.evaluate((n) => {
    const g = window.__silid.game;
    for (let i = 0; i < n; i++) g.update(1 / 30);
  }, n);

  const press = () => page.evaluate(() => {
    const g = window.__silid.game;
    g.update(0.05);
    const t = g.nearestInteraction();
    const before = document.getElementById('prompt')?.textContent || '';
    g.interact();
    for (let i = 0; i < 80; i++) g.update(1 / 30);
    return { kind: t?.kind || null, promptBefore: before, promptAfter: document.getElementById('prompt')?.textContent || '' };
  });

  const shot = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
  };

  // One action, then the photograph. Each press is the player's E on whatever
  // the game is offering from that spot, so the picture is the reached state.
  const run = async (name, target, dist, lookY) => {
    const s = await stand(target, dist, lookY);
    const a = await press();
    await shot(name);
    rows.push({ name, ...s, action: a.kind, promptBefore: a.promptBefore, promptAfter: a.promptAfter });
    return a;
  };

  // --- a bedroom dresser: one specific drawer, pulled out on its slides -----
  await run('01_dresser_drawer', { kind: 'unit', label: 'master_dresser' }, 1.75, 0.72);
  // --- the kitchen cabinets: two leaves on their hinges, shelves exposed ----
  await run('02_kitchen_cupboard', { kind: 'unit', label: 'kitchen_cupboard' }, 1.85, 1.10);
  // --- the hall console table by the stair --------------------------------
  await run('03_hall_console', { kind: 'unit', label: 'sitting_console' }, 1.75, 0.80);
  // --- the aparador: doors open on the rail, then offered as a hiding place -
  const arm = await stand({ kind: 'spot' }, 1.15);
  const armOpen = await press();
  await shot('04_aparador_open');
  rows.push({ name: 'aparador', ...arm, action: armOpen.kind, promptAfter: armOpen.promptAfter });
  // step in close and aim at the cavity: the upper target is the interior,
  // and it only exists because the leaves are open
  await stand({ kind: 'spot' }, 0.35, 1.62);
  const armIn = await press();
  await settle(50);
  await shot('05_aparador_inside');
  rows.push({ name: 'aparador_inside', action: armIn.kind, promptAfter: armIn.promptAfter });

  console.log(JSON.stringify(rows, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
