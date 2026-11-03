const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const read = () => p.evaluate(() => {
    const s = window.__silid;
    return { x:+s.player.pos.x.toFixed(2), y:+s.player.pos.y.toFixed(2), z:+s.player.pos.z.toFixed(2), foot:+s.player.footY.toFixed(2),
      room: document.getElementById('room').textContent, level: document.getElementById('level').textContent,
      prompt: document.getElementById('prompt').textContent, msg: document.getElementById('msg').textContent,
      phase: s.game.state.phase, powered: s.game.state.powered, inv:[...s.game.inventory] };
  });
  const out = {};

  // 1. free movement on the verge
  await p.evaluate(() => window.__silid.spawnAt(-53.4, 27.2, null, -Math.PI/2, 0));
  const before = await read();
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
  const after = await read();
  out.move = { before, after, moved: +(Math.hypot(after.x-before.x, after.z-before.z)).toFixed(2) };

  // 2. front door: approach, prompt, open, walk through
  await p.evaluate(() => window.__silid.spawnAt(0, 12.9, 0, 0, -0.02));
  await p.waitForTimeout(700);
  out.doorPrompt = (await read()).prompt;
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(900);
  out.doorAfter = await read();
  const dz = out.doorAfter.z;
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1900); await p.keyboard.up('KeyW');
  const inside = await read();
  out.walkedIn = { fromZ: dz, to: inside, entered: inside.z < 11.2 && inside.z > 1 };

  // 3. wall collision: on the gallery, walk north into the library wall
  await p.evaluate(() => { window.__silid.spawnAt(0, 0, 0, 0, 0); window.__silid.player.yaw = Math.PI; });
  await p.waitForTimeout(400);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1400); await p.keyboard.up('KeyW');
  out.wallStop = await read();

  // 4. basement pickups and generator
  await p.evaluate(() => { window.__silid.spawnAt(9.5, -5, -3.4, -2.6, 0); });
  await p.waitForTimeout(600);
  out.workshopPrompt = (await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
  out.afterFuse = await read();

  await p.evaluate(() => { window.__silid.spawnAt(1.0, -6.0, -3.4, -2.9, 0); });
  await p.waitForTimeout(600);
  out.genRoomPrompt = (await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
  out.afterFuel = await read();

  await p.evaluate(() => { window.__silid.spawnAt(3.0, -3.4, -3.4, 0.2, 0); });
  await p.waitForTimeout(600);
  out.genPrompt = (await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
  out.afterRepair = await read();

  // 5. gate
  await p.evaluate(() => { window.__silid.spawnAt(-13.4, 20.0, null, 0, 0); });
  await p.waitForTimeout(600);
  out.gatePrompt = (await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
  out.afterGate = await read();
  out.ended = await p.evaluate(() => window.__silid.game.state.ended);
  out.errors = errs;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
