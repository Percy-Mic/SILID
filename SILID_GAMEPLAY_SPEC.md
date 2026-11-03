# SILID — how the game has to play

A working spec for doors, hiding, items, rooms and pace, taken from what the
genre's own developers say and measured against what this build does today.
Everything below has a number or a check attached; nothing is "feel better".

Sources are listed at the end. Where a number is a heuristic (the inventory
size, the bob amplitude) it says so — only the movement ranges and the door
rules come from published developer material.

---

## 1. Pace of movement

**What the research says.** Published horror games sit around **1.3–1.6 m/s
walking, 2.3–2.8 m/s running**, with crouch at **0.8–1.1 m/s**. John Romero's
account of Quake is the useful lesson: speed is tuned against *room size and
desired traversal time*, not copied as a constant. Stamina, if it exists,
should be a sprint resource, not a tax on walking.

**What this build did.** `src/game/app.js` had `WALK 3.5`, `RUN 5.8`,
`CROUCH_SPEED 1.6` — a corridor sprint. At 5.8 m/s a doorway is two frames; a
prompt 110 ms from appearing can be gone before it is read; and the camera
passes through a door leaf's sweep so fast the leaf seems to teleport.

**What it does now.** `WALK 2.0`, `RUN 3.4`, `CROUCH 1.15`. That is above the
genre band on purpose, because this set is fifty rooms and 60 m across; it is
still a *walk* rather than a jog, and the ratio walk:run (1:1.7) is the one the
genre uses.

| state | before | now | check |
|---|---:|---:|---|
| walk | 3.5 | **2.0** (measured 2.00) | 30 m of corridor takes 15 s |
| run | 5.8 | **3.4** (measured 3.40) | still 1.7× walk |
| crouch | 1.6 | **1.15** (measured 1.15) | inside the 0.8–1.1 band + margin |

Measured with `node scripts/pace_check.cjs`, which drives `step()` at a fixed
1/60 s tick and divides distance walked by elapsed time — not by reading the
constants back.

Not done, and worth doing next:

* **Footstep cadence is now wrong.** Steps are timed by a fixed accumulator, not
  by distance. At 2.0 m/s the step rate must drop by the same 43% or the player
  will sound like they are skating. Stride should be **~0.75 m walking,
  ~1.0 m running**, i.e. one step per 0.37 s / 0.29 s.
* **Stamina.** There is none, and for a fifty-room house that is defensible —
  Amnesia has no meter either and constrains escape with noise and threat
  instead. If a sprint is added later: 8 s of sprint, 1 s before recovery,
  10–15 s to refill, and *walking never costs anything*.
* **FOV is 70° vertical** (~102° horizontal at 16:9). That is wide enough to
  stretch the frame edge, which is what the door screenshots look like. The
  genre default is 90–100° horizontal (**59–68° vertical**); 70 is at the top
  of that. Ship a slider, and make head-bob optional (motion sickness).

---

## 2. Doors

**What the research says.** The rules that repeat across Frictional, Capcom,
Bloober, Creative Assembly and Liz England's "Door Problem":

1. **Interruptible, player-paced opening** for doors that matter (RE7, Layers of
   Fear). A *brief* swing is better than an instant flip; the threshold is where
   the tension lives.
2. **Show a slice before committing** — the crack of the door is the decision
   point, not the fully open room.
3. **Never fail silently.** Locked / jammed / barred / needs-a-key are different
   states with different sounds and different words.
4. **Doors that move on their own are authored events**, never background
   noise. Teach a stable door first, break it later.
5. **Generation interaction volume** — Amnesia lets you click anywhere on the
   leaf; requiring an exact knob under pressure is a bug, not difficulty.
6. **Short, state-specific prompts**: Open, Close, Peek, Locked, Jammed. Not
   "Interact".
7. **A door that locks behind you must say so**, and only be used where the
   isolation is the point.
8. **A closed door is only a delay** unless the game has shown it will hold
   (Outlast Trials: it buys seconds, the enemy breaks through).

**What this build does.**

| rule | state | where |
|---|---|---|
| swing is animated | **fixed now** — leaves tween 72° over ~0.5 s (measured: 0 → −55° → −72° over 30 frames) | `swingLeaf` / `animateProps` |
| direction chosen once | yes — pushes away from the opener, then cached | `setDoorOpen` |
| state-specific feedback | mostly: `locked. the <key> is somewhere in the house.`, `barred from the inside`, `knee-high — hold C to crawl.` | `useDoor` |
| low doors say C, not E | yes | `updatePrompt` |
| prompt wording | `open the door` / `close the door` / `the archway` — inconsistent: one is a verb, one is a noun | `doorPoint` labels |
| safe threshold view | **no** — the leaf is fully open or fully shut, and you can stand inside its sweep | — |
| locking behind the player | not implemented | — |

**Next three, in order.**

1. **Stop the camera entering the leaf's sweep.** Doors are used from a
   `doorPoint`; the interaction should require the player to be *behind* the
   leaf's plane by ≥ 0.55 m, and the leaf should stop at 72° only if the volume
   in front of it is clear — otherwise open away from the player (the direction
   test already computes this; it just is not enforced as a rule).
2. **Give every door leaf a sound and a settle.** `sound.click()` on unlock,
   a hinge creak proportional to angle, and a thud at full open. A silent leaf
   is why a door reads as geometry rather than as a door.
3. **Two-stage open.** First press: 18° crack (a sliver of the room, no full
   reveal). Second press or a step forward: the rest. This is the RE7/Layers of
   Fear move and it costs one tween target.

---

## 3. Hiding

**What the research says (Alien: Isolation is the reference implementation).**

1. **Availability must be legible before you are desperate** — recognisable
   form, reachable prompt.
2. **Different spots give different things**: better concealment vs. better
   view and exits. A locker hides you and traps you; under a bed shows you the
   room and lets you crawl out.
3. **The camera stays inside the hiding place.** Keep first person, constrain
   it credibly (a crack, a low angle), and let the player learn something
   without granting a free surveillance camera.
4. **Tension is evidence of proximity**, not a timer: footsteps, breathing,
   the door of the wardrobe being tried.
5. **Detection rules must be learnable.** Being seen entering, heard, or
   searched is fair; "the AI just knew" is not.
6. **Hiding is temporary.** It buys time; it must not replace movement.
7. **Never punish adaptation into having no options left** — Creative Assembly
   cut the "Alien attacks lockers it suspects" feature for exactly this reason.

**What this build does.** `hideIn` / `stepOut` in `src/game/app.js`: the body
is frozen, the door is slid shut with a tween, `E` steps out, and the prompt
becomes `E step out`. There is no peek, no breath, no proximity feedback, and no
reason to prefer one spot over another.

**Next moves.**

* **Peek**: while hidden, `A`/`D` lean the head ±12° and the prompt stays. That
  is the whole "information vs. concealment" axis with one axis of rotation.
* **Proximity, not a timer**: when a threat is within 3 m, the breath loop gets
  louder and the sway gets smaller. The player reads danger from their own
  body.
* **One spot must be worse than another**, or hiding is a button, not a choice.

---

## 4. Items and containers

**What the research says.**

1. **Reticle establishes focus, prompt names the action** (`Take`, `Open`,
   `Hide`, `Use`), and the prompt changes when the state changes.
2. **Consistent rules**: if a drawer opens, drawers open. If something cannot be
   taken, that must feel like the character, not the engine.
3. **Capacity should create decisions, not chores** — a tight survival-horror
   bag is ~6–8 slots, with keys/progression items protected or separate. Never
   let a full bag block a progression item unless inventory *is* the game.
4. **Discovery and use are separate moments.** Readable pickup cue at the
   object; quick access later; show the selected item and its quantity.
5. **Containers must look openable and show their state** — seam, lid, handle,
   and after opening, an open lid and an empty or changed interior.
6. **Match the model to the horror**: Outlast removed combat to focus the
   experience; Amnesia starts from the emotion and makes mechanics serve it.

**What this build does.** `useTarget()` drives one prompt; containers push
`sliding` tweens for lids and drawers (so they open *and* stay open); the bag is
a `Set` with a HUD line (`carrying: …`) and no capacity limit.

**Next moves.**

* **Prompt grammar.** Today labels mix verbs and nouns (`the archway`,
  `open the door`). Rule: every interactable label starts with a verb, and the
  noun follows the state: `open the drawer` → `take the brass key`.
* **Container feedback after looting.** An emptied drawer should say so on the
  retry (`empty`), or the player keeps opening it.
* **Capacity**: 8 slots, keys exempt, and a refusal line that names the item
  being left behind — not "inventory full".

---

## 5. Rooms and readability at night

**What the research says (Robert Yang's GDC lighting talks; Naughty Dog's
David Shaver on environmental guidance).**

1. **Hierarchy**: the intended route or the usable door should be the brightest
   / highest-contrast thing in frame — a starting test is ~2–3× the local
   luminance of the background.
2. **Silhouette, not just brightness**: rim/back light reads a doorway, a rail,
   a stairs, or a figure without filling the room.
3. **Design the sightline first**: from the entrance you should see a landmark
   or the next choice; reveal destinations in stages through doorframes and
   turns.
4. **Landmarks need identity and continuity** — the same anchor from two
   approaches, not a new brightest thing at every turn.
5. **Use several channels**: alignment, light, sound, material change.
6. **Keep the mood**: do not light every exit equally; keep non-critical space
   uncertain.

**What this build does.** One phone torch with a proximity guard (it dims near
walls), a moon/hemi pair, and FogExp2 at 0.022. Rooms are named and the HUD
shows the name. There is no landmark language and no route hierarchy: every
doorway is lit the same and every room is equally dark.

**Next moves.**

* **One lit anchor per room** — a window, a bulb, a candle, a moon shaft — and
  make it the brightest object in that room. The ritual room already has
  candles; the rest do not.
* **Door frames as frames**: a 15 cm reveal of light at every doorway that
  leads onward, so a corridor reads as a series of choices rather than a wall.
* **Room name on entry only**, not permanently: the HUD line competes with the
  frame for attention.

---

## 6. What the screenshots show

1. **The stakes against the wall / in the door reveal.** Small timber posts at
   varying heights, in a line, half-buried in a plastered wall. Whatever batch
   they belong to, they are *penetrating* the wall instead of sitting on it —
   the same class of fault as the old grave planks: a prop placed on a plan
   line, not on the face the room sees.
2. **The crate at chest height.** A crate whose base is above the floor, with
   nothing under it — a prop on a stale floor height.
3. **The door frame filled by a stretched pale quad** with the leaf through it.
   Nothing in the exported GLB is a stretched sheet (checked: the only
   thin-and-wide nodes are `SM_Ceiling_*`, `SM_Yard`, `SM_Lawn`, `SM_Path`), so
   this is the camera standing inside the leaf/frame sweep at 70° FOV, not
   broken geometry. Two fixes above address it: the interaction distance rule
   and the two-stage open.

**How to confirm each one:** `window.__silid.scene` is live in the browser, and

```js
__silid.aimTarget()?.object?.name          // what the reticle is on
__silid.auditColliders({ radius: 12 })     // colliders with nothing drawn
```

names the mesh. The wall-stakes case needs the name of that batch, which is the
one thing these screenshots cannot give me.

---

## Sources

* Frictional Games, "Let's not forget about Physics" — https://frictionalgames.com/2010-09-lets-not-forget-about-physics/
* Rely on Horror, RE7 demo analysis — https://www.relyonhorror.com/in-depth/resident-evil-7-demo-analysis-and-walkthrough/
* Kotaku, "The Horror of Video Game Doors" — https://kotaku.com/the-horror-of-video-game-doors-1819921161
* Game Developer, "The Door Problem" (Liz England) — https://www.gamedeveloper.com/design/-quot-the-door-problem-quot-of-game-design
* Game Developer, Layers of Fear unstable level design — https://www.gamedeveloper.com/audio/terrifying-players-with-unstable-level-design-in-i-layers-of-fear-i-
* Rock Paper Shotgun, Alien: Isolation lockers — https://www.rockpapershotgun.com/alien-isolation-lockers
* Game Developer, revisiting the AI of Alien: Isolation — https://www.gamedeveloper.com/design/revisiting-the-ai-of-alien-isolation
* Game Developer, "Four ways to design for horror" (Frictional) — https://www.gamedeveloper.com/design/four-ways-to-design-for-horror-from-i-amnesia-i-dev-frictional-games
* Game Developer, Outlast postmortem — https://www.gamedeveloper.com/design/horror-in-the-making-how-red-barrels-outlasted-i-outlast-i
* GamesIndustry.biz, Gone Home GDC talk — https://www.gamesindustry.biz/why-is-gone-home-a-game
* Romero, "Quake's Player Speed" — https://rome.ro/quakes-player-speed-1
* id Software, Doom source (`g_game.c`, 35 tics/s) — https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/g_game.c
* GDC, Robert Yang, "Lighting Design for Level Designers" — https://www.gdcvault.com/play/1016450/Lighting-Design-for-Level
* GDC, "Invisible Intuition: Blockmesh and Lighting Tips" — https://www.gdcvault.com/play/1025179/Level-Design-Workshop-Invisible-Intuition
