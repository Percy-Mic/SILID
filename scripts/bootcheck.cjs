const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const logs=[]; p.on('pageerror',e=>logs.push('PAGEERROR '+e.message)); p.on('console',m=>{ if(m.type()!=='debug') logs.push(m.type()+': '+m.text()); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForTimeout(15000);
  console.log(await p.evaluate(()=>({ready:!!window.__silid, msg:document.getElementById('boot-msg')?.textContent, err:document.querySelector('.err')?.textContent, bar:document.getElementById('boot-bar')?.style.width})));
  console.log(logs.slice(0,12).join('\n'));
  await b.close();
})();
