// Apparatus test: the fuse panel must open, take the workshop fuse, and the
// generator must accept power once the fuse is in the carrier. Drives the real
// interact path.
const { chromium } = require('playwright');
const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await page.evaluate(() => {
    const s = window.__silid;
    const g = s.game, pl = s.player;
    const box = s.apparatus.fuseBox;
    if (!box) return { error: 'no fuse box' };
    const t = box.target;

    // stand in front of the panel (it faces -x) and look at it
    s.spawnAt(t.x + 0.55, t.z, -3.4, Math.PI / 2, 0);
    g.update(0.05);
    const first = g.nearestInteraction();
    g.interact();
    for (let i = 0; i < 60; i++) g.update(0.033);
    const afterOpen = { id: first?.id, label: document.getElementById('prompt')?.textContent, angle: +box.hinge.rotation.y.toFixed(2), open: box.open };

    // give the player the fuse the workshop holds, then fit it
    g.inventory.add('fuse');
    g.state.hasFuse = true;
    g.update(0.05);
    const second = g.nearestInteraction();
    g.interact();
    g.update(0.05);
    const afterFit = { id: second?.id, label: document.getElementById('prompt')?.textContent, installed: box.fuseInstalled, visible: box.fuse.visible };

    // close the cover
    g.interact();
    for (let i = 0; i < 60; i++) g.update(0.033);
    const afterClose = { open: box.open, angle: +box.hinge.rotation.y.toFixed(2) };

    // generator: needs fuel, accepts with the fuse fitted
    const gen = s.props.interactables.find((i) => i.id === 'generator');
    s.spawnAt(gen.x, gen.z + 1.1, -3.4, 0, -0.2);
    g.update(0.05);
    const noFuel = g.nearestInteraction();
    g.interact();
    g.state.hasFuel = true;
    g.inventory.add('fuel');
    g.update(0.05);
    g.interact();
    for (let i = 0; i < 30; i++) g.update(0.033);
    const powered = g.state.powered;

    return { box: { x: +box.root.position.x.toFixed(2), y: +box.root.position.y.toFixed(2), z: +box.root.position.z.toFixed(2) },
      afterOpen, afterFit, afterClose, generatorPrompt: noFuel?.id, powered };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
