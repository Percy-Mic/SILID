const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  p.on('console', m => console.log('CONSOLE', m.type(), m.text().slice(0,200)));
  await p.goto('http://127.0.0.1:5199/scripts/roomview.html?f=' + encodeURIComponent('/Blender/AssetLibrary/the_great_drawing_room.glb'));
  for (let i=0;i<40;i++) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => ({ ready: window.__room?.ready, err: window.__room?.error, hud: document.getElementById('hud').textContent.slice(0,80) }));
    if (s.ready || s.err) { console.log('STATE', JSON.stringify(s)); break; }
    if (i % 5 === 0) console.log('waiting', i, JSON.stringify(s));
  }
  await b.close();
})();
