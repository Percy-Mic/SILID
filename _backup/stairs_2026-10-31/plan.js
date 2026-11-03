
 // THE PLAN. One coordinate system for all six levels, in metres.

export const FOOT = { x0: -24, x1: 22, z0: -11, z1: 11 };

export const CreditSide = 'Ekblad & Malmström — proprietary reference model, not shipped in the game';

export const STAIR = {
  cx: -3.58,
  cz: 6.75,
  ax: -4.85,
  aw: 1.12,
  bx: -3.43,
  bw: 1.12,
  zs: 9.20,
  run: 3.10,
  landZ: 4.25,
  rise: [4.2, 3.8, 3.6],
  risers: [[12, 12], [11, 11], [11, 10]],
  basementHole: {
    kind: 'rect',
    x0: -16.9,
    x1: -14.5,
    z0: -10.9,
    z1: -6.05,
  },
  hole: {
    x0: -5.00,
    x1: -2.10,
    z0: 4.25,
    z1: 9.20,
  },
  ladder: {
    x: -17.0,
    z: -11.0,
    xw: 0.12,
    zt: 8.0,
    rungD: 0.02,
    rungS: 0.25,
    rkind: 'ladder',
    topX: -17.0,
    topZ: -11.0,
    topY: 8.0,
  },
};

STAIR.zn = +(STAIR.zs - STAIR.run).toFixed(3);

const STAIR_HOLE = { kind: 'rect', ...STAIR.hole };

export const LEVELS = [
  {
    id: 'B1',
    name: 'Basement',
    // The basement's floor is the service tunnel's floor. It was authored at
    // -10 while the basement stair (buildBasementStair) lands at -3.4, the
    // tunnel leaves the east wall at -3.4, and the generator sits at -3.4: a
    // ten-metre cellar with three-metre doors, twelve-metre walls that pushed
    // through the ground floor, and a tunnel mouth 6.6 m up its east wall.
    // One number fixes the whole stack.
    y: -3.4,
    // 3.0 m clear, so the ceiling lands 0.1 m under the ground floor's slab
    // (which is 0.30 m thick and sits directly under y=0).
    h: 3.0,
    floor: 'concrete',
    // 'wallDark' was never a material: it was invented for this level and
    // buildArchitecture threw on it (materials[level.wall].clone()). A damp
    // basement is render over brick, which is what the concrete set gives.
    wall: 'concrete',
    ceiling: 'concrete',
    footprint: { x0: -20, x1: 16, z0: -11, z1: 9 },
    rooms: [
      { id: 'B-01', name: 'Basement Landing', kind: 'corridor', x0: -19, x1: -14, z0: -11, z1: -5.4 },
      { id: 'B-02', name: 'Storage Cellar', kind: 'storage', x0: -19, x1: -8, z0: -5.4, z1: 2 },
      { id: 'B-03', name: 'Wine Cellar', kind: 'storage', x0: -8, x1: -1, z0: -5.4, z1: 2 },
      { id: 'B-04', name: 'Generator Room', kind: 'generator', x0: 0, x1: 6, z0: -8, z1: 2 },
      // The imported interrogation cell fills this room; the name follows it.
      { id: 'B-05', name: 'Interrogation Room', kind: 'workshop', x0: 6, x1: 14, z0: -8, z1: 2 },
      { id: 'B-06', name: 'Service Passage', kind: 'corridor', x0: -19, x1: 14, z0: 2, z1: 4 },
      { id: 'B-07', name: 'Old Cellar', kind: 'storage', x0: -1, x1: 6, z0: 4, z1: 8 },
      { id: 'B-08', name: 'Tunnel Junction', kind: 'tunnel', x0: 6, x1: 16, z0: 4, z1: 8 },
    ],
    doors: [
      { axis: 'x', c: -5.4, at: -18, w: 1.1 },
      { axis: 'x', c: 2, at: -16, w: 1.0 },
      { axis: 'x', c: 2, at: -4, w: 1.0 },
      { axis: 'x', c: 2, at: 3, w: 1.0 },
      { axis: 'x', c: 2, at: 10.5, w: 1.0 },
      { axis: 'x', c: 4, at: 3, w: 1.0 },
      { axis: 'x', c: 4, at: 10.5, w: 1.0 },
      { axis: 'z', c: -8, at: -2, w: 1.0 },
      { axis: 'z', c: 16, at: 6, w: 1.8 },
    ],
  },

  {
    id: 'GF',
    name: 'Ground Floor',
    y: 0,
    h: 4.2,
    floor: 'woodFloor',
    wall: 'wallBlue',
    ceiling: 'wallPlaster',
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -5, z1: 2 },
      { ...STAIR.basementHole },
    ],
    rooms: [
      { id: 'GF-00', name: 'Service Hall', kind: 'corridor', x0: -17, x1: -14, z0: -11, z1: 11 },
      { id: 'GF-01', name: 'Kitchen', kind: 'kitchen', x0: -24, x1: -17, z0: -11, z1: -4 },
      { id: 'GF-02', name: 'Pantry', kind: 'storage', x0: -24, x1: -17, z0: -4, z1: 0 },
      { id: 'GF-03', name: 'Laundry', kind: 'utility', x0: -24, x1: -17, z0: 0, z1: 4 },
      { id: 'GF-04', name: 'Staff Room', kind: 'bedroom', x0: -24, x1: -17, z0: 4, z1: 8 },
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
      { axis: 'x', c: 11, at: 0, w: 2.2, entrance: true },
      { axis: 'x', c: 2, at: 0, w: 2.8, arch: true },
      { axis: 'x', c: 2, at: -10, w: 1.2 },
      { axis: 'x', c: 2, at: 6.5, w: 1.0 },
      { axis: 'z', c: 8, at: 0, w: 2.6, arch: true },
      { axis: 'z', c: -14, at: 0, w: 2.2, arch: true },
      { axis: 'x', c: -2, at: -10, w: 1.2 },
      { axis: 'x', c: -2, at: -2.5, w: 1.6, arch: true },
      { axis: 'x', c: -2, at: 5, w: 1.2 },
      { axis: 'z', c: -17, at: -4.8, w: 1.0 },
      { axis: 'z', c: -17, at: -2, w: 1.0 },
      { axis: 'z', c: -17, at: 2, w: 1.0 },
      { axis: 'z', c: -17, at: 6, w: 1.0 },
      { axis: 'z', c: -17, at: 9.5, w: 1.0 },
      { axis: 'z', c: -14, at: -3.5, w: 1.0 },
      { axis: 'z', c: -14, at: 6, w: 1.0 },
      { axis: 'z', c: -24, at: 6, w: 1.2 },
      { axis: 'z', c: 8, at: -3.5, w: 1.0 },
      { axis: 'x', c: -5, at: 11.5, w: 1.1 },
      { axis: 'x', c: -5, at: 17, w: 1.0 },
      { axis: 'x', c: 2, at: 15, w: 1.1 },
      { axis: 'z', c: 8, at: -9.0, w: 1.0 },
      { axis: 'z', c: 14, at: -9.0, w: 1.0 },
      { axis: 'z', c: 8, at: 8.0, w: 1.0 },
    ],
  },

  {
    id: 'F2',
    name: 'Private Family Floor',
    y: 4.2,
    h: 3.8,
    floor: 'woodFloorOld',
    wall: 'wallpaper',
    ceiling: 'wallPlaster',
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -5, z1: 2 },
      { ...STAIR_HOLE },
    ],
    rooms: [
      { id: 'FF2-01', name: 'Upper Landing', kind: 'corridor', x0: -22, x1: 8, z0: -2, z1: 2 },
      { id: 'FF2-02', name: 'South Walkway', kind: 'corridor', x0: -22, x1: 20, z0: 2, z1: 4 },
      { id: 'FF2-03', name: 'Master Bedroom', kind: 'bedroom', x0: -6, x1: 2, z0: -11, z1: -2 },
      { id: 'FF2-04', name: 'Her Dressing Room', kind: 'dressing', x0: 2, x1: 5, z0: -11, z1: -6 },
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
      { axis: 'x', c: -2, at: 5.5, w: 1.0 },
      { axis: 'x', c: 4, at: -17, w: 1.0 },
    ],
  },

  {
    id: 'F3',
    name: 'Attic & Private Retreat',
    y: 8.0,
    h: 3.6,
    floor: 'woodFloorOld',
    wall: 'wallpaper',
    ceiling: 'woodGrey',
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -5, z1: 2 },
      { ...STAIR_HOLE },
    ],
    rooms: [
      { id: 'FF3-01', name: 'Upper Gallery Walkway', kind: 'corridor', x0: -22, x1: 8, z0: -2, z1: 2 },
      { id: 'FF3-02', name: 'South Walkway', kind: 'corridor', x0: -22, x1: 20, z0: 2, z1: 4 },
      { id: 'FF3-03', name: 'Ancestral Portrait Gallery', kind: 'gallery', x0: -6, x1: 2, z0: -11, z1: -2 },
      { id: 'FF3-04', name: 'Billiards Room', kind: 'music', x0: -14, x1: -7, z0: -11, z1: -2 },
      { id: 'FF3-05', name: 'Guest Bedroom 2', kind: 'bedroom', x0: -22, x1: -15, z0: -11, z1: -2 },
      { id: 'FF3-06', name: 'Master Suite', kind: 'bedroom', x0: -22, x1: -14, z0: 4, z1: 10 },
      { id: 'FF3-07', name: 'Family Room', kind: 'living', x0: -12, x1: -6, z0: 4, z1: 10 },
      { id: 'FF3-08', name: 'Sewing / Craft Room', kind: 'workshop', x0: 2, x1: 8, z0: -11, z1: -5 },
      { id: 'FF3-09', name: 'Private Bedroom 3', kind: 'bedroom', x0: 8, x1: 14, z0: -11, z1: -5 },
      { id: 'FF3-10', name: 'Locked Historical Study', kind: 'study', x0: 10, x1: 16, z0: 4, z1: 10 },
      { id: 'FF3-12', name: 'Grand Stair Hall', kind: 'foyer', x0: -5, x1: 4, z0: 4, z1: 11 },
    ],
    doors: [
      { axis: 'x', c: 2, at: -18, w: 1.6 },
      { axis: 'x', c: 2, at: 6, w: 1.6 },
      // FF3-04 had no door at all: the attic's whole south block was sealed off
      // from the gallery because only the z=2 and z=4 walls ever got openings.
      { axis: 'x', c: -2, at: -10.5, w: 1.3 },
      { axis: 'x', c: 4, at: -18, w: 1.0 },
      { axis: 'x', c: 4, at: -9, w: 1.0 },
      { axis: 'x', c: 4, at: 13, w: 1.0 },
      { axis: 'x', c: 4, at: 3, w: 1.4 },
      { axis: 'z', c: 2, at: -8, w: 1.0 },
      { axis: 'z', c: 8, at: -8, w: 1.0 },
    ],
  },

  {
    id: 'F4',
    name: 'Rooftop & Observation Level',
    y: 11.6,
    h: 3.0,
    floor: 'concreteFloor',
    wall: 'stone',
    ceiling: null,
    footprint: FOOT,
    holes: [
      { kind: 'rect', x0: 8, x1: 20, z0: -5, z1: 2 },
      { ...STAIR_HOLE },
    ],
    rooms: [
      { id: 'FF4-01', name: 'Observation Gallery', kind: 'gallery', x0: -6, x1: 5, z0: 2, z1: 11 },
      { id: 'FF4-02', name: 'Archive / Library', kind: 'study', x0: -22, x1: -14, z0: -11, z1: 0 },
      { id: 'FF4-03', name: 'Observatory', kind: 'observatory', x0: -10, x1: -4, z0: -11, z1: -5 },
      { id: 'FF4-04', name: 'Bell / Clock Room', kind: 'bell', x0: 8, x1: 14, z0: 4, z1: 10 },
      { id: 'FF4-05', name: 'Roof Lantern', kind: 'storage', x0: -1, x1: 5, z0: -11, z1: -6 },
      { id: 'FF4-06', name: 'Maintenance Room', kind: 'workshop', x0: -22, x1: -14, z0: 2, z1: 10 },
      { id: 'FF4-07', name: "Caretaker's Room", kind: 'bedroom', x0: -13, x1: -7, z0: 4, z1: 10 },
      { id: 'FF4-10', name: 'Roof Deck', kind: 'terrace', x0: -24, x1: 22, z0: -11, z1: 11 },
    ],
    doors: [
      { axis: 'x', c: 0, at: -18, w: 1.0 },
      // The roof-deck service door. It is the only opening on the rear wall of
      // this storey, and it sits in the clear bay where three storeys of rear
      // windows leave a slot, so the exterior ladder can rise from the yard to
      // a steel landing outside it without crossing glass. It is set east of
      // the ladder on purpose, so the doorway and the climb do not compete for
      // the same prompt at the top of the landing.
      { axis: 'x', c: -11, at: -12.2, w: 1.0 },
      { axis: 'x', c: -5, at: -7, w: 1.0 },
      { axis: 'x', c: 4, at: 11, w: 1.2 },
      { axis: 'z', c: 8, at: 7, w: 1.0 },
      { axis: 'z', c: 5, at: 8, w: 1.2 },
      { axis: 'x', c: 2, at: -18, w: 1.0 },
      { axis: 'x', c: 4, at: -10, w: 1.0 },
      { axis: 'z', c: -6, at: 6, w: 1.0 },
      { axis: 'x', c: -6, at: 2, w: 1.0 },
    ],
  },
];

export const WINDOWS = {
  spacing: 4.2,
  width: 1.08,
  sill: 0.85,
  head: 3.2,
};

export function roomAt(level, x, z) {
  for (const r of level.rooms) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      return r;
    }
  }

  return null;
}
