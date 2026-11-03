const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR '+e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const read = () => p.evaluate(() => { const s=window.__silid; return {x:+s.player.pos.x.toFixed(2), z:+s.player.pos.z.toFixed(2), foot:+s.player.footY.toFixed(2), room:document.getElementById('room').textContent, level:document.getElementById('level').textContent, prompt:document.getElementById('prompt').textContent, msg:document.getElementById('msg').textContent, powered:s.game.state.powered, inv:[...s.game.inventory]}; });
  const out={};
  // walk in through the front door, hold long enough for the headless frame rate
  await p.evaluate(() => window.__silid.spawnAt(0, 12.9, 0, 0, 0));
  await p.waitForTimeout(500);
  out.doorPrompt=(await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
  out.openedDoor=await p.evaluate(()=>{const d=window.__silid.architecture.doors.find(d=>d.level==='GF'&&d.axis==='x'&&Math.abs(d.c-11)<0.1); return {open:d.open, rot:+d.mesh.rotation.y.toFixed(2), disabled:d.collider.disabled};});
  await p.keyboard.down('w'); await p.waitForTimeout(7000); await p.keyboard.up('w');
  out.afterWalkIn=await read();
  // workshop fuse, on the bench
  await p.evaluate(() => window.__silid.spawnAt(10.4, -0.4, -3.0, -Math.PI/2, -0.15));
  out.fusePos = await p.evaluate(()=>window.__silid.props.interactables.find(i=>i.id==='fuse'));
  await p.waitForTimeout(600); out.fusePrompt=(await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(500); out.afterFuse=await read();
  // fuel
  await p.evaluate(() => window.__silid.spawnAt(1.3, -6.2, -3.4, Math.PI, -0.1));
  await p.waitForTimeout(600); out.fuelPrompt=(await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(500); out.afterFuel=await read();
  // generator
  await p.evaluate(() => window.__silid.spawnAt(3.0, -3.6, -3.4, 0, -0.05));
  await p.waitForTimeout(600); out.genPrompt=(await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(900); out.afterGen=await read();
  // gate
  await p.evaluate(() => window.__silid.spawnAt(-13.4, 20.0, null, 0, 0));
  await p.waitForTimeout(600); out.gatePrompt=(await read()).prompt;
  await p.keyboard.press('KeyE'); await p.waitForTimeout(5000); out.gate=await read();
  out.ended=await p.evaluate(()=>window.__silid.game.state.ended);
  out.errors=errs;
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
