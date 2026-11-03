// THE PLAN. One coordinate system for all six levels, in metres.
//
//   +x east, +z north, +y up. The mansion's south face (the entrance) is at
//   z = +11. The west service wing runs x -24..-17. The inner courtyard is the
//   open rectangle x 8..20, z -6..2, which is a hole in every floor and in the
//   roof, exactly as the reference plans show it.
//
// Room rectangles are interior clear dimensions. Walls are generated on the
// boundaries between them, so two rooms that share an edge share one wall.
// Heights are floor-to-ceiling; the slab is 0.30 m and sits under each level's
// y. Doors are authored on wall lines and are cut out of the generated wall;
// if a door does not land on a wall the builder refuses it and says so.
//
// The plan is deliberately simpler than the four printed sheets — 14 rooms on
// the ground floor rather than 26 — because every room here has to be walkable,
// furnished, lit and collision-tested on an integrated GPU. The circulation,
// the twin stair tower, the courtyard, the service wing, the north/south room
// rows and the roof pavilions follow the sheets; corridors that the drawings
// show but that would produce dead geometry are merged into the gallery.

export const FOOT = { x0: -24, x1: 22, z0: -11, z1: 11 };
export const LEVELS = [
  {
    id: 'B1', name: 'Basement', y: -3.4, h: 2.7,
    floor: 'concreteFloor', wall: 'concrete', ceiling: 'concrete',
    footprint: { x0: -20, x1: 16, z0: -11, z1: 9 },
    rooms: [
      // The landing wraps the foot of the stair: the shaft comes down through
      // the ceiling here, so nothing may stand in its way at mid-flight.
      { id: 'B-01', name: 'Basement Landing', kind: 'corridor', x0: -19, x1: -14, z0: -11, z1: -5.4 },
      { id: 'B-02', name: 'Storage Cellar', kind: 'storage', x0: -19, x1: -8, z0: -5.4, z1: 2 },
      { id: 'B-03', name: 'Wine Cellar', kind: 'storage', x0: -8, x1: -1, z0: -5.4, z1: 2 },
      { id: 'B-04', name: 'Generator Room', kind: 'generator', x0: 0, x1: 6, z0: -8, z1: 2 },
      { id: 'B-05', name: 'Workshop', kind: 'workshop', x0: 6, x1: 14, z0: -8, z1: 2 },
      { id: 'B-06', name: 'Service Passage', kind: 'corridor', x0: -19, x1: 14, z0: 2, z1: 4 },
      { id: 'B-07', name: 'Old Cellar', kind: 'storage', x0: -1, x1: 6, z0: 4, z1: 8 },
      { id: 'B-08', name: 'Tunnel Junction', kind: 'tunnel', x0: 6, x1: 16, z0: 4, z1: 8 },
    ],
    doors: [
      { axis: 'x', c: -5.4, at: -18, w: 1.1 },  // landing -> storage cellar
      { axis: 'x', c: 2, at: -16, w: 1.0 },   // storage -> passage
      { axis: 'x', c: 2, at: -4, w: 1.0 },    // wine -> passage
      { axis: 'x', c: 2, at: 3, w: 1.0 },     // generator -> passage
      { axis: 'x', c: 2, at: 10.5, w: 1.0 },  // workshop -> passage
      { axis: 'x', c: 4, at: 3, w: 1.0 },     // old cellar -> junction
      { axis: 'x', c: 4, at: 10.5, w: 1.0 },  // passage -> junction
      { axis: 'z', c: -8, at: -2, w: 1.0 },   // storage -> wine
      { axis: 'z', c: 16, at: 6, w: 1.8 },    // tunnel mouth
    ],
  },
  {
    id: 'GF', name: 'Ground Floor', y: 0, h: 4.2,
    floor: 'woodFloor', wall: 'wallBlue', ceiling: 'wallPlaster',
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -5, z1: 2 },              // courtyard
      { kind: 'rect', x0: -17.2, x1: -14.2, z0: -11, z1: -5.4 },    // basement stair
    ],
    rooms: [
      { id: 'GF-00', name: 'Service Hall', kind: 'corridor', x0: -17, x1: -14, z0: -11, z1: 11 },
      { id: 'GF-01', name: 'Kitchen', kind: 'kitchen', x0: -24, x1: -17, z0: -11, z1: -4 },
      { id: 'GF-02', name: 'Pantry', kind: 'storage', x0: -24, x1: -17, z0: -4, z1: 0 },
      { id: 'GF-03', name: 'Laundry', kind: 'utility', x0: -24, x1: -17, z0: 0, z1: 4 },
      { id: 'GF-04', name: "Staff Room", kind: 'bedroom', x0: -24, x1: -17, z0: 4, z1: 8 },
      { id: 'GF-05', name: 'Guest Room 1', kind: 'bedroom', x0: -24, x1: -17, z0: 8, z1: 11 },
      { id: 'GF-06', name: 'Library / Study', kind: 'study', x0: -14, x1: -6, z0: -11, z1: -2 },
      { id: 'GF-07', name: 'Dining Room', kind: 'dining', x0: -6, x1: 2, z0: -11, z1: -2 },
      { id: 'GF-08', name: 'Family Lounge', kind: 'living', x0: 2, x1: 8, z0: -11, z1: -2 },
      { id: 'GF-09', name: 'Guest Room 3', kind: 'bedroom', x0: 8, x1: 14, z0: -11, z1: -5 },
      { id: 'GF-10', name: 'Wine Room', kind: 'storage', x0: 14, x1: 21, z0: -11, z1: -5 },
      { id: 'GF-11', name: 'Inner Courtyard', kind: 'courtyard', x0: 8, x1: 20, z0: -5, z1: 2 },
      { id: 'GF-12', name: 'Gallery / Reception Hall', kind: 'gallery', x0: -14, x1: 8, z0: -2, z1: 2 },
      { id: 'GF-13', name: 'Formal Living Room', kind: 'living', x0: -14, x1: -5, z0: 2, z1: 11 },
      { id: 'GF-14', name: 'Foyer', kind: 'foyer', x0: -5, x1: 4, z0: 2, z1: 11 },
      { id: 'GF-15', name: 'Sitting Room', kind: 'living', x0: 4, x1: 8, z0: 2, z1: 11 },
      { id: 'GF-16', name: 'Guest Room 4', kind: 'bedroom', x0: 8, x1: 21, z0: 2, z1: 11 },
    ],
    doors: [
      // entrance, foyer, reception gallery
      { axis: 'x', c: 11, at: 0, w: 2.2, entrance: true },
      { axis: 'x', c: 2, at: 0, w: 2.8, arch: true },
      { axis: 'x', c: 2, at: -10, w: 1.2},
      { axis: 'x', c: 2, at: 6.5, w: 1.0 },
      { axis: 'z', c: 8, at: 0, w: 2.6, arch: true },   // gallery -> courtyard
      { axis: 'z', c: -14, at: 0, w: 2.2, arch: true }, // gallery -> service hall
      // the four rooms opening off the gallery's north side
      { axis: 'x', c: -2, at: -10, w: 1.2 },
      { axis: 'x', c: -2, at: -2.5, w: 1.6, arch: true },
      { axis: 'x', c: -2, at: 5, w: 1.2 },
      // west service wing
      { axis: 'z', c: -17, at: -4.8, w: 1.0 },
      { axis: 'z', c: -17, at: -2, w: 1.0 },
      { axis: 'z', c: -17, at: 2, w: 1.0 },
      { axis: 'z', c: -17, at: 6, w: 1.0 },
      { axis: 'z', c: -17, at: 9.5, w: 1.0 },
      { axis: 'z', c: -14, at: -3.5, w: 1.0 },
      { axis: 'z', c: -14, at: 6, w: 1.0 },
      { axis: 'z', c: -24, at: 6, w: 1.2 },
      // courtyard edge rooms
      { axis: 'z', c: 8, at: -3.5, w: 1.0 },   // family lounge -> courtyard
      { axis: 'x', c: -5, at: 11.5, w: 1.1 },  // guest room 3 -> courtyard
      { axis: 'x', c: -5, at: 17, w: 1.0 },    // wine room -> courtyard
      { axis: 'x', c: 2, at: 15, w: 1.1 },     // guest room 4 -> courtyard
    ],
  },
  {
    id: 'F2', name: 'Private Family Floor', y: 4.2, h: 3.6,
    floor: 'woodFloorOld', wall: 'wallpaper', ceiling: 'wallPlaster',
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -6, z1: 2 },
      { kind: 'circle', x: -1.5, z: 7.5, r: 3.45 },
    ],
    rooms: [
      { id: 'FF2-01', name: 'Upper Landing', kind: 'corridor', x0: -22, x1: 8, z0: -2, z1: 2 },
      { id: 'FF2-02', name: 'South Walkway', kind: 'corridor', x0: -22, x1: 20, z0: 2, z1: 4 },
      { id: 'FF2-03', name: 'Master Bedroom', kind: 'bedroom', x0: -6, x1: 2, z0: -11, z1: -2 },
      { id: 'FF2-04', name: "Her Dressing Room", kind: 'dressing', x0: 2, x1: 5, z0: -11, z1: -6 },
      { id: 'FF2-05', name: 'Master Bath', kind: 'bath', x0: 5, x1: 8, z0: -11, z1: -6 },
      { id: 'FF2-06', name: 'Bedroom 3', kind: 'bedroom', x0: -14, x1: -7, z0: -11, z1: -2 },
      { id: 'FF2-07', name: 'Prayer Room', kind: 'chapel', x0: -22, x1: -15, z0: -11, z1: -2 },
      { id: 'FF2-08', name: 'Linen Room', kind: 'storage', x0: 3, x1: 8, z0: -6, z1: -2 },
      { id: 'FF2-09', name: 'Family Sitting Room', kind: 'living', x0: -22, x1: -13, z0: 4, z1: 10 },
      { id: 'FF2-10', name: 'Bedroom 2', kind: 'bedroom', x0: -12, x1: -6, z0: 4, z1: 10 },
      { id: 'FF2-11', name: 'Bedroom 5', kind: 'bedroom', x0: 5, x1: 10, z0: 4, z1: 10 },
      { id: 'FF2-12', name: 'Study / Library', kind: 'study', x0: 11, x1: 17, z0: 4, z1: 10 },
      { id: 'FF2-13', name: 'Grand Stair Hall', kind: 'foyer', x0: -6, x1: 5, z0: 4, z1: 11 },
    ],
    doors: [
      { axis: 'x', c: -2, at: -2, w: 1.4 },
      { axis: 'x', c: -2, at: -10.5, w: 1.0 },
      { axis: 'x', c: -2, at: -18, w: 1.0 },
      { axis: 'z', c: 2, at: -8, w: 1.0 },
      { axis: 'z', c: 5, at: -8, w: 1.0 },
      { axis: 'x', c: -6, at: 5, w: 1.0 },
      { axis: 'x', c: 2, at: -18, w: 1.0 },
      { axis: 'x', c: 4, at: -9, w: 1.0 },
      { axis: 'x', c: 4, at: 7, w: 1.0 },
      { axis: 'x', c: 4, at: 14, w: 1.0 },
      { axis: 'z', c: 10, at: 6, w: 1.0 },
      { axis: 'z', c: 5, at: 6, w: 1.3 },
      { axis: 'x', c: -2, at: 5.5, w: 1.0 },   // linen room -> upper landing
      { axis: 'x', c: 4, at: -17, w: 1.0 },    // family sitting room -> south walkway
    ],
  },
  {
    id: 'F3', name: 'Attic & Private Retreat', y: 8.0, h: 3.1,
    floor: 'woodFloorOld', wall: 'wallpaper', ceiling: 'woodGrey',
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -6, z1: 2 },
      { kind: 'circle', x: -1.5, z: 7.5, r: 3.45 },
    ],
    rooms: [
      { id: 'FF3-01', name: 'Upper Gallery Walkway', kind: 'corridor', x0: -22, x1: 8, z0: -2, z1: 2 },
      { id: 'FF3-02', name: 'South Walkway', kind: 'corridor', x0: -22, x1: 20, z0: 2, z1: 4 },
      { id: 'FF3-03', name: 'Ancestral Portrait Gallery', kind: 'gallery', x0: -6, x1: 2, z0: -11, z1: -2 },
      { id: 'FF3-04', name: 'Music Room', kind: 'music', x0: -14, x1: -7, z0: -11, z1: -2 },
      { id: 'FF3-05', name: 'Guest Bedroom 2', kind: 'bedroom', x0: -22, x1: -15, z0: -11, z1: -2 },
      { id: 'FF3-06', name: 'Master Suite', kind: 'bedroom', x0: -22, x1: -14, z0: 4, z1: 10 },
      { id: 'FF3-07', name: 'Family Room', kind: 'living', x0: -12, x1: -6, z0: 4, z1: 10 },
      { id: 'FF3-08', name: 'Sewing / Craft Room', kind: 'workshop', x0: 2, x1: 8, z0: -11, z1: -5 },
      { id: 'FF3-09', name: 'Private Bedroom 3', kind: 'bedroom', x0: 8, x1: 14, z0: -11, z1: -5 },
      { id: 'FF3-10', name: 'Locked Historical Study', kind: 'study', x0: 10, x1: 16, z0: 4, z1: 10 },
      // The south-east corner of this level is the open courtyard void below:
      // the reference draws it as an open roof terrace and it is a hole here,
      // ringed by the balustrade, not a room.
      { id: 'FF3-12', name: 'Grand Stair Hall', kind: 'foyer', x0: -5, x1: 4, z0: 4, z1: 11 },
    ],
    doors: [
      { axis: 'x', c: -2, at: -2, w: 1.4 },
      { axis: 'x', c: -2, at: -10.5, w: 1.0 },
      { axis: 'x', c: -2, at: -18, w: 1.0 },
      { axis: 'x', c: 2, at: -18, w: 1.6 },   // walkway -> south walkway (west)
      { axis: 'x', c: 2, at: 6, w: 1.6 },     // walkway -> south walkway (east)
      { axis: 'x', c: 4, at: -18, w: 1.0 },   // master suite
      { axis: 'x', c: 4, at: -9, w: 1.0 },    // family room
      { axis: 'x', c: 4, at: 13, w: 1.0 },    // locked historical study
      { axis: 'x', c: 4, at: 3, w: 1.4 },     // grand stair hall (clear of the balustrade)
      { axis: 'z', c: 2, at: -8, w: 1.0 },    // portrait gallery -> sewing room
      { axis: 'z', c: 8, at: -8, w: 1.0 },    // sewing room -> private bedroom 3
    ],
  },
  {
    id: 'F4', name: 'Rooftop & Observation Level', y: 11.6, h: 3.0,
    floor: 'concreteFloor', wall: 'stone', ceiling: null,
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -6, z1: 2 },
      { kind: 'circle', x: -1.5, z: 7.5, r: 3.45 },
    ],
    rooms: [
      { id: 'FF4-01', name: 'Observation Gallery', kind: 'gallery', x0: -6, x1: 5, z0: 2, z1: 11 },
      { id: 'FF4-02', name: 'Archive / Library', kind: 'study', x0: -22, x1: -14, z0: -11, z1: 0 },
      { id: 'FF4-03', name: 'Observatory', kind: 'observatory', x0: -10, x1: -4, z0: -11, z1: -5 },
      { id: 'FF4-04', name: 'Bell / Clock Room', kind: 'bell', x0: 8, x1: 14, z0: -6, z1: 0 },
      { id: 'FF4-05', name: 'Roof Lantern', kind: 'storage', x0: -1, x1: 5, z0: -11, z1: -6 },
      { id: 'FF4-06', name: 'Maintenance Room', kind: 'workshop', x0: -22, x1: -14, z0: 2, z1: 10 },
      { id: 'FF4-07', name: "Caretaker's Room", kind: 'bedroom', x0: -13, x1: -7, z0: 4, z1: 10 },
    ],
    doors: [
      { axis: 'x', c: 0, at: -18, w: 1.0 },    // archive -> roof deck
      { axis: 'x', c: -5, at: -7, w: 1.0 },    // observatory -> roof deck
      { axis: 'x', c: 0, at: 11, w: 1.2 },     // bell room -> roof deck
      { axis: 'z', c: 8, at: -3, w: 1.0 },     // bell room -> roof deck (west)
      { axis: 'x', c: 2, at: -18, w: 1.0 },    // maintenance -> roof deck
      { axis: 'x', c: 4, at: -10, w: 1.0 },    // caretaker -> roof deck
      { axis: 'z', c: -6, at: 6, w: 1.0 },     // gallery <-> caretaker
      { axis: 'x', c: -6, at: 2, w: 1.0 },     // roof lantern -> roof deck
    ],
  },
];

// The continuous stair tower. Three helices, one per floor change, same centre
// and radii: the player climbs one turn per floor. Landing angles are shared,
// so a floor's hole always has the top of the helix below it at floor level.
export const STAIR = {
  cx: -1.5, cz: 7.5, r0: 1.05, r1: 3.25,
  rise: [4.2, 3.8, 3.6], a0: Math.PI / 2, turns: 1,
};

// Openings cut into the perimeter for windows. Generated by the builder on the
// four outer walls, except where an entrance or courtyard wall already is.
export const WINDOWS = {
  spacing: 4.2, width: 1.0, sill: 1.0, head: 2.55,
};

export function roomAt(level, x, z) {
  for (const r of level.rooms) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
  }
  return null;
}
