const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const r = await p.evaluate(() => {
    const w = window.__silid, pl = w.player;
    const at = (x, z, y) => { pl.footY = y; return pl.blocked(x, z); };
    const out = {};
    // before the door is opened the threshold must be clear of the plinth
    out.threshold_outside = at(0, 11.62, 0);
    out.threshold_mid = at(0, 11.35, 0);
    out.threshold_inside = at(0, 10.9, 0);
    // west service door on x = -24
    out.west_out = at(-24.62, 6, 0);
    out.west_mid = at(-24.35, 6, 0);
    // turrets
    out.turret_e_in = at(23.5, 8.3, 0);
    out.turret_e_out = at(26.0, 8.3, 0);
    out.turret_w_in = at(-25.4, 8.3, 0);
    out.turret_w_out = at(-28.0, 8.3, 0);
    // roof deck against the parapet, and around a chimney base
    const deck = [];
    for (const [x, z] of [[0, 10.2], [-20, 0], [15, 8], [0, -9.8], [20, -4]]) deck.push([x, z, at(x, z, 11.6)]);
    out.deck = deck;
    // entrance porch free of new collider
    out.porch = [at(0, 13.4, 0), at(-4.2, 13.4, 0), at(4.2, 13.4, 0)];
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  // then walk in through the front door for real
  const walk = await p.evaluate(() => {
    const w = window.__silid, pl = w.player;
    w.spawnAt(0, 14.2, 0, 0, 0);
    pl.enabled = true;
    // open the entrance door if it is shut
    const d = w.architecture.doors.find((dd) => dd.entrance);
    if (d && !d.open) { d.open = true; d.target = 1; if (d.collider) d.collider.disabled = true; }
    pl.keys.KeyW = true;
    for (let i = 0; i < 400; i++) { pl.update(0.02, w.game); w.game.update(0.02); }
    pl.keys.KeyW = false;
    return { x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2), room: w.game.nearestInteraction?.() ?? null };
  });
  console.log('walked in:', JSON.stringify(walk));
  await b.close();
})();
