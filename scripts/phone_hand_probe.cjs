// Phone hand check: take the phone through the pickup path and confirm the
// modelled asset actually enters the player's hand (not just the inventory).
// The GLB loads asynchronously, so the check waits for it rather than reading
// the flag on the same frame as the keypress.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = 'reports/interactions/shots';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(500);

  const taken = await page.evaluate(() => {
    const w = window.__silid, g = w.game;
    const p = w.props.interactables.find((i) => i.id === 'phone');
    if (!p) return { found: false };
    let hit = null;
    for (let a = 0; a < 8 && !hit; a++) {
      const th = (a / 8) * Math.PI * 2;
      for (const pitch of [-0.55, -0.35, -0.15, 0.05]) {
        w.spawnAt(p.x + Math.sin(th) * 0.75, p.z + Math.cos(th) * 0.75, p.y - 1.15, th, pitch);
        g.update(0.05);
        const t = g.nearestInteraction();
        if (t && t.kind === 'pickup' && t.id === 'phone') { hit = { prompt: document.getElementById('prompt')?.textContent }; break; }
      }
    }
    if (!hit) return { found: true, reached: false };
    g.interact();
    return { found: true, reached: true, prompt: hit.prompt, inInventory: g.inventory.has('phone') };
  });

  // the phone model is loaded on demand; give the loader time
  const held = await page.waitForFunction(() => {
    const g = window.__silid.game;
    return !!(g.heldPhone && g.heldPhoneGroup);
  }, null, { timeout: 60000 }).then(() => true).catch(() => false);

  const state = await page.evaluate(() => {
    const g = window.__silid.game;
    return {
      held: !!g.heldPhone,
      heldGroupVisible: g.heldPhoneGroup ? g.heldPhoneGroup.visible : null,
      phoneMeshes: g.heldPhoneGroup ? (() => { let n = 0; g.heldPhoneGroup.traverse((o) => { if (o.isMesh) n++; }); return n; })() : 0,
    };
  });

  // look at the hand for the photograph
  await page.evaluate(() => {
    const w = window.__silid;
    w.game.player.pitch = -0.45;
    w.game.update(0.05);
  });
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/06_phone_in_hand.png`, Buffer.from(data, 'base64'));

  console.log(JSON.stringify({ taken, held, state, pageErrors: errors }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
