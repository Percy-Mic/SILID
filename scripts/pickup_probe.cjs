// Pickup probe: every object the world offers as a pickup is taken the way a
// player takes it — stand near it, ask the game what is in reach, press E — and
// the result is checked against the inventory and the visible mesh.
//
// The phone is the one that matters most: it is the story object, it drives the
// hand model and the phone UI, and its world copy has to disappear.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(500);

  const out = await page.evaluate(() => {
    const w = window.__silid, g = w.game;
    const rows = [];
    const pickups = w.props.interactables.filter((i) => i.kind === 'pickup');
    for (const p of pickups) {
      let found = null;
      // try eight approaches at arm's length and take the one where the game
      // itself agrees the object is what you are looking at
      for (let a = 0; a < 8 && !found; a++) {
        const th = (a / 8) * Math.PI * 2;
        const px = p.x + Math.sin(th) * 0.75, pz = p.z + Math.cos(th) * 0.75;
        for (const pitch of [-0.55, -0.35, -0.15, 0.05]) {
          w.spawnAt(px, pz, p.y - 1.15, th, pitch);
          g.update(0.05);
          const t = g.nearestInteraction();
          if (t && t.kind === 'pickup' && t.id === p.id) { found = t; break; }
        }
      }
      if (!found) { rows.push({ id: p.id, name: p.name, reached: false }); continue; }
      const before = g.inventory.size;
      const prompt = document.getElementById('prompt')?.textContent || '';
      g.interact();
      g.update(0.05);
      const mesh = w.scene.getObjectByName('phone_world') || null;
      rows.push({
        id: p.id, name: p.name, reached: true, prompt,
        gained: g.inventory.size === before + 1,
        inInventory: g.inventory.has(p.id),
        worldHidden: p.mesh ? p.mesh.visible === false : null,
        phoneHeld: p.id === 'phone' ? !!g.phoneHeld : undefined,
        after: document.getElementById('prompt')?.textContent || '',
        worldPhoneVisible: mesh ? mesh.visible : undefined,
      });
    }
    return {
      rows,
      pageErrors: [],
      phoneUi: !!document.getElementById('phone'),
      inventory: [...g.inventory],
    };
  });
  out.pageErrors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
