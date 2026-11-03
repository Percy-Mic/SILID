// Connectivity audit: which rooms on each level are cut off from the level's
// main circulation? Doors are opened first, because a closed door is not a
// missing doorway. Grid BFS over player.blocked(), one level at a time.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const out = await p.evaluate(() => {
    const s = window.__silid, pl = s.player;
    for (const d of s.architecture.doors) if (d.collider) d.collider.disabled = true;
    const step = 0.25, rep = [];
    for (const lv of s.levels) {
      pl.footY = lv.y;
      const f = lv.footprint;
      const NX = Math.round((f.x1 - f.x0) / step), NZ = Math.round((f.z1 - f.z0) / step);
      const open = new Uint8Array(NX * NZ);
      for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
        const x = f.x0 + i * step, z = f.z0 + j * step;
        open[i * NZ + j] = pl.blocked(x, z) ? 0 : 1;
      }
      const comp = new Int32Array(NX * NZ).fill(-1);
      let best = -1, bestN = 0, nc = 0;
      for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
        const k = i * NZ + j;
        if (!open[k] || comp[k] >= 0) continue;
        const stack = [k]; comp[k] = nc; let n = 0;
        while (stack.length) {
          const c = stack.pop(); n++;
          const ci = (c / NZ) | 0, cj = c % NZ;
          for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const ni = ci + di, nj = cj + dj;
            if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
            const nk = ni * NZ + nj;
            if (!open[nk] || comp[nk] >= 0) continue;
            comp[nk] = nc; stack.push(nk);
          }
        }
        if (n > bestN) { bestN = n; best = nc; }
        nc++;
      }
      const rooms = lv.rooms.map(r => {
        const seenC = new Set();
        for (let x = r.x0 + 0.5; x <= r.x1 - 0.3; x += 0.5)
          for (let z = r.z0 + 0.5; z <= r.z1 - 0.3; z += 0.5) {
            const i = Math.round((x - f.x0) / step), j = Math.round((z - f.z0) / step);
            if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
            const c = comp[i * NZ + j]; if (c >= 0) seenC.add(c);
          }
        return { id: r.id, name: r.name, main: seenC.has(best), comps: [...seenC] };
      });
      rep.push({ level: lv.id, components: nc, mainSize: bestN, unreachable: rooms.filter(r => !r.main).map(r => r.id + ' ' + r.name) });
    }
    return rep;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
