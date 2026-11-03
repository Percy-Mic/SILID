import { LEVELS } from '../src/world/plan.js';
for (const lv of LEVELS) {
  console.log('== ' + lv.id + ' y=' + lv.y);
  for (const r of lv.rooms) {
    const nb = [];
    for (const q of lv.rooms) {
      if (q === r) continue;
      // shared vertical wall (x = const)
      if (Math.abs(q.x0 - r.x1) < 0.01 || Math.abs(q.x1 - r.x0) < 0.01) {
        const a = Math.max(r.z0, q.z0), b = Math.min(r.z1, q.z1);
        if (b - a > 0.6) nb.push(`${q.id} E/W len=${(b-a).toFixed(1)} c=${q.x0 === r.x1 ? r.x1 : r.x0}`);
      }
      if (Math.abs(q.z0 - r.z1) < 0.01 || Math.abs(q.z1 - r.z0) < 0.01) {
        const a = Math.max(r.x0, q.x0), b = Math.min(r.x1, q.x1);
        if (b - a > 0.6) nb.push(`${q.id} N/S len=${(b-a).toFixed(1)} c=${q.z0 === r.z1 ? r.z1 : r.z0}`);
      }
    }
    const doors = lv.doors.filter(d => {
      const inside = (v, lo, hi) => v >= lo - 0.05 && v <= hi + 0.05;
      if (d.axis === 'x') return inside(d.c, r.z0, r.z1) && (Math.abs(d.c - r.z0) < 0.05 || Math.abs(d.c - r.z1) < 0.05) && inside(d.at, r.x0, r.x1);
      return inside(d.c, r.x0, r.x1) && (Math.abs(d.c - r.x0) < 0.05 || Math.abs(d.c - r.x1) < 0.05) && inside(d.at, r.z0, r.z1);
    }).map(d => `${d.axis}${d.c}@${d.at}`);
    console.log(` ${r.id} ${r.name} [${r.x0},${r.x1}]x[${r.z0},${r.z1}] doors=${doors.join(',') || '-'}`);
    console.log('    nb: ' + (nb.join(' | ') || 'NONE'));
  }
}
