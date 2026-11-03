// Point probe: why can the player not walk past a coordinate? Lists every
// collider and furniture box that blocks the body at that point, plus the
// analytic floor heights around it. Run:
//   node scripts/why_blocked.cjs x z footY
const { chromium } = require('playwright');
const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const [x, z, y] = process.argv.slice(2).map(Number);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await page.evaluate(({ x, z, y }) => {
    const s = window.__silid;
    const pl = s.player;
    pl.footY = y;
    const px = x, pz = z;
    const hitsC = [];
    const r = pl.radius;
    for (const c of s.architecture.colliders) {
      if (!c || c.disabled) continue;
      if (c.y0 !== undefined && (y + 1.65 < c.y0 || y + 0.05 > c.y1)) continue;
      if (c.kind === 'rail' && Math.abs(y - c.baseY) > 0.6) continue;
      const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
      const l = dx * dx + dz * dz;
      let t = l ? ((px - c.x1) * dx + (pz - c.z1) * dz) / l : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = c.x1 + t * dx, qz = c.z1 + t * dz;
      const d = Math.hypot(px - qx, pz - qz);
      if (d < r) hitsC.push({ kind: c.kind, d: +d.toFixed(2), x1: +c.x1.toFixed(2), z1: +c.z1.toFixed(2), x2: +c.x2.toFixed(2), z2: +c.z2.toFixed(2), y0: c.y0, y1: c.y1 });
    }
    const hitsB = [];
    for (const b of s.props.colliders) {
      if (b.y0 !== undefined && (y + 1.65 < b.y0 || y + 0.05 > b.y1)) continue;
      if (px > b.x1 - r && px < b.x2 + r && pz > b.z1 - r && pz < b.z2 + r) hitsB.push(b);
    }
    const grid = [];
    for (let dz = -1.2; dz <= 1.2; dz += 0.4) {
      const row = [];
      for (let dx = -1.2; dx <= 1.2; dx += 0.4) {
        const f = s.floorAt(px + dx, pz + dz, y);
        row.push(f === null ? '  -- ' : f.toFixed(2).padStart(5));
      }
      grid.push(row.join(' '));
    }
    return { pos: { x, z, y }, hitsC, hitsB, floorGrid: grid };
  }, { x, z, y });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
