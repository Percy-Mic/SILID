// INTERACTION PROBE.
//
// This does not inspect descriptions. It stands the real player in front of the
// real furniture, asks the game which action it is offering, presses E through
// the same interact() the player uses, runs the animation, and then reads the
// state back off the object: hinge angles, shelf contents, inventory, hiding
// mode. Anything that is still an "inspect" is a failure, not a warning.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = 'reports/interactions';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(600);

  const out = await page.evaluate(() => {
    const s = window.__silid;
    const g = s.game, pl = s.player;
    pl.enabled = true;
    const prompt = () => document.getElementById('prompt')?.textContent?.trim() ?? '';
    const run = (n = 120) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
    const aimAt = (px, pz, levelY, tx, ty, tz) => {
      const yaw = Math.atan2(-(tx - px), -(tz - pz));
      const pitch = Math.atan2(ty - (levelY + 1.68), Math.hypot(tx - px, tz - pz));
      s.spawnAt(px, pz, levelY, yaw, pitch);
      g.update(0.05);
    };

    const kinds = {};
    for (const it of s.props.interactables) kinds[it.kind] = (kinds[it.kind] || 0) + 1;

    // --- drawers -------------------------------------------------------------
    const drawers = [];
    for (const u of s.cabinets.units.filter((u) => (u.drawers ?? []).length)) {
      const d = u.drawers.find((x) => x.contents) || u.drawers[0];
      // Aim at THIS drawer's registered front point. The cabinet centre sits on
      // a different opening, so aiming there asks the game for its neighbour.
      const entry = s.props.interactables.find((it) => it.kind === 'drawer' && it.drawer === d);
      const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
      const px = u.x + fx * (u.d / 2 + 0.95), pz = u.z + fz * (u.d / 2 + 0.95);
      const aim = () => aimAt(px, pz, u.y, entry.x, entry.y, entry.z);
      aim();
      const t = g.nearestInteraction();
      const promptClosed = prompt();
      const z0 = d.holder.position.z;
      g.interact(); run();
      const z1 = d.holder.position.z;
      let item = null;
      if (d.contents && !d.contents.taken) {
        const n0 = g.inventory.size;
        aim();
        const t2 = g.nearestInteraction();
        const promptSearch = prompt();
        g.interact(); run(30);
        item = { kind: t2?.kind, target: t2?.id, promptSearch, taken: d.contents.taken, gained: g.inventory.size > n0 };
      }
      aim();
      g.interact(); run();
      drawers.push({
        label: u.label, target: t?.id, promptClosed,
        travel: +(z1 - z0).toFixed(3), open: d.open,
        item, closedAgain: !d.open, residual: +d.holder.position.z.toFixed(4),
      });
    }

    // --- two-door cupboards --------------------------------------------------
    const cupboards = [];
    for (const u of s.cabinets.units.filter((u) => (u.doors ?? []).length)) {
      const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
      const px = u.x + fx * (u.d / 2 + 0.95), pz = u.z + fz * (u.d / 2 + 0.95);
      const doorTarget = s.props.interactables.find((it) => it.kind === 'cupboard' && it.unit === u);
      aimAt(px, pz, u.y, doorTarget.x, doorTarget.y, doorTarget.z);
      const t = g.nearestInteraction();
      const promptClosed = prompt();
      const hinges0 = u.doors.map((d) => +d.hinge.rotation.y.toFixed(3));
      g.interact(); run();
      const hingesOpen = u.doors.map((d) => +d.hinge.rotation.y.toFixed(3));
      const promptOpen = prompt();

      const itemTarget = s.props.interactables.find((it) => it.kind === 'cabinetItem' && it.unit === u);
      let item = null;
      if (itemTarget) {
        aimAt(px, pz, u.y, itemTarget.x, itemTarget.y, itemTarget.z);
        const t2 = g.nearestInteraction();
        const n0 = g.inventory.size;
        const promptItem = prompt();
        g.interact(); run(30);
        item = {
          target: t2?.id, promptItem, taken: u.contents.taken,
          gained: g.inventory.size > n0, inventory: [...g.inventory],
          meshHidden: u.contents.mesh.visible === false,
        };
      }

      aimAt(px, pz, u.y, doorTarget.x, doorTarget.y, doorTarget.z);
      const promptClose = prompt();
      g.interact(); run();
      const hingesClosed = u.doors.map((d) => +d.hinge.rotation.y.toFixed(3));

      // two presses with no time between them must not corrupt the pose: the
      // second press closes what the first opened
      g.interact(); g.interact(); run();
      const doubleToggleOpen = u.doors.every((d) => d.open === false);
      cupboards.push({
        label: u.label, room: u.room, target: t?.kind, promptClosed, promptOpen,
        promptClose, hinges0, hingesOpen, hingesClosed, item,
        doubleToggleSettledClosed: doubleToggleOpen,
      });
    }

    // --- armoire: doors first, then hiding ----------------------------------
    const armoire = s.hiding.spots.find((sp) => sp.type === 'armoire');
    let a = null;
    if (armoire) {
      const px = armoire.out.x, pz = armoire.out.z;
      aimAt(px, pz, armoire.levelY ?? 0, armoire.inside.x, armoire.levelY + 1.12, armoire.inside.z);
      const t0 = g.nearestInteraction();
      const promptClosed = prompt();
      g.interact(); run();
      const doorsOpen = armoire.doors.every((d) => d.open);
      const angles = armoire.doors.map((d) => +d.hinge.rotation.y.toFixed(2));
      aimAt(px, pz, armoire.levelY ?? 0, armoire.inside.x, armoire.levelY + 1.64, armoire.inside.z);
      const t1 = g.nearestInteraction();
      const promptOpen = prompt();
      g.interact(); run();
      const modeInside = g.hiding.mode;
      g.interact(); run(10);
      const modePeek = g.hiding.mode;
      g.interact(); run(10);
      const modeHidden = g.hiding.mode;
      g.leaveHiding(); run();
      a = {
        targetClosed: t0?.kind, promptClosed,
        doorsOpen, angles,
        targetOpen: t1?.kind, promptOpen,
        modeInside, modePeek, modeHidden,
        left: g.hiding.mode,
        doorsClosedAfter: armoire.doors.every((d) => !d.open),
      };
    }

    // --- under-bed hiding ----------------------------------------------------
    const bed = s.hiding.spots.find((sp) => sp.type === 'underbed');
    let b = null;
    if (bed) {
      aimAt(bed.out.x, bed.out.z, bed.levelY ?? 0, bed.inside.x, bed.levelY + 0.52, bed.inside.z);
      const t = g.nearestInteraction();
      const label = prompt();
      g.interact(); run();
      const inside = g.hiding.mode;
      g.leaveHiding(); run();
      b = { target: t?.kind, label, inside, left: g.hiding.mode };
    }

    return {
      kinds,
      counts: { cabinets: s.cabinets.units.length, cupboards: s.cabinets.units.filter((u) => (u.doors ?? []).length).length, spots: s.hiding.spots.length },
      errors: { cabinets: s.cabinets.errors, hiding: s.hiding.errors },
      drawers, cupboards, armoire: a, underbed: b,
      metrics: s.metrics(),
    };
  });

  const fails = [];
  if (out.kinds.inspect) fails.push(`inspect kind still registered: ${out.kinds.inspect}`);
  if (out.errors.cabinets.length) fails.push('cabinet placement errors: ' + out.errors.cabinets.join(', '));
  if (out.errors.hiding.length) fails.push('hiding errors: ' + out.errors.hiding.join(', '));
  if (out.counts.cupboards < 2) fails.push(`expected 2 cupboards, placed ${out.counts.cupboards}`);
  for (const d of out.drawers) {
    if (d.target == null || Math.abs(d.travel) < 0.2) fails.push(`drawer ${d.label} did not pull (${d.travel})`);
    if (!d.closedAgain || Math.abs(d.residual) > 0.001) fails.push(`drawer ${d.label} did not close (${d.residual})`);
    if (d.item && (!d.item.taken || !d.item.gained)) fails.push(`drawer ${d.label} content not taken`);
  }
  for (const c of out.cupboards) {
    if (c.target !== 'cupboard') fails.push(`cupboard ${c.label}: focus offered ${c.target}`);
    if (!/open the cupboard/i.test(c.promptClosed || '')) fails.push(`cupboard ${c.label}: closed prompt "${c.promptClosed}"`);
    if (!c.hingesOpen || c.hingesOpen.every((h) => Math.abs(h) < 1.0)) fails.push(`cupboard ${c.label}: doors did not swing`);
    if (c.hingesClosed.some((h) => Math.abs(h) > 0.02)) fails.push(`cupboard ${c.label}: doors did not close`);
    if (c.item && (!c.item.taken || !c.item.gained || !c.item.meshHidden)) {
      fails.push(`cupboard ${c.label}: shelf item not taken/hidden`);
    }
    if (!c.doubleToggleSettledClosed) fails.push(`cupboard ${c.label}: rapid presses left doors open`);
  }
  const a = out.armoire;
  if (!a) fails.push('no armoire hiding spot');
  else {
    if (a.targetClosed !== 'hidedoor') fails.push(`armoire closed focus was ${a.targetClosed}`);
    if (!a.doorsOpen) fails.push('armoire doors did not open');
    if (a.targetOpen !== 'hide') fails.push(`armoire open focus was ${a.targetOpen}`);
    if (a.modeInside !== 'hidden' && a.modeInside !== 'entering') fails.push(`armoire hide mode ${a.modeInside}`);
    if (a.modePeek !== 'peek') fails.push(`armoire peek mode ${a.modePeek}`);
    if (a.modeHidden !== 'hidden') fails.push(`armoire peek-close mode ${a.modeHidden}`);
    if (a.left !== 'out') fails.push(`armoire leave mode ${a.left}`);
    if (!a.doorsClosedAfter) fails.push('armoire doors stayed open after leaving');
  }
  if (!out.underbed || out.underbed.inside === 'out') fails.push('under-bed hide did not engage');

  const report = { when: new Date().toISOString(), pageErrors: errors, fails, ...out };
  fs.writeFileSync(path.join(OUT, 'interactions.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({
    kinds: out.kinds, counts: out.counts, errors: out.errors,
    drawers: out.drawers, cupboards: out.cupboards, armoire: out.armoire,
    underbed: out.underbed, pageErrors: errors, fails,
    metrics: out.metrics,
  }, null, 1));
  await browser.close();
  if (fails.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
