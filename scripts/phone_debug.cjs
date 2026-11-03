/**
 * Debug script to check phone visibility and position.
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
    await page.goto('http://localhost:5555', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Page loaded, waiting for game to boot...');

    // Wait for boot to complete
    await page.waitForFunction(() => {
      const bar = document.getElementById('boot-bar');
      if (bar && parseInt(bar.style.width, 10) >= 100) return true;
      const bag = document.getElementById('bag');
      return !!bag;
    }, { timeout: 20000 }).catch(() => {
      console.log('Timeout waiting for boot');
    });

    await page.waitForTimeout(3000);

    // Navigate to foyer (where the phone should be)
    console.log('\nNavigating to foyer...');
    
    // Check current room
    const room = await page.$eval('#room', el => el.textContent).catch(() => 'unknown');
    console.log('Current room:', room);

    // If not in foyer, we might need to move. For now, let's check if we can see the phone prompt.
    const promptVisible = await page.$eval('#prompt', el => el.classList.contains('on')).catch(() => false);
    console.log('Prompt visible:', promptVisible);
    
    if (promptVisible) {
      const promptText = await page.$eval('#prompt', el => el.innerHTML).catch(() => '');
      console.log('Prompt text:', promptText);
    }

    // Check phone state
    const phoneState = await page.evaluate(() => {
      const game = window.game || window.__game;
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
        } : null,
        phoneGroup: group ? {
          children: group.children?.length || 0,
          position: group.position?.toArray?.() || [group.position.x, group.position.y, group.position.z],
          scale: group.scale?.toArray?.() || [group.scale.x, group.scale.y, group.scale.z],
          visible: group.visible,
          name: group.name,
        } : null,
        phoneChildren: group ? group.children.map((child, i) => ({
          name: child.name,
          visible: child.visible,
          position: child.position?.toArray?.() || [child.position.x, child.position.y, child.position.z],
          scale: child.scale?.toArray?.() || [child.scale.x, child.scale.y, child.scale.z],
          material: child.material ? {
            color: child.material.color?.getHex?.() || child.material.color,
            emissive: child.material.emissive?.getHex?.() || child.material.emissive,
            transparent: child.material.transparent,
            opacity: child.material.opacity,
          } : null,
        })) : [],
      };
    }).catch(e => ({ error: e.message }));

    console.log('\n=== PHONE STATE ===');
    console.log(JSON.stringify(phoneState, null, 2));

    // Take a screenshot
    await page.screenshot({ path: 'scripts/screenshots/phone_debug.png', fullPage: false });
    console.log('\nScreenshot saved to scripts/screenshots/phone_debug.png');

    console.log('\n=== CONSOLE LOGS (last 30) ===');
    logs.slice(-30).forEach(l => console.log(l));
    if (logs.length > 30) console.log(`... and ${logs.length - 30} more logs`);

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
