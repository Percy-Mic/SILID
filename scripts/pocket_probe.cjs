// Probe: verify the phone is a physical object that starts on the console,
// can be taken (E), pocketed (O), taken out again (O), and opened (P).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:5333/';
const OUT = path.resolve('reports/pocket_probe');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 400000, polling: 500 });
  // Give the phone GLB time to land so the console copy exists.
  await page.waitForTimeout(2500);

  const state = async () => await page.evaluate(() => {
    const g = window.__silid?.game;
    if (!g) return { noGame: true };
    return {
      inventoryPhone: g.inventory.has('phone'),
      heldPhone: !!g.heldPhone,
      heldGroup: !!g.heldPhoneGroup,
      heldGroupParent: g.heldPhoneGroup?.parent?.name ?? null,
      pocketed: !!g.pocketed,
      pocketAnchor: !!g.pocketAnchor,
      worldPhoneVisible: g.worldPhone?.visible ?? 'n/a',
      phoneMarkVisible: (g.pickupMeshes.get('phone') || {}).visible ?? 'n/a',
      heldGroupPos: g.heldPhoneGroup?.position.toArray().map(n => +n.toFixed(3)) ?? null,
      anchorPos: g.pocketAnchor?.position.toArray().map(n => +n.toFixed(3)) ?? null,
    };
  });

  const shot = (name) => page.screenshot({ path: path.join(OUT, name) });

  console.log('--- initial ---');
  console.log(JSON.stringify(await state(), null, 1));
  await shot('00_initial.png');

  // Click the canvas to lock the pointer, then take the phone with E.
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
  console.log('--- after take (E) ---');
  console.log(JSON.stringify(await state(), null, 1));
  await shot('01_taken.png');

  // Pocket with O (phone is lowered after take).
  await page.keyboard.press('KeyO');
  await page.waitForTimeout(1200);
  console.log('--- after pocket (O) ---');
  console.log(JSON.stringify(await state(), null, 1));
  await shot('02_pocketed.png');

  // Take out with O.
  await page.keyboard.press('KeyO');
  await page.waitForTimeout(1200);
  console.log('--- after take-out (O) ---');
  console.log(JSON.stringify(await state(), null, 1));
  await shot('03_takeout.png');

  // Open with P.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(1500);
  console.log('--- after open (P) ---');
  console.log(JSON.stringify(await state(), null, 1));
  await shot('04_open.png');

  // Close with P.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(900);
  console.log('--- after close (P) ---');
  console.log(JSON.stringify(await state(), null, 1));
  await shot('05_closed.png');

  // Pocket again.
  await page.keyboard.press('KeyO');
  await page.waitForTimeout(1200);
  console.log('--- after pocket again (O) ---');
  console.log(JSON.stringify(await state(), null, 1));
  await shot('06_pocketed2.png');

  fs.writeFileSync(path.join(OUT, 'state.json'), JSON.stringify(await state(), null, 1));
  fs.writeFileSync(path.join(OUT, 'logs.txt'), logs.join('\n') + '\n');
  await browser.close();
  console.log('--- DONE ---');
})().catch((e) => { console.error(e); process.exit(1); });
