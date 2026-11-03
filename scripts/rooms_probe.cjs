// Drive the real game to the three imported rooms and prove they are playable.
//
// The renderer here is SwiftShader: about a frame a second on this scene, so a
// probe cannot wait for the frame-driven loader or for a real walk. Instead it
// calls the game's own loadRoom(), places the camera through the game's own
// spawnAt(), and then walks the game's own collision function, player.blocked(),
// step by step through the doorway. That is the same code the player's body
// uses -- no teleport is being used to pass a wall, only to reach the corridor.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5199/?probe=1';
const OUT = 'reports/rooms/ingame';

// from: corridor side of the door; to: a point well inside the room
// y is the level's floor. Without it spawnAt resolves the floor from where the
// player already stands, and the probe ends up a storey above or below the room
// it means to photograph.
// yaw 0 looks down -z, yaw PI down +z; each `from` faces the doorway it walks
// through, and each `look` faces into the room afterwards.
const CASES = [
  // Stand close enough that the door being opened is the nearest interaction:
  // B-06 has a second door 1.2 m the other way, and at arm's length from both
  // the game reasonably picks the one behind.
  { id: 'interrogation_room', from: [10.5, 2.8, -3.4, 0], to: [10.5, 0.4, -3.4], look: 0, wall: 2 },
  { id: 'the_great_drawing_room', from: [-10, 1.2, 0, Math.PI], to: [-10, 4.6, 0], look: Math.PI, wall: 2 },
  { id: 'the_billiards_room', from: [-10.5, -1.2, 8.0, 0], to: [-10.5, -4.6, 8.0], look: 0, wall: -2 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  // SwiftShader is the renderer here: a smaller canvas is the difference
  // between minutes and an hour for the same three rooms.
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = [];
  page.on('pageerror', (e) => { if (!/Pointer Lock/.test(e.message)) errors.push('pageerror: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  fs.writeFileSync(OUT + '/result.json', '');
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });
  const boot = await page.evaluate(() => window.__silid.roomStats());
  console.log('at boot:', JSON.stringify({ loaded: boot.loaded, errors: boot.errors }));

  const only = process.env.SILID_ONLY;
  for (const c of CASES.filter((x) => !only || x.id === only)) {
    const res = await page.evaluate(async ({ c }) => {
      const w = window.__silid;
      const spec = w.rooms.entries.find((r) => r.id === c.id);
      const entry = await w.loadRoom(spec);
      if (!entry) return { failed: w.roomStats().errors };

      // The door in that wall is shut, as every door in this house starts.
      // Open it through the game's own handler, standing in the corridor, so
      // the walk that follows is through a doorway a player could open.
      w.spawnAt(c.from[0], c.from[1], c.from[2], c.from[3], 0);
      // Same storey as the room: the house has doors at the same x and z on
      // other floors, and an earlier version of this probe opened one of those
      // and then walked into the still-shut door it was actually facing.
      const door = w.architecture.doors.find((d) => {
        const cs = d.closedSeg;
        if (!cs) return false;
        const mid = [(cs.x1 + cs.x2) / 2, (cs.z1 + cs.z2) / 2];
        return Math.abs(mid[1] - c.wall) < 0.2 && Math.abs(mid[0] - c.from[0]) < 1.0
          && Math.abs((d.y ?? 0) - c.from[2]) < 0.6;
      });
      const doorInfo = door ? { open: door.open, w: door.w, x: door.at, z: door.c, axis: door.axis } : null;
      // game.interact() takes no target: it acts on whatever the player is
      // facing within reach, which is exactly the path a keypress takes. What
      // it picks is recorded, because "the door did not open" and "a different
      // door opened" are different bugs.
      const aim = w.game.nearestInteraction();
      const aimInfo = aim ? { kind: aim.kind, name: aim.name || null, id: aim.id || null } : null;
      if (door && !door.open) w.game.interact();
      const after = door ? door.open : null;

      // Walk from the corridor through the doorway with the player's own
      // collision test. 3 cm steps, the radius and floor logic untouched.
      const p = w.player;
      const [sx, sz] = [c.from[0], c.from[1]];
      const dx = c.to[0] - sx, dz = c.to[1] - sz;
      const len = Math.hypot(dx, dz);
      const ux = dx / len, uz = dz / len;
      let x = sx, z = sz, blockedAt = null, steps = 0;
      for (let i = 0; i < 600; i++) {
        const nx = x + ux * 0.03, nz = z + uz * 0.03;
        if (p.blocked(nx, nz)) { blockedAt = [+nx.toFixed(2), +nz.toFixed(2)]; break; }
        x = nx; z = nz; steps++;
        if (Math.hypot(x - c.to[0], z - c.to[1]) < 0.2) break;
      }
      // and back out again, twice the resolution, so "one way only" shows
      let backX = x, backZ = z, backBlocked = null;
      for (let i = 0; i < 600; i++) {
        const nx = backX - ux * 0.03, nz = backZ - uz * 0.03;
        if (p.blocked(nx, nz)) { backBlocked = [+nx.toFixed(2), +nz.toFixed(2)]; break; }
        backX = nx; backZ = nz;
        if (Math.hypot(backX - sx, backZ - sz) < 0.2) break;
      }

      w.spawnAt(c.to[0], c.to[1], c.to[2], c.look, -0.04);
      p.enabled = true;
      const cam = w.camera;
      w.renderer.render(w.scene, cam);
      const m = w.metrics();
      return {
        door: doorInfo,
        aim: aimInfo,
        doorOpen: after,
        tris: entry.tris, meshes: entry.meshes, materials: entry.materials,
        walk: { reached: [+x.toFixed(2), +z.toFixed(2)], steps, blockedAt, backBlocked },
        pos: p.pos.toArray().map((v) => +v.toFixed(2)),
        draw: m.calls, sceneTris: m.triangles, textures: m.textures, geometries: m.geometries,
      };
    }, { c });

    console.log(c.id, JSON.stringify(res));
    fs.appendFileSync(OUT + '/result.json', JSON.stringify({ id: c.id, ...res }) + '\n');
    await page.screenshot({ path: `${OUT}/${c.id}.jpg`, type: 'jpeg', quality: 82, timeout: 240000 });

    // turn around and look back at the doorway we came through
    await page.evaluate(() => {
      const w = window.__silid;
      w.player.yaw += Math.PI;
      w.player.syncCamera();
      w.renderer.render(w.scene, w.camera);
    });
    await page.screenshot({ path: `${OUT}/${c.id}_door.jpg`, type: 'jpeg', quality: 82, timeout: 240000 });
  }

  if (errors.length) console.log('errors:', errors.slice(0, 8));
  await browser.close();
})();
