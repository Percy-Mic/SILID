// Story-path regression test. Drives the actual interactions in order:
// read the notebook, pick up the diesel and the ceramic fuse, fit the fuse in
// the panel, start the generator, open the gate. Also opens a door on each
// floor through the same prompt path, so a broken collider or focus change
// shows up here rather than in a playthrough.
const { chromium } = require('playwright');
const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });

  const out = await page.evaluate(() => {
    const s = window.__silid;
    const g = s.game;
    const pl = s.player;
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(0.033); };

    // Stand a step back from an interactable, on its own floor, and aim at it.
    // The approach is from the room centre, so a pickup on a bench against a
    // wall is never approached through the wall.
    const use = (id) => {
      const it = s.props.interactables.find((x) => x.id === id || x.id.startsWith(id));
      if (!it) return { id, error: 'missing' };
      let room = null, lvl = null;
      for (const l of s.levels) {
        const r = l.rooms.find((x) => x.name === it.room);
        if (r) { room = r; lvl = l; break; }
      }
      const y = lvl ? lvl.y : 0;
      let px = it.x, pz = it.z + 0.85;
      if (room) {
        const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
        const dx = it.x - cx, dz = it.z - cz;
        const l = Math.hypot(dx, dz);
        if (l > 0.05) { px = it.x - (dx / l) * 0.85; pz = it.z - (dz / l) * 0.85; }
      }
      s.spawnAt(px, pz, y, 0, 0);
      // face the point in 3D
      const eyeY = pl.pos.y;
      const dY = it.y - eyeY;
      const dist = Math.hypot(it.x - pl.pos.x, it.z - pl.pos.z) || 0.85;
      pl.yaw = Math.atan2(-(it.x - pl.pos.x), -(it.z - pl.pos.z));
      pl.pitch = Math.atan2(dY, dist);
      pl.syncCamera();
      g.update(0.05);
      const t = g.nearestInteraction();
      const n = g.inventory.size;
      g.interact();
      step(2);
      return {
        id, target: t?.id || null, kind: t?.kind || null,
        gained: g.inventory.size > n,
        has: [...g.inventory],
      };
    };

    const r = {};
    r.note = use('note');
    r.fuse = use('fuse');
    r.fuel = use('fuel');

    // fit the fuse in the panel
    const box = s.apparatus.fuseBox;
    s.spawnAt(box.target.x + 0.65, box.target.z, -3.4, Math.PI / 2, 0);
    g.update(0.05);
    r.panelPrompt = g.nearestInteraction()?.id;
    g.interact(); step(20);          // open cover
    g.update(0.05);
    g.interact(); step(4);           // fit fuse
    r.fuseInstalled = box.fuseInstalled;
    r.panelLabel = document.getElementById('prompt')?.textContent;

    // start the generator
    const gen = s.props.interactables.find((i) => i.id === 'generator');
    s.spawnAt(gen.x, gen.z + 1.0, -3.4, 0, -0.25);
    g.update(0.05);
    r.generatorPrompt = g.nearestInteraction()?.id;
    g.interact(); step(10);
    r.powered = g.state.powered;
    r.objective = document.getElementById('hint')?.textContent;

    // open the gate (the gate interact sits outside the house)
    const gate = g.gateInteract;
    s.spawnAt(gate.x, gate.z + 1.2, 0, 0, 0);
    g.update(0.05);
    r.gatePrompt = g.nearestInteraction()?.id;
    g.interact(); step(20);
    r.gateOpen = g.state.gateOpen;

    // a door on each floor, through the prompt path
    const doors = [];
    for (const level of ['GF', 'F2', 'F3']) {
      const d = s.architecture.doors.find((x) => x.level === level && x.collider && !x.arch);
      if (!d) continue;
      const cx = d.axis === 'x' ? d.at : d.c;
      const cz = d.axis === 'x' ? d.c : d.at;
      s.spawnAt(cx, cz + 1.0, d.y, 0, 0);
      g.update(0.05);
      const t = g.nearestInteraction();
      g.interact();
      step(60);
      doors.push({ level, target: t?.id, open: d.open, colliderDisabled: !!d.collider.disabled, angle: +d.mesh.rotation.y.toFixed(2) });
    }
    r.doors = doors;

    // examining furniture through the shared interaction path: the prompt must
    // name the action, the message must carry the authored text, and the
    // second look must be recorded as a repeat.
    const insp = s.props.interactables.find((i) => i.kind === 'inspect' && /cooker|counter/.test(i.id));
    if (insp) {
      s.spawnAt(insp.x + 0.7, insp.z + 0.7, 0, 0, 0);
      pl.yaw = Math.atan2(-(insp.x - pl.pos.x), -(insp.z - pl.pos.z));
      pl.pitch = Math.atan2(insp.y - pl.pos.y, 1.0);
      pl.syncCamera();
      g.update(0.05);
      const t = g.nearestInteraction();
      const label = document.getElementById('prompt')?.textContent;
      g.interact();
      const msg1 = document.getElementById('msg')?.textContent || '';
      g.interact();
      const msg2 = document.getElementById('msg')?.textContent || '';
      r.inspect = { id: t?.id, kind: t?.kind, label, seen: g.seen.has(t.id), msg1, repeat: msg2.startsWith('Again') };
    } else r.inspect = { found: false };

    // the locked historical study on F3: refused without the key, unlocked by
    // the key that is actually in the master bedroom, then walkable through.
    const studyDoor = s.architecture.doors.find((d) => d.level === 'F3' && d.axis === 'x'
      && Math.abs(d.at - 13) < 0.35 && Math.abs(d.c - 4) < 0.35);
    if (studyDoor) {
      g.state.hasKey = false; g.inventory.delete('key');
      studyDoor.open = false; studyDoor.target = 0; studyDoor.unlocked = false;
      s.spawnAt(13, 5.0, 8.0, 0, 0);
      g.update(0.05);
      const t0 = g.nearestInteraction();
      g.interact(); step(30);
      const refused = { open: studyDoor.open, prompt: document.getElementById('prompt')?.textContent };
      g.state.hasKey = true; g.inventory.add('key');
      g.update(0.05);
      g.interact(); step(40);
      const unlocked = { open: studyDoor.open, unlocked: !!studyDoor.unlocked, colliderDisabled: !!studyDoor.collider.disabled };
      // walk through it: the doorway must be clear on the far side
      s.spawnAt(13, 4.6, 8.0, 0, 0);
      g.update(0.05);
      const through = { blockedAtDoor: pl.blocked(13, 4.0), blockedBeyond: pl.blocked(13, 3.2) };
      r.lockedStudy = { found: true, refused, unlocked, through };
    } else {
      r.lockedStudy = { found: false };
    }

    r.notes = {
      hasFuel: g.state.hasFuel, hasFuse: g.state.hasFuse,
      phase: g.state.phase, ended: g.state.ended,
    };
    return r;
  });

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
