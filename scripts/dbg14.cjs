const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const read=()=>p.evaluate(()=>{const s=window.__silid;return{z:+s.player.pos.z.toFixed(2),foot:+s.player.footY.toFixed(2),keys:{...s.player.keys},en:s.player.enabled};});
  await p.evaluate(()=>window.__silid.spawnAt(0,12.6,0,0,0));
  await p.waitForTimeout(300);
  await p.keyboard.down('w'); await p.waitForTimeout(2500); await p.keyboard.up('w');
  const kb=await read();
  await p.evaluate(()=>{const pl=window.__silid.player; pl.keys.KeyW=true; for(let i=0;i<60;i++){pl.update(0.05,window.__silid.game);window.__silid.game.update(0.05);} pl.keys.KeyW=false;});
  const sim=await read();
  console.log(JSON.stringify({kb,sim}));
  await b.close();
})();
