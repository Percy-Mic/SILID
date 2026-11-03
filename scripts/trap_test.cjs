const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const log = (k, v) => console.log('RESULT ' + k + ' ' + JSON.stringify(v));

  const out = await p.evaluate(() => {
    const w = window.__silid, g = w.game, r = w.resident;
    const step = (s) => { const n = Math.round(s * 60); for (let i = 0; i < n; i++) g.update(1 / 60); };
    const res = {};
    w.spawnAt(0, 0, 0, Math.PI, 0);   // player in the foyer, on the ground floor
    step(0.2);

    // --- validity: floor vs midair vs wall vs doorway ---------------------
    const V = (x, z, y) => w.traps.valid(x, z, y);
    const door = w.architecture.doors.find((d) => d.level === 'GF' && d.collider);
    const dx = door.axis === 'x' ? door.at : door.c;
    const dz = door.axis === 'x' ? door.c : door.at;
    res.validity = {
      foyer_floor: V(2.5, 5.5, 0),
      midair: V(2.5, 5.5, 6),
      on_doorway: V(dx, dz, door.y),
      in_wall: V(-24.4, 0, 0),
    };

    // --- placement, contact with the floor, geometry ----------------------
    const t = w.traps.place({ x: 2.5, z: 5.5, y: 0.002, yaw: 0.4, level: 'GF' });
    res.placed = t ? {
      y: +t.y.toFixed(3), floor: +(w.floorAt(t.x, t.z, 0) ?? -99).toFixed(3),
      inScene: !!t.group.parent, meshes: t.group.children.length, live: t.live,
      tris: t.group.children.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0),
    } : null;

    // --- walking into it: noise, stumble, no trial ------------------------
    const trials0 = w.trials();
    r.state = 'patrol'; r.pos.set(6, 0, 6); r.footY = 4.2; r.level = 'F2';
    w.spawnAt(t.x, t.z, t.y, 0, 0);
    w.player.vel.set(1.4, 0, 0.2);
    step(0.35);
    res.triggered = {
      live: t.live, trialsBefore: trials0, trialsAfter: w.trials(),
      stumble: +g.stumbleT.toFixed(2),
      residentState: r.state,
      lastKnown: r.lastKnown && [+r.lastKnown.x.toFixed(1), +r.lastKnown.z.toFixed(1)],
      message: document.getElementById('msg')?.textContent?.slice(0, 40),
    };

    // --- limit: never more than three alive -------------------------------
    w.traps.clear();
    const pts = [[0, 0], [4.0, 2.0], [-4.0, 2.0], [8.0, 2.0]];
    const made = [];
    for (const [x, z] of pts) { const q = w.traps.place({ x, z, y: 0.002, yaw: 0, level: 'GF' }); made.push(!!q); }
    res.limit = { attempts: pts.length, placed: made.filter(Boolean).length, live: w.traps.list.length };

    // --- disarm with E, from a metre away, looking at it ------------------
    const t2 = w.traps.list[0];
    if (t2) {
      w.spawnAt(t2.x, t2.z + 1.15, t2.y, 0, -0.5);
      step(0.1);
      const target = g.nearestInteraction();
      const before = w.traps.list.length;
      g.interact();
      res.disarm = { targetKind: target?.kind, before, after: w.traps.list.length, message: document.getElementById('msg')?.textContent?.slice(0, 40) };
    }
    return res;
  });
  for (const [k, v] of Object.entries(out)) log(k, v);
  console.log('ERRORS ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
