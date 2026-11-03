/**
 * Simple check: load the page and capture any console errors.
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
    const logs = [];
    page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('[console error] ' + msg.text());
      if (msg.type() === 'log') logs.push('[console log] ' + msg.text());
    });

    console.log('Loading page...');
    const response = await page.goto('http://localhost:5555', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Response status:', response.status());
    
    await page.waitForTimeout(3000);
    
    // Check if boot overlay is hidden
    const bootHidden = await page.$eval('#boot', el => el.classList.contains('hidden')).catch(() => false);
    console.log('Boot overlay hidden:', bootHidden);
    
    // Check for key elements
    const hasCanvas = await page.$('canvas').then(el => !!el).catch(() => false);
    console.log('Has canvas:', hasCanvas);
    
    const hasHud = await page.$('#hud').then(el => !!el).catch(() => false);
    console.log('Has HUD:', hasHud);

    console.log('\n=== CONSOLE LOGS ===');
    logs.slice(0, 20).forEach(l => console.log(l));
    if (logs.length > 20) console.log(`... and ${logs.length - 20} more logs`);
    
    console.log('\n=== CONSOLE ERRORS ===');
    if (errors.length === 0) {
      console.log('(none)');
    } else {
      errors.forEach(e => console.log(e));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser?.close();
  }
})();
