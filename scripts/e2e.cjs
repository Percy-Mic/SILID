// End-to-end: the actual opening, the front door, both generator parts, the
// generator, the gate. Every position comes from the world, not the test.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const read = () => p.evaluate(() => {
    const s = window.__silid;
    return { x: +s.player.pos.x.toFixed(2), z: +s.player.pos.z.toFixed(2), foot: +s.player.footY.toFixed(2),
      room: document.getElementById('room').textContent,
      prompt: document.getElementById('prompt').textContent,
      msg: document.getElementById('msg').textContent,
      st: { ...s.game.state }, inv: [...s.game.inventory] };
  });
  const out = {};
  // 1. front door
  await p.evaluate(() => window.__silid.spawnAt(0, 12.6, 0, 0, 0));
  await p.waitForTimeout(400);
  out.doorPrompt = (await read()).prompt;
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(500);
  await p.keyboard.down('w'); await p.waitForTimeout(6000); await p.keyboard.up('w');
  out.inside = await read();

  // 2. pickups, approached from a walkable spot
  for (const id of ['fuel', 'fuse']) {
    const spot = await p.evaluate((id) => {
      const s = window.__silid, pl = s.player;
      const it = s.props.interactables.find(i => i.id === id);
      if (!it) return null;
      for (let r = 0.9; r < 2.4; r += 0.2) for (let a = 0; a < 24; a++) {
        const th = a / 24 * Math.PI * 2;
        const x = it.x + Math.cos(th) * r, z = it.z + Math.sin(th) * r;
        const y = s.floorAt(x, z, it.y - 0.9);
        if (y === null || Math.abs(y - (it.y - 0.9)) > 1.6) continue;
        pl.teleport(x, z, y);
        pl.yaw = Math.atan2(-(it.x - x), -(it.z - z));
        pl.syncCamera();
        if (!pl.blocked(x, z)) return { x, z, y };
      }
      return null;
    }, id);
    out[id + 'Spot'] = spot;
    if (spot) { await p.waitForTimeout(350); out[id + 'Prompt'] = (await read()).prompt; await p.keyboard.press('KeyE'); await p.waitForTimeout(400); }
  }
  out.afterPickups = await read();

  // 3. generator
  const gen = await p.evaluate(() => {
    const s = window.__silid, pl = s.player;
    const it = s.props.interactables.find(i => i.id === 'generator');
    const y = s.floorAt(it.x + 1.4, it.z + 1.0, -3.4);
    pl.teleport(it.x + 1.4, it.z + 1.0, y ?? -3.4);
    pl.yaw = Math.atan2(-(it.x - (it.x + 1.4)), -(it.z - (it.z + 1.0)));
    pl.syncCamera();
    return { gen: { x: it.x, z: it.z }, at: { x: pl.pos.x, z: pl.pos.z, foot: pl.footY } };
  });
  out.genSetup = gen;
  await p.waitForTimeout(350); out.genPrompt = (await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(900);
  out.afterGen = await read();

  // 4. gate
  await p.evaluate(() => { const pl = window.__silid.player; pl.teleport(-13.4, 16.6, null); pl.yaw = Math.PI; pl.syncCamera(); });
  await p.waitForTimeout(400); out.gatePrompt = (await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(5200);
  out.gate = await read();
  out.ended = await p.evaluate(() => window.__silid.game.state.ended);
  out.errors = errs;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
