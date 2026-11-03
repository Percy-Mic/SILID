/**
 * Quick check of phone state in the game.
 */

const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: 'C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe',
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));

    console.log('Loading page...');
    await page.goto('http://localhost:5555?__debug__', { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 8000 });

    // Wait for game object
    await page.waitForFunction(() => window.__game, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Wait for async phone loading and capture any errors
    await page.waitForTimeout(5000);

    // Check phone state
    const phoneState = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return { error: 'game not found' };
      
      const info = game._phoneInfo;
      const group = game.heldPhoneGroup;
      
      return {
        hasPhone: game.inventory?.has('phone'),
        heldPhone: !!game.heldPhone,
        heldPhoneGroup: !!group,
        phoneInfo: info ? {
          meshes: info.meshes?.length || 0,
          materials: info.materials?.length || 0,
          gltf: !!info.gltf,
        } : null,
        phoneGroupChildren: group ? group.children.length : 0,
        phoneGroupVisible: group?.visible ?? 'N/A',
        phoneGroupPosition: group ? `${group.position.x.toFixed(2)}, ${group.position.y.toFixed(2)}, ${group.position.z.toFixed(2)}` : 'N/A',
        phoneGroupScale: group ? `${group.scale.x.toFixed(2)}, ${group.scale.y.toFixed(2)}, ${group.scale.z.toFixed(2)}` : 'N/A',
        phoneChildren: group ? group.children.map((c, i) => ({
          name: c.name,
          visible: c.visible,
          pos: `${c.position.x.toFixed(2)}, ${c.position.y.toFixed(2)}, ${c.position.z.toFixed(2)}`,
          scale: `${c.scale.x.toFixed(2)}, ${c.scale.y.toFixed(2)}, ${c.scale.z.toFixed(2)}`,
          matColor: c.material?.color?.getHex?.() ?? 'N/A',
          matEmissive: c.material?.emissive?.getHex?.() ?? 'N/A',
        })) : [],
      };
    }).catch(e => ({ error: e.message }));

    console.log('\n=== PHONE STATE ===');
    console.log(JSON.stringify(phoneState, null, 2));

    // Also capture console logs
    const logs = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') logs.push('[log] ' + msg.text());
    });
    await page.waitForTimeout(1000);

    if (logs.length > 0) {
      console.log('\n=== CONSOLE LOGS (phone-related) ===');
      logs.filter(l => l.includes('phone') || l.includes('Phone') || l.includes('GLB') || l.includes('load')).forEach(l => console.log(l));
    }

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(e => console.log(e));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser?.close();
  }
})();
