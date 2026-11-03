// Static audit: how far is each storey's exterior wall from the rooms behind it?
//
// Reads the plan (not the scene) because the question is a plan question: the
// perimeter wall is built on the shared FOOT outline while the rooms are laid
// out inside it. Where a room stops short of that outline, the strip between
// them is not a wall, it is an empty cavity — and every window cut in the
// perimeter opens into it instead of into the room.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'world', 'plan.js'), 'utf8')
  .replace(/export const/g, 'const')
  .replace(/export function/g, 'function')
  .replace(/export default/g, 'const __default =');
const plan = new Function(src + '\nreturn { LEVELS, FOOT, WINDOWS };')();

const W = plan.WINDOWS || { sill: 0.85, head: 2.65, width: 1.15, spacing: 2.6 };
const rows = [];

for (const level of plan.LEVELS) {
  const fp = level.footprint;
  if (level.id === 'B1') continue;
  const edges = [
    ['south', 'x', fp.z1, 1],
    ['north', 'x', fp.z0, -1],
    ['east', 'z', fp.x1, 1],
    ['west', 'z', fp.x0, -1],
  ];
  for (const [name, axis, line, out] of edges) {
    // rooms whose span faces this edge
    const facing = level.rooms.filter((r) => {
      if (axis === 'x') return Math.min(r.z0, r.z1) <= line + 1e-6 && Math.max(r.z0, r.z1) >= line - 1e-6
        ? false : Math.min(r.z0, r.z1) < line + 1e-6 && Math.max(r.z0, r.z1) <= line + 1e-6;
      return Math.min(r.x0, r.x1) < line + 1e-6 && Math.max(r.x0, r.x1) <= line + 1e-6;
    });
    const gaps = [];
    for (const r of level.rooms) {
      const near = axis === 'x'
        ? (out > 0 ? r.z1 : r.z0)     // room's edge toward this perimeter
        : (out > 0 ? r.x1 : r.x0);
      const gap = Math.abs(line - near);
      if (gap > 1e-6 && gap < 8) gaps.push({ room: r.id, gap: +gap.toFixed(2) });
    }
    // windows are generated along the perimeter span; count the ones that fall
    // in front of a room's footprint (so they open into the room behind them)
    const spanA = axis === 'x' ? fp.x0 : fp.z0;
    const spanB = axis === 'x' ? fp.x1 : fp.z1;
    const wins = [];
    for (let at = spanA + 1.9; at <= spanB - 1.4; at += W.spacing) {
      const wa = at - W.width / 2, wb = at + W.width / 2;
      if (wa < spanA + 0.4 || wb > spanB - 0.4) continue;
      // what is behind this window, and how far back does that room start?
      let best = null;
      for (const r of level.rooms) {
        const along = axis === 'x'
          ? (wa >= r.x0 - 0.2 && wb <= r.x1 + 0.2)
          : (wa >= r.z0 - 0.2 && wb <= r.z1 + 0.2);
        if (!along) continue;
        const near = axis === 'x' ? (out > 0 ? r.z1 : r.z0) : (out > 0 ? r.x1 : r.x0);
        const gap = Math.abs(line - near);
        if (!best || gap < best.gap) best = { room: r.id, roomName: r.name, gap: +gap.toFixed(2) };
      }
      wins.push({ at: +at.toFixed(2), behind: best });
    }
    const byGap = {};
    for (const w of wins) {
      const g = w.behind ? w.behind.gap : 'none';
      byGap[g] = (byGap[g] || 0) + 1;
    }
    rows.push({ level: level.id, edge: name, windows: wins.length, byGap, widest: gaps.sort((a, b) => b.gap - a.gap).slice(0, 3) });
  }
}

console.log(JSON.stringify(rows, null, 1));
const bad = rows.filter((r) => Object.keys(r.byGap).some((g) => g !== '0' && g !== 'none'));
console.log('\nEdges where windows open into a cavity: ' + bad.length + ' of ' + rows.length);
