/**
 * Verifies the 3D phone model appears after pickup.
 * Loads the game, waits for boot, picks up the phone, and captures console output.
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
    page.setDefaultTimeout(5000);

    const lines = [];
    page.on('pageerror', (err) => lines.push('[pageerror] ' + err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') lines.push('[console error] ' + msg.text());
      if (msg.type() === 'log') lines.push('[console log] ' + msg.text());
    });

    console.log('Loading page: http://localhost:5555');
    await page.goto('http://localhost:5555', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Page loaded, waiting for game to boot...');

    // Wait for boot to complete (max 20 seconds)
    await page.waitForFunction(() => {
      const bar = document.getElementById('boot-bar');
      if (bar && parseInt(bar.style.width, 10) >= 100) return true;
      const bag = document.getElementById('bag');
      return !!bag;
    }, { timeout: 20000 }).catch(() => {
      console.log('Timeout waiting for boot to complete');
    });

    await page.waitForTimeout(2000);

    console.log('\n--- game state snapshot ---');
    const room = await page.$eval('#room', el => el.textContent).catch(() => 'N/A');
    console.log('Room:', room);
    const level = await page.$eval('#level', el => el.textContent).catch(() => 'N/A');
    console.log('Level:', level);
    const bag = await page.$eval('#bag', el => el.textContent).catch(() => 'N/A');
    console.log('Inventory:', bag);

    // Check if phone prompt is visible
    const promptVisible = await page.$eval('#prompt', el => el.classList.contains('on')).catch(() => false);
    console.log('Prompt visible:', promptVisible);
    if (promptVisible) {
      const promptText = await page.$eval('#prompt', el => el.innerHTML).catch(() => '');
      console.log('Prompt text:', promptText);
      if (promptText.toLowerCase().includes('phone')) {
        console.log('Picking up phone...');
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(1000);
      }
    }

    // Check phone state via game object
    const phoneState = await page.evaluate(() => {
      const game = window.game || window.__game;
      if (!game) return { error: 'game object not found' };
      return {
        hasPhone: game.inventory?.has('phone'),
        heldPhone: !!game.heldPhone,
        heldPhoneGroup: !!game.heldPhoneGroup,
        phoneInfo: game._phoneInfo ? { meshes: game._phoneInfo.meshes?.length || 0 } : null,
      };
    }).catch(() => ({ error: 'could not evaluate' }));
    console.log('Phone state:', JSON.stringify(phoneState, null, 2));

    console.log('\n=== CONSOLE OUTPUT ===');
    lines.forEach((l) => console.log(l));
    console.log('=== END CONSOLE ===');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser?.close();
  }
})();
