# MANSION PUZZLE AND SECRET MAP

What the player can actually solve in this build, how the clue chain holds
together, and — in the last section — what is *not* implemented, so the gap is
not mistaken for a hidden feature.

## The mandatory chain: power for the gate

The night's goal is to leave. The estate gate is electric and the house has no
power. The chain is five steps long and every step is in the same basement wing.

| # | Step | Where | How the player learns it | State |
|---|---|---|---|---|
| 1 | Read the notebook | GF Library/Study, on the desk | It is a `read` target with a visible prompt; the text names the fuel and the fuse | `inventory: note` |
| 2 | Take the ceramic fuse | B1 Workshop, on the bench | The notebook; also the generator prompt if the player arrives without it | `hasFuse: true` |
| 3 | Take the diesel | B1 Generator Room, jerry can against the wall | The notebook; also the generator's dry-tank message | `hasFuel: true` |
| 4 | Fit the fuse | B1 Generator Room, east wall panel | The generator prompt names the panel; the panel's own text describes the empty carrier | `fuseInstalled: true` |
| 5 | Start the generator | B1 Generator Room | The prompt is `repair`; with fuel and fuse it catches | `powered: true`, phase `escape` |
| 6 | Open the gate | the drive, south of the house | The gate prompt refuses until powered, then says so | `gateOpen: true` → act ends |

**Why it cannot soft-lock.** The fuse exists three times in the world (workshop,
sewing room, maintenance room) and only one is needed; the diesel is a single
pickup but is never consumed; the notebook and the key are not consumed; no
mandatory item sits behind a door that needs itself. The generator checks fuel
before fuse, so the player is told what is missing one dependency at a time
rather than being given a list.

**What the generator changes.** `powerOn()` brings up the room lights, the porch
lamp and the gate's glow, starts the generator audio loop, switches the phase to
`escape` and changes the objective. It does not light every lamp in the house
unconditionally: each room light is a real light entry and the light manager
keeps the six nearest, so the effect is house-wide but budgeted.

## The locked room

The third floor has a locked leaf: **FF3-10, the Historical Study**, door on the
south walkway wall at x = 13 (F3, z = 4).

- **The barrier is legible.** The prompt reads `try the lock`, and pressing it
  without the key says: *"Locked. The brass key is upstairs, in the master
  bedroom."* The player is told the floor and the room, not a riddle.
- **The key is a real object.** `key` is a pickup on the master bedroom floor
  (F2 FF2-03) at (-3.2, 4.26, -4.2), marked with its own mesh, and picking it up
  sets `state.hasKey`.
- **It opens on the same press.** With the key, the lock turns, the message
  says so, and the door swings in that interaction. `door.unlocked` is
  persistent, so it stays open to the player afterwards.
- **It is optional content, not a gate in the main chain.** The study is a room
  with furniture to inspect; it hides no required item. That is deliberate: the
  escape chain must not depend on a locked door.

This was **dead code before this pass**: `isDoorLocked()` named a door that does
not exist (F3, `axis: 'z'`, `c: 10`, `at: 6`), so `state.hasKey`, the `key`
pickup and the lock prompt were all unreachable. The predicate now names the
leaf that is actually built, and `scripts/story_test.cjs` asserts the sequence:
refused without the key → opens with it → the doorway is walkable through.

## Redundancy and reachability

| Item | Copies | Where | Why |
|---|---|---|---|
| Ceramic fuse | 3 | B1 Workshop bench; F3 Sewing room; F4 Maintenance room | the mandatory component must not be losable |
| Phone | 3 markers | GF Foyer console; F2 Grand Stair Hall; F3 Grand Stair Hall | the handheld UI should be reachable from any floor, not only the entrance |
| Brass key | 1 | F2 Master Bedroom | one lock, one key, no duplication needed |
| Diesel | 1 | B1 Generator Room | a single can beside the set it feeds |

Every pickup was checked to be on a floor the player can stand on and within
3 m of a walkable approach; `scripts/story_test.cjs` walks to each one through
the prompt path and asserts it enters the inventory.

## Environmental secrets that exist

- **The courtyard void.** Standing on the roof deck at the balustrade looks four
  storeys down into the courtyard; standing on the ground floor, the gallery
  arch leads into it. It is a real hole in five slabs, not a painted backdrop.
- **The bell room.** Reached from the roof deck by two doors, it holds the bell
  frame and its rope; it is the one room on the roof that is not a pavilion.
- **The service stair.** The basement is not on the way to anything: it is
  found by taking the unlit stair in the service hall. Everything the night
  needs is down there.
- **The roof lantern** over the stair tower has its own door onto the deck.
- **The observatory** on the roof holds a telescope aimed through the open roof.

## Not implemented (honest backlog)

These are specified in the overhaul brief and are **not** in this build. They are
listed so no one reads the room bible as a promise of them.

1. **Hiding and peeking.** No wardrobe/locker hiding, no under-bed hiding, no
   peek state, no hide camera. The aparadors are solid merged furniture with no
   interior volume or door animation, so this is not a small addition: it needs
   a split-door model, an interior, an entry/exit state machine and a camera
   rig.
2. **Enemy AI.** There is no Resident in this build: no patrol, no hearing, no
   vision cone, no search behaviour, no capture. `src/game/game.js` contains no
   enemy code at all.
3. **Radio, television, fan, well mechanisms.** The furniture is there; the
   devices are inspectable scenery, not apparatus. Only the generator, the fuse
   panel and the gate are real machinery.
4. **Hidden compartments and secret doors.** No book-lever shelf, no wardrobe
   back panel, no concealed basement chamber. The only restricted space is the
   locked study.
5. **Container searching with contents.** Five cabinets have real drawers with
   interiors and one clue; the rest of the storage furniture is inspectable, not
   searchable.
6. **The phone passcode has no in-world clue.** The lock screen accepts 6294;
   nothing in the world states it. The phone's apps (Pico's message, the night's
   calendar) are optional flavour and the act is completable without them. If
   the phone is intended as a clue surface, the code needs a discoverable
   source — a card in the foyer, or the notebook.

The stage order in the brief puts hiding and the enemy at stage 3, before the
room-by-room furnishing pass. This pass completed stage 1 (connectivity), the
shared interaction framework of stage 2 with more verbs than it started with,
and parts of stages 5 and 6 (generator, fuse panel, locked room). Stage 3 is the
next unit of work, and it is not a decoration pass.
