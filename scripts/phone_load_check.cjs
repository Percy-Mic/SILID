/**
 * Check if phone GLB is loading and capture all console output.
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

    const allLogs = [];
    page.on('console', (msg) => {
      allLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      allLogs.push(`[pageerror] ${err.message}`);
    });

    console.log('Loading page...');
    await page.goto('http://localhost:5555?__debug__', { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 8000 });

    // Wait for game to boot
    await page.waitForFunction(() => window.__game, { timeout: 10000 }).catch(() => {});
    console.log('Game object found, waiting for phone to load...');

    // Wait for phone to load (up to 15 seconds)
    await page.waitForFunction(() => {
      const game = window.__game;
      return game && game._phoneInfo;
    }, { timeout: 15000 }).catch(() => {
      console.log('Timeout waiting for phone to load');
    });

    await page.waitForTimeout(500);

    // Check phone state
    const phoneState = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return { error: 'game not found' };
      const info = game._phoneInfo;
      return {
        phoneInfo: info ? { meshes: info.meshes?.length || 0 } : null,
        inventoryHasPhone: game.inventory?.has('phone'),
      };
    }).catch(e => ({ error: e.message }));

    console.log('\n=== PHONE STATE ===');
    console.log(JSON.stringify(phoneState, null, 2));

    // Print all logs related to phone/GLB loading
    console.log('\n=== PHONE/GLB LOGS ===');
    allLogs.filter(l => l.includes('phone') || l.includes('Phone') || l.includes('GLB') || l.includes('load') || l.includes('material')).forEach(l => console.log(l));

    // Print any errors
    const errors = allLogs.filter(l => l.includes('error') || l.includes('Error') || l.includes('failed'));
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(l => console.log(l));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser?.close();
  }
})();
