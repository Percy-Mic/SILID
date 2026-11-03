// PRIMITIVES — the geometry helpers the builders share.
//
// The same 12-line UV-scaled box had been copied into architecture.js, props.js
// and underground.js. Anything built from boxes after this point imports it
// from here instead, so a fix to the UV convention (metres of texture, not one
// copy stretched over the whole face) lands everywhere it is used.

import * as THREE from 'three';

// Sets UVs in metres of surface: a 40 m wall then tiles its texture every
// `scale` metres instead of smearing a single copy along its length.
export function boxUV(g, w, h, d, scale = 1) {
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [uw, uh] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * uw * scale, uv.getY(k) * uh * scale);
    }
  }
  uv.needsUpdate = true;
  g.clearGroups();
  return g;
}

export function box(w, h, d, scale = 0.42) {
  const g = new THREE.BoxGeometry(w, h, d);
  boxUV(g, w, h, d, scale);
  return g;
}

// Every triangle of a roof must face up and out. Hand-written winding is one
// sign error away from a slope that is lit from underneath, so the geometry is
// built first and re-wound face by face afterwards.
function orientUp(geo) {
  const pos = geo.attributes.position;
  const index = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i), i1 = index.getX(i + 1), i2 = index.getX(i + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    if (n.lengthSq() < 1e-10) continue;
    if (n.y < 0) {
      index.setX(i + 1, i2);
      index.setX(i + 2, i1);
    }
  }
  index.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// A hipped roof over a rectangle, with real eaves. A flat slab is not a roof:
// no pitch, no overhang, no ridge, no fascia line — which is why a building
// roofed in boxes reads as a box.
//
// The ridge runs along the longer axis, inset by half the short side (the
// standard hip). A square plan has no ridge to run along, so it becomes the
// pyramid it geometrically is — the degenerate ridge is not emitted as two
// zero-area triangles, which is what produced NaN normals in the first pass.
//
// Returns the merged slope geometry plus the ridge line, so the caller can cap
// the ridge and hang fascia off the eaves without repeating this maths.
export function hipRoof(x0, x1, z0, z1, yBase, rise, overhang = 0.45, tile = 1.15) {
  const bx0 = x0 - overhang, bx1 = x1 + overhang;
  const bz0 = z0 - overhang, bz1 = z1 + overhang;
  const w = bx1 - bx0, d = bz1 - bz0;
  const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  const ridgeY = yBase + rise;
  const alongX = w >= d;

  const pos = [], uv = [], idx = [];
  const v = (x, y, z, u, s) => {
    pos.push(x, y, z);
    uv.push(u / tile, s / tile);
    return pos.length / 3 - 1;
  };
  const tri = (a, b, c) => idx.push(a, b, c);

  // eave corners
  const SW = [bx0, yBase, bz0], SE = [bx1, yBase, bz0];
  const NE = [bx1, yBase, bz1], NW = [bx0, yBase, bz1];

  // ridge endpoints, along the long axis
  let r0, r1, ridgeLength;
  if (alongX) {
    const inset = d / 2;
    r0 = [bx0 + inset, ridgeY, cz];
    r1 = [bx1 - inset, ridgeY, cz];
    ridgeLength = r1[0] - r0[0];
  } else {
    const inset = w / 2;
    r0 = [cx, ridgeY, bz0 + inset];
    r1 = [cx, ridgeY, bz1 - inset];
    ridgeLength = r1[2] - r0[2];
  }

  const slopeLen = Math.hypot(alongX ? d / 2 : w / 2, rise);

  if (ridgeLength < 0.05) {
    // square plan: four hips meeting at one apex
    const apex = [cx, ridgeY, cz];
    const A = v(...apex, 0, slopeLen);
    // south, east, north, west — each a single triangle to the apex
    const s0 = v(...SW, 0, 0), s1 = v(...SE, w, 0);
    tri(s0, s1, A);
    const e0 = v(...SE, 0, 0), e1 = v(...NE, d, 0);
    tri(e0, e1, A);
    const n0 = v(...NE, 0, 0), n1 = v(...NW, w, 0);
    tri(n0, n1, A);
    const w0 = v(...NW, 0, 0), w1 = v(...SW, d, 0);
    tri(w0, w1, A);
  } else if (alongX) {
    // two trapezoid slopes and two triangular hips
    const a = v(...SW, 0, 0), b = v(...SE, w, 0);
    const c = v(r1[0], ridgeY, cz, w - (bx1 - r1[0]), slopeLen);
    const e = v(r0[0], ridgeY, cz, w - (bx1 - r0[0]), slopeLen);
    tri(a, b, c); tri(a, c, e);

    const f = v(...NE, 0, 0), g = v(...NW, w, 0);
    const h = v(r0[0], ridgeY, cz, w - (r0[0] - bx0), slopeLen);
    const i = v(r1[0], ridgeY, cz, w - (r1[0] - bx0), slopeLen);
    tri(f, g, h); tri(f, h, i);

    const j = v(...NW, 0, 0), k = v(...SW, d, 0);
    const l = v(r0[0], ridgeY, cz, d / 2, slopeLen);
    tri(j, k, l);

    const m = v(...SE, 0, 0), n = v(...NE, d, 0);
    const o = v(r1[0], ridgeY, cz, d / 2, slopeLen);
    tri(m, n, o);
  } else {
    // ridge runs along z
    const a = v(...SW, 0, 0), b = v(...NW, d, 0);
    const c = v(cx, ridgeY, r1[2], d - (bz1 - r1[2]), slopeLen);
    const e = v(cx, ridgeY, r0[2], d - (bz1 - r0[2]), slopeLen);
    tri(a, b, c); tri(a, c, e);

    const f = v(...NE, 0, 0), g = v(...SE, d, 0);
    const h = v(cx, ridgeY, r0[2], r0[2] - bz0, slopeLen);
    const i = v(cx, ridgeY, r1[2], r1[2] - bz0, slopeLen);
    tri(f, g, h); tri(f, h, i);

    const j = v(...NE, 0, 0), k = v(...NW, w, 0);
    const l = v(cx, ridgeY, r1[2], w / 2, slopeLen);
    tri(j, k, l);

    const m = v(...SW, 0, 0), n = v(...SE, w, 0);
    const o = v(cx, ridgeY, r0[2], w / 2, slopeLen);
    tri(m, n, o);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  orientUp(geo);

  return {
    geometry: geo,
    ridge: {
      a: [r0[0], ridgeY, r0[2]],
      b: [r1[0], ridgeY, r1[2]],
      axis: alongX ? 'x' : 'z',
      length: ridgeLength,
      apex: ridgeLength < 0.05,
    },
  };
}

// An irregular stone: an icosahedron pushed around by two cheap trig fields.
// Used for rubble and boulders, where a box always reads as a box.
export function stoneGeometry(radius = 1, detail = 1, seed = 0) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 1 + 0.22 * Math.sin(x * 3.1 + z * 2.3 + seed) + 0.12 * Math.cos(y * 4.2 - seed);
    pos.setXYZ(i, x * n * 1.22, y * n * 0.82, z * n);
  }
  g.computeVertexNormals();
  return g;
}
