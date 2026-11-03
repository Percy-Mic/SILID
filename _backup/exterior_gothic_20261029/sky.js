// SKY — the night above the estate.
//
// The world used to have no sky at all: a flat 0x0a0f14 clear colour and an
// exponential fog. That reads as a black lid, and it also hid the one thing a
// rural Philippine night is full of — stars. This builds three layers:
//
//   1. A gradient dome (8 km of haze compressed into 200 m) that gives the
//      horizon the pale dust-glow it has in humid air, and the zenith real
//      darkness.
//   2. Stars as POINTS, not a texture. Positions are sampled over a sphere with
//      a brightness distribution skewed to faint (a magnitude curve, not a
//      uniform random), plus a loose Milky Way band. Points are unaffected by
//      fog and sized in pixels, so they stay 1-3 px pinpricks at any distance
//      instead of becoming glowing blobs.
//   3. The moon, placed on the exact direction of the scene's directional
//      light, with a soft halo. Sky and lighting cannot disagree, because the
//      light is passed in.
//
// Everything here is cheap: 4 draw calls, ~3 500 vertices, no textures except
// the 128 px halo gradient generated in a canvas.

import * as THREE from 'three';

const DOME_R = 200;
const STAR_R = 190;

export const sky = { group: null, stars: 0, moonDir: null, dome: null };

function randFactory(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function domeMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(0x101c26) },
      uZenith: { value: new THREE.Color(0x03060a) },
      uGlow: { value: new THREE.Color(0x16232e) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uGlow;
      uniform vec3 uMoonDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        // horizon haze -> zenith: pow keeps the glow band low and thin
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.5, 1.0, h), 0.55));
        // moonlight scattered in the haze around the moon, not a spotlight
        float m = max(dot(normalize(vDir), normalize(uMoonDir)), 0.0);
        col += uGlow * pow(m, 3.0) * 0.55 * (1.0 - smoothstep(0.55, 1.0, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// A star is placed by magnitude: many faint, a handful bright. Uniform sizes
// look like glitter; a magnitude curve looks like a sky.
function starField(count, radius, seed, band = false) {
  const rnd = randFactory(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (band) {
      // a great circle tilted off the vertical, with scatter across it
      const t = rnd() * Math.PI * 2;
      const w = (rnd() + rnd() + rnd() - 1.5) * 0.16;
      const tilt = 0.62;
      const bx = Math.cos(t), bz = Math.sin(t);
      x = bx * Math.cos(w) - Math.sin(tilt) * Math.sin(w) * 0;
      y = Math.sin(tilt) * 0.9 + w * 1.4;
      z = bz * Math.cos(w);
      const len = Math.hypot(x, y, z) || 1;
      x /= len; y /= len; z /= len;
    } else {
      // uniform on the sphere, kept above the horizon
      const u = rnd() * 2 - 1;
      const t = rnd() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      x = Math.cos(t) * r;
      y = u;
      z = Math.sin(t) * r;
      if (y < 0.05) { i--; continue; }
    }
    pos[i * 3] = x * radius;
    pos[i * 3 + 1] = y * radius;
    pos[i * 3 + 2] = z * radius;

    // magnitude: 0.25 draws are dim, 0.031 are first-magnitude bright
    const m = Math.pow(rnd(), 3.2);
    const b = 0.28 + m * 0.72;
    // colour temperature: mostly white, some blue, a few warm
    const warm = rnd();
    if (warm > 0.86) c.setRGB(1.0, 0.86 * b + 0.1, 0.66 * b + 0.08);
    else if (warm > 0.6) c.setRGB(0.82 * b + 0.16, 0.88 * b + 0.12, 1.0);
    else c.setRGB(b, b * 0.99, b * 0.96);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function haloTexture() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, 'rgba(226,236,255,0.85)');
  grad.addColorStop(0.12, 'rgba(198,215,245,0.42)');
  grad.addColorStop(0.35, 'rgba(150,176,210,0.14)');
  grad.addColorStop(1.0, 'rgba(90,120,160,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSky(scene, moonPosition) {
  const group = new THREE.Group();
  group.name = 'SKY';
  const dir = moonPosition.clone().normalize();

  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 20), domeMaterial());
  dome.name = 'SkyDome';
  dome.material.uniforms.uMoonDir.value.copy(dir);
  dome.renderOrder = -100;
  dome.frustumCulled = false;
  group.add(dome);

  // 1 300 field stars + 900 Milky Way points. Sized in pixels, so they never
  // turn into blobs; no fog, so the haze does not eat them.
  const field = new THREE.Points(
    starField(1300, STAR_R, 0x51ced, false),
    new THREE.PointsMaterial({
      size: 1.9, sizeAttenuation: false, vertexColors: true,
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  field.name = 'Stars';
  field.renderOrder = -90;
  field.frustumCulled = false;
  group.add(field);

  const band = new THREE.Points(
    starField(900, STAR_R * 0.99, 0x2ef1, true),
    new THREE.PointsMaterial({
      size: 1.3, sizeAttenuation: false, vertexColors: true,
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, opacity: 0.85,
    }),
  );
  band.name = 'MilkyWay';
  band.renderOrder = -89;
  band.frustumCulled = false;
  group.add(band);

  const moonPos = dir.clone().multiplyScalar(DOME_R * 0.92);
  const disc = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xeaf0fb, fog: false }),
  );
  disc.name = 'Moon';
  disc.position.copy(moonPos);
  disc.renderOrder = -95;
  disc.frustumCulled = false;
  group.add(disc);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(),
    color: 0xb9cdf0,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
  }));
  halo.name = 'MoonHalo';
  halo.position.copy(moonPos);
  halo.scale.setScalar(46);
  halo.renderOrder = -96;
  group.add(halo);

  scene.add(group);

  sky.group = group;
  sky.dome = dome;
  sky.stars = 1300 + 900;
  sky.moonDir = dir.clone();
  scene.userData.sky = sky;
  return sky;
}
