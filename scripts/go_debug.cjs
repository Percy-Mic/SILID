const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.evaluate(() => { const w = window.__silid; w.game.trialsLeft = 1; w.game.invulnT = 0; w.hitPlayer(); });
  await p.waitForTimeout(2600);
  const info = await p.evaluate(() => {
    const o = document.getElementById('gameover');
    const btn = document.getElementById('go-restart');
    const r = btn?.getBoundingClientRect();
    return {
      overlay: !!o, html: o ? o.innerHTML.slice(0, 300) : null,
      btn: !!btn, rect: r ? [r.x, r.y, r.width, r.height] : null,
      styles: btn ? getComputedStyle(btn).pointerEvents + '/' + getComputedStyle(btn).visibility + '/' + getComputedStyle(btn).display : null,
      overlayPE: o ? getComputedStyle(o).pointerEvents : null,
      topAtBtn: r ? (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id || document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.tagName) : null,
      bodyChildren: [...document.body.children].map((e) => e.id || e.tagName),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  try { await p.click('#go-restart', { timeout: 5000 }); console.log('click ok'); } catch (e) { console.log('click fail', e.message.split('\n')[0]); }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
