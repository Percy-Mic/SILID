const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 600), '\n', (e.stack || '').split('\n').slice(0, 8).join('\n')));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForTimeout(25000);
  console.log('BOOT TEXT:', (await p.evaluate(() => document.getElementById('boot')?.innerText || '(none)')).slice(0, 300));
  console.log('READY:', await p.evaluate(() => !!window.__silid?.ready));
  await b.close();
})();
