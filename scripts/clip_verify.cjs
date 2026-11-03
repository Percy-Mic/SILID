// CLIP VERIFY — exact geometry check for the hits of scripts/clip_audit.cjs.
//
// The audit flags a prop whose AXIS-ALIGNED footprint enters a wall band. An
// AABB over a rotated piece can do that while the mesh itself does not, so this
// rebuilds each flagged prop's real triangles at its real transform and
// measures how far the geometry actually goes inside the masonry — from the
// face it enters, and whether it reaches the far face at all.
//
// Usage: node scripts/clip_verify.cjs [auditJson]
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const IN = process.argv[2] || 'reports/clip_audit.json';

(async () => {
  const audit = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const targets = (audit.wall || []).concat(audit.floor || [], audit.floating || []);
  if (!targets.length) { console.log('no findings to verify'); return; }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000, polling: 500 });

  const rows = await page.evaluate((targets) => {
    const s = window.__silid;
    const THREE = s.THREE;
    const LEVELS = s.levels;
    const scene = s.scene;
    scene.updateMatrixWorld(true);

    const out = [];
    for (const f of targets) {
      const row = { name: f.name, level: f.level, at: [f.x, f.z], aabbDepth: f.depth, band: f.wall || null };

      const p = s.props.placed.find((q) => q.name === f.name && q.level === f.level
        && Math.abs(q.x - f.x) < 0.8 && Math.abs(q.z - f.z) < 0.8);
      if (!p) { row.error = 'no placed record for this hit'; out.push(row); continue; }
      const tpl = s.furniture.templates.get(f.name);
      const lev = LEVELS.find((l) => l.id === p.level);
      const y = typeof p.y === 'number' ? p.y : (lev ? lev.y : 0);
      row.record = { x: p.x, z: p.z, rot: +(+p.rot).toFixed(3), y, solid: p.solid !== false };

      if (!f.wall) { row.error = 'not a wall finding'; out.push(row); continue; }
      const line = f.wall.line, half = f.wall.half, axis = f.wall.axis;
      const a = f.wall.span[0], b = f.wall.span[1];
      const centre = axis === 'x' ? (p.z - 0) : (p.x);
      const side = centre < line ? -1 : 1;   // which face the piece comes from

      // rebuild the piece exactly as props.place() put it into the scene
      const geos = tpl.geos.map((g) => {
        const c = g.geo.clone();
        if (p.rot) c.rotateY(p.rot);
        c.translate(p.x, y, p.z);
        return c.index ? c.toNonIndexed() : c;
      });

      let deepest = 0, triInside = 0, triTotal = 0, deepestPt = null, pastFarFace = 0;
      const bandLo = line - half, bandHi = line + half;
      for (const g of geos) {
        const arr = g.attributes.position.array;
        for (let i = 0; i + 8 < arr.length; i += 9) {
          triTotal++;
          let triDeep = 0;
          for (let k = 0; k < 3; k++) {
            const x = arr[i + k * 3], yy = arr[i + k * 3 + 1], z = arr[i + k * 3 + 2];
            const along = axis === 'x' ? x : z;
            if (along < a || along > b) continue;              // beyond the wall's end
            const perp = axis === 'x' ? z : x;
            // distance past the face the piece comes from
            const d = side < 0 ? perp - bandLo : bandHi - perp;
            if (d <= 0) continue;
            if (d > triDeep) triDeep = d;
            if (d > deepest) { deepest = d; deepestPt = [+(x).toFixed(2), +(yy).toFixed(2), +(z).toFixed(2)]; }
            // how far past the OUTER face (the far side of the band)
            const far = side < 0 ? perp - bandHi : bandLo - perp;
            if (far > pastFarFace) pastFarFace = far;
          }
          if (triDeep > 0.005) triInside++;
        }
      }
      g0: {
        row.triangles = triTotal;
        row.trianglesInsideWall = triInside;
        row.exactDepth = +deepest.toFixed(3);
      }
      row.pastFarFace = +pastFarFace.toFixed(3);
      row.deepestPoint = deepestPt;
      row.side = side;
      row.verdict = deepest > 0.02
        ? (pastFarFace > 0.005 ? 'REAL — geometry reaches the far face of the wall'
          : 'REAL — geometry buried ' + Math.round(deepest * 100) + ' cm inside the wall')
        : (triInside > 0 ? 'minor — ' + Math.round(deepest * 100) + ' cm inside the wall'
          : 'AABB ONLY — the mesh itself does not enter the wall');
      out.push(row);
    }
    return out;
  }, targets);

  const outJson = IN.replace(/\.json$/, '_verified.json');
  fs.writeFileSync(outJson, JSON.stringify(rows, null, 1));
  for (const r of rows) {
    console.log('-', r.name, r.level, '@', r.at.join(','), '| band', JSON.stringify(r.band));
    console.log('   aabb', r.aabbDepth + 'm', '| exact', r.exactDepth + 'm',
      '| tris in wall', r.trianglesInsideWall + '/' + r.triangles,
      '| past far face', r.pastFarFace + 'm', '| deepest pt', JSON.stringify(r.deepestPoint));
    console.log('   VERDICT:', r.verdict, r.error || '');
  }
  if (errors.length) console.log('page errors:', errors.slice(0, 3));
  console.log('written:', outJson);
  await browser.close();
})();