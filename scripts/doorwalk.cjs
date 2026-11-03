const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await p.evaluate(()=>window.__silid.spawnAt(0,12.9,0,0,0));
  await p.waitForTimeout(400);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
  await p.keyboard.down('w');
  const rows=[];
  for(let i=0;i<10;i++){ await p.waitForTimeout(500); rows.push(await p.evaluate(()=>{const pl=window.__silid.player; const d=window.__silid.architecture.doors.find(d=>d.level==='GF'&&d.axis==='x'&&Math.abs(d.c-11)<.1); return {z:+pl.pos.z.toFixed(2), vz:+pl.vel.z.toFixed(2), blocked:pl.blocked(pl.pos.x,pl.pos.z-0.05), doorDis:d.collider.disabled, rot:+d.mesh.rotation.y.toFixed(2), en:pl.enabled};})); }
  await p.keyboard.up('w');
  console.log(JSON.stringify(rows));
  await b.close();
})();
