# 06 — Multiplayer: Server-Authoritative 1–4 Player Co-op (designed-in, not bolted on)

Goal (spec §20, §22): co-op that works on day one architecturally, ships after single-player is fun. **Solo is not a special case of co-op; co-op is a general case of solo.**

---

## 1. Topology & modes

| Mode | Topology | Notes |
|---|---|---|
| Single player | Listen server, local client = host (invisible) | One code path; no "SP build" divergence |
| Private co-op | Listen server, Steam/ EOS **session friends-only** via Online Subsystem | 1 host + up to 3 clients |
| Online co-op | Same, public sessions, password/invite | Same code |
| Public matchmaking | Session search queues, later | Optional; never blocks §21 |

Engine pieces: **Online Subsystem NULL (dev) → Steam (shipping)**, `AGameSession`, `UGameInstance` (exists as `USILIDGameInstance` — extend with session management), UE replication, no third-party netcode.

## 2. Authority map (who owns what)

| System | Authority | Client role |
|---|---|---|
| Player movement, camera, anim | **Autonomous proxy** (standard Character) | Prediction + server correction |
| Inventory add/remove/use | **Server** (`USILIDInventoryComponent` server RPCs) | UI prediction only (show after server ack for adds) |
| Item pickup/drop/throw | Server; throws spawn server-side with client cosmetic | Cosmetic replication |
| Noise events | **Server emits authoritative** events; clients play audio/VFX | Client emits cosmetic-only local sound |
| AI (Resident) | **Server-only** tick/perception/BT; clients see replicated pawn transform + replicated state enum (Patrol/Investigate/Chase…) for VFX/audio | Never simulate AI locally |
| Doors/drawers/barriers | Server validates requirement tags/flags, applies state | Prompt + predicted anim start, corrected on mismatch |
| ElectricalSystemSubsystem | **Server-authoritative** state machine; clients receive per-node state | Cosmetic flicker/jitter client-local |
| WaterSystem | Server | Same pattern |
| Security (CCTV/sensors/alarms) | Server (perception/alarm bus server-side) | Monitor widgets read replicated camera state + textures via SceneCapture replication of render targets |
| Damage/health/revive | Server | UI |
| Save/load | **Host-only** saves (existing SaveSubsystem); late-joiners get host snapshot | — |
| Escape routes | Server validates all requirements, triggers win | — |
| Run seed / item spawns | Server generates; seed replicated to clients (randomizer already seed-driven) | Deterministic display |

**Rule of thumb (memorize):** *state changes on the server; clients may only predict movement and cosmetics.* Every new system answers "is this server-only?" before it's written.

## 3. What gets replicated (the spec §20 checklist, mapped)

- **Player movement/anim** — Character defaults + `Abilities`-free; anim BP is proxy-driven.
- **Inventory** — `FSILIDItemStack` array `ReplicatedUsing=OnRep_Items`; id references resolve through the GameInstance item registry (exists) so only ids cross the wire.
- **Items/world state** — pickups: `{bActive, ItemId, Transform}`; doors: `{bOpen, bLocked}`; barriers: `{bCleared}`; all via existing ISaveable → the **same serializers power both save and replication** (write once).
- **Machines** — generator `{State, FuelLevel, Condition}` (1 Hz update), fuse/breaker states, power node states (bitmask + fanout via OnRep), water equivalents.
- **Enemy AI** — pawn transform (normal Character replication) + `EAIState` enum + target-less "alert level"; **never** replicate blackboard or perception data (bandwidth + cheating surface).
- **Damage** — server applies via `USILIDHealthComponent` (exists), broadcasts events for VFX/audio.
- **Puzzles** — code-lock attempts validated server-side (no client-guessable state leaks), radio broadcasts replicated as text events.
- **Escape progress** — per-route requirement progress replicated for HUD.

## 4. Player-count adaptation (spec §21/§22)

All adaptation data lives in `DA_DifficultyProfile` per player count (1/2/3/4 rows): AI sense scale (↑ with players), patrol aggression, item spawn multipliers (↓ per-capita), fuse/resource counts, repair hold-times (longer solo is *not* the goal — scale **part requirements** instead: solo uses fewer fuses, not slower hands), carry-objects require N players (or solo-profile lighter variants), downed/revive disabled solo.

Example (the spec's own scene): A repairs generator (hold-interact), B hunts fuel (search containers), C watches CCTV (security room is *useful*, not decoration), D lures the Resident (throw physics noise → AI investigates). **No scripted roles** — the four actions exist because systems expose them; tags `Coop.Role.*` exist only for optional UI affinity badges.

## 5. Co-op interaction primitives (small components, big value)

| Component | Behavior |
|---|---|
| `UCoopReviveComponent` | Downed state (bleed-out), hold-interact revive (duration from difficulty data) |
| `UCoopCarryComponent` | Two grab sockets on `BP_CarryObject`; both players hold Interact to move; solo-profile drops weight |
| `UCoopTradeComponent` | Drop-swap trade: throw item near partner → prompt "take" (avoids UI-only inventory sync pitfalls) |
| `UCoopDistractionComponent` | (Thin) share throw/drop noise events to a "distraction" tag for stats/hints |

Shared-TV CCTV: the monitor widget supports a second "spectator" viewer; watching is a legitimate role because the AI awareness map (§05 doc §4) is the main intel source.

## 6. Voice, presence, disconnects

- Voice: push-to-talk platform voice via Online Subsystem (Steam voice), off by default; radio-in-world flavor later (optional).
- **Host migration: out of scope.** Disconnect = session ends with a clean save prompt (solo-dev scope rule). Late join: allowed pre-run-start only (mid-run join = state snapshot problem not worth solo time).
- Idle/AFK players auto-sit (hiding spot) so the AI doesn't farm them.

## 7. Bandwidth discipline (solo dev = solo server too)

- Actor dormancy on all props (`NetDormancy_DormantAll` until state changes).
- Noise events: event struct (location+radius+tag), **not** audio; clients render.
- Power/water states: per-node enums at 1 Hz max, dirty-flag OnReps.
- CCTV: capture at 6–8 fps, low-res render target, only when a monitor widget is visible (capture component toggled by widget visibility), otherwise the camera actors are dormant.
- Perf target: ≤ 30 KB/s client up on 4-player listen server on one decent connection.

## 8. Testing strategy (replication is a solo-dev trap)

- PIE **"Run Under One Process" with 2–4 clients** as a *weekly ritual*, not an end-phase surprise; any feature merged without a 2-client test is suspect.
- `net.PktLag=150`, packet loss 2% in PIE networking settings as standard dev profile.
- Dedicated-server target (`SILIDServer.Target.cs` later) only if a hosted service is ever desired — listen server ships first.
- Regression port from the web game: the web build's `?regression=1` harness (169 checks) becomes UE automation tests — seed reproducibility (same seed → same item placement across clients), power-chain state transitions, save/restore round-trips (see 08 doc §5).

## 9. Acceptance criteria

- [ ] Solo = listen server with 1 local player; zero divergent code paths
- [ ] 2-client PIE: pickup/trade/power/door/throw/AI-chase all consistent; inventory desync drill passes
- [ ] Server validates every requirement (client can't self-unlock a door by RPC forgery test)
- [ ] AI runs server-only; clients stable at 0 AI cost
- [ ] Seed replicated → identical item placement on all clients for one seed
- [ ] 4-player budget test: ≤ 30 KB/s up, ≤ 60 KB/s down per client
