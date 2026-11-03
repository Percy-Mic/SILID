const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await p.goto('http://127.0.0.1:5333/');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await new Promise(r => setTimeout(r, 800));
  const info = await p.evaluate(() => {
    const el = document.getElementById('boot-go');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const mid = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      inlineStyle: el.getAttribute('style'),
      topElement: mid ? (mid.id || mid.tagName) : null,
      bootHidden: document.getElementById('boot').classList.contains('hidden'),
      phase: window.__silid.opener.phase,
    };
  });
  console.log(JSON.stringify({ info, errs }, null, 1));
  await b.close();
})();
