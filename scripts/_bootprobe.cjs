const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const logs = [];
  p.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0,400)));
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.stack?.slice(0,900)));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForTimeout(45000);
  const state = await p.evaluate(() => ({
    ready: !!window.__silid?.ready,
    boot: document.getElementById('boot')?.innerText?.slice(0,500),
    msg: document.getElementById('boot-msg')?.textContent,
    bar: document.getElementById('boot-bar')?.style.width,
  })).catch(e => ({evalError: String(e)}));
  console.log(JSON.stringify({state, logs}, null, 1));
  await p.screenshot({path: 'reports/boot_probe.png'});
  await b.close();
})();
