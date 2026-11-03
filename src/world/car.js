// THE CAR — a 1990s Filipino family SUV, built here, not imported.
//
// The only vehicle GLB left in the project was an untextured, exploded damage
// variant: its wheels and panels sat metres away from the body, so it read as
// debris on the road. A provincial SUV is a simple enough shape to build
// correctly: a body, a cabin you can sit inside, four wheels that touch the
// tarmac, glazing you can see through, lamps that light the road, and a bonnet
// that opens on its hinge when the story needs it open.
//
// Local axes: +z is forward, +y is up. The car's LEFT is +x (LHD, as driven in
// the Philippines), so the driver sits at +x and the driver's door is hinged at
// its front edge on that side.
//
// Named handles the opening sequence drives:
//   car.frontPivots  steering knuckles (rotation.y = steer)
//   car.wheels       tyre+rim groups (rotation.x rolls them)
//   car.doorL        hinged driver's door group (rotation.y opens it)
//   car.bonnet       hinged bonnet group; car.setBonnet(open) animates it
//   car.spotL/R      headlight SpotLights + targets (car-local)
//   car.headLMat/RM  headlamp emissive materials
//   car.tailMat      tail lamp material (also the brake/hazard glow)
//   car.amberMat     hazard indicator material (front + rear)
//   car.clusterMat   instrument cluster glow (amber)
//   car.warnMat      dashboard warning lamp (red, off until the fault)
//   car.dashLight    dim instrument backlight (PointLight)

import * as THREE from 'three';

function part(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  return new THREE.Mesh(g, mat);
}

export function buildCar() {
  const car = new THREE.Group();
  car.name = 'Car';

  // Material values follow the authored car in the opening-scene blend
  // (Blender/AssetLibrary/Working/Opening/SILID_Act1.blend): its CAR_Paint is a
  // 0.4-metal paint and its Glass is a 0.4-metal, 0.27-rough glazing. The blend
  // left paint roughness at 1.0, which is a placeholder, so the roughness here
  // is set for a car standing under a moon and two headlights: a low-sheen
  // body that carries a highlight along its shoulder line instead of the flat
  // matte black the box car used to be.
  // Car paint is a dielectric: pigment under clearcoat, not bare metal. The
  // blend's 0.4 metallic value assumes an environment to reflect, and this
  // renderer has no environment map — a metallic paint would be black except
  // where a lamp hits it, which is exactly how the box car used to read. With
  // metalness at 0.06 the moon still shapes the panels and the clearcoat
  // highlight survives, so the vehicle has a body at night instead of a hole.
  const paint = new THREE.MeshStandardMaterial({ color: 0x2b322c, roughness: 0.38, metalness: 0.06 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.6, metalness: 0 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb6b6ae, roughness: 0.22, metalness: 1.0 });
  // DoubleSide: the player sits INSIDE the glass when driving, and front-side
  // culling would delete the windscreen from the driver's view.
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1a2426, roughness: 0.09, metalness: 0.2,
    transparent: true, opacity: 0.58, side: THREE.DoubleSide,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.94, metalness: 0 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.88, metalness: 0 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.98, metalness: 0 });
  const headLMat = new THREE.MeshStandardMaterial({ color: 0x3a3427, emissive: 0xffd9a0, emissiveIntensity: 1.15, roughness: 0.18, metalness: 0.1 });
  const headRMat = new THREE.MeshStandardMaterial({ color: 0x3a3427, emissive: 0xffd9a0, emissiveIntensity: 1.15, roughness: 0.18, metalness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x260505, emissive: 0x8a1010, emissiveIntensity: 0.75, roughness: 0.28 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0x33200a, emissive: 0xff9a2a, emissiveIntensity: 0, roughness: 0.3 });
  const clusterMat = new THREE.MeshStandardMaterial({ color: 0x120e08, emissive: 0xd9a441, emissiveIntensity: 0.85, roughness: 0.5 });
  const warnMat = new THREE.MeshStandardMaterial({ color: 0x180404, emissive: 0xd01818, emissiveIntensity: 0, roughness: 0.4 });

  // --- body: sill, door band, shoulder ------------------------------------
  car.add(part(1.84, 0.38, 4.42, paint, 0, 0.62, 0.05));
  car.add(part(1.9, 0.34, 4.3, paint, 0, 0.95, 0.06));
  car.add(part(1.78, 0.2, 1.15, paint, 0, 1.06, 1.86));       // bonnet-over panel
  car.add(part(1.72, 0.2, 0.9, paint, 0, 1.06, -1.9));        // tailgate top
  car.add(part(1.6, 0.28, 1.0, plastic, 0, 0.48, 2.16));      // front bumper
  car.add(part(1.6, 0.3, 0.7, plastic, 0, 0.48, -2.18));      // rear bumper
  car.add(part(1.3, 0.2, 0.1, plastic, 0, 0.74, 2.36));       // grille
  car.add(part(1.2, 0.16, 0.06, chrome, 0, 0.92, 2.34));

  // --- cabin shell: roof and pillars --------------------------------------
  car.add(part(1.6, 0.62, 2.55, paint, 0, 1.34, -0.35));
  car.add(part(1.5, 0.08, 2.2, paint, 0, 1.68, -0.32));
  for (const z of [0.86, -1.5]) {
    for (const x of [-0.76, 0.76]) car.add(part(0.08, 0.55, 0.1, paint, x, 1.33, z));
  }
  car.add(part(1.58, 0.06, 2.1, plastic, 0, 1.7, -0.2));       // roof rails

  // --- glazing -------------------------------------------------------------
  const windscreen = part(1.46, 0.55, 0.04, glass, 0, 1.34, 0.93, -0.32);
  car.add(windscreen);
  car.add(part(1.44, 0.5, 0.04, glass, 0, 1.34, -1.62, 0.28));
  for (const side of [-1, 1]) {
    for (const z of [0.28, -0.55, -1.2]) {
      car.add(part(0.03, 0.46, 0.62, glass, side * 0.795, 1.35, z));
    }
  }

  // --- driver's door: a real hinge on the car's left (+x) ------------------
  // The body band stays as structure; the door skin sits proud of it and
  // swings clear so the exit camera never steps through solid metal.
  const doorL = new THREE.Group();
  doorL.name = 'CarDoorDriver';
  doorL.position.set(0.925, 0, 0.62);              // hinge at the front edge
  {
    const skin = new THREE.Group();
    skin.position.set(0, 0, -0.69);                // centre of the 1.38 m door
    skin.add(part(0.05, 0.5, 1.38, paint, 0, 0.88, 0));
    skin.add(part(0.04, 0.06, 0.2, chrome, 0.02, 1.04, -0.1));   // handle
    skin.add(part(0.035, 0.42, 1.3, trim, -0.035, 0.9, 0));      // interior card
    skin.add(part(0.04, 0.05, 0.5, trim, -0.04, 1.06, -0.3));    // armrest
    skin.add(part(0.02, 0.44, 1.24, glass, 0, 1.34, -0.02));     // frame glass
    doorL.add(skin);
  }
  car.add(doorL);

  // --- wheels: front pair on steering knuckles ----------------------------
  // 24 sides on a 0.74 m tyre is a 10 cm facet, which reads as a polygon on the
  // silhouette of a car the player walks around with a torch; 10 on a rim reads
  // as a cog. The cost is ~1k triangles for all four wheels.
  const tyre = new THREE.CylinderGeometry(0.37, 0.37, 0.24, 24);
  tyre.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.25, 16);
  rim.rotateZ(Math.PI / 2);
  const wheels = [];
  const frontPivots = [];
  for (const x of [-0.93, 0.93]) {
    for (const z of [1.42, -1.42]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.37, z);
      const t = new THREE.Mesh(tyre, rubber);
      const r = new THREE.Mesh(rim, chrome);
      pivot.add(t, r);
      car.add(pivot);
      wheels.push(pivot);
      if (z > 0) frontPivots.push(pivot);
      car.add(part(0.02, 0.12, 0.82, plastic, x * 1.003, 0.72, z)); // arch lip
    }
  }

  // --- lamps ---------------------------------------------------------------
  const headL = part(0.34, 0.16, 0.03, headLMat, 0.62, 0.9, 2.38);
  const headR = part(0.34, 0.16, 0.03, headRMat, -0.62, 0.9, 2.38);
  car.add(headL, headR);
  car.add(part(0.3, 0.26, 0.03, tailMat, 0.66, 1.0, -2.24));
  car.add(part(0.3, 0.26, 0.03, tailMat, -0.66, 1.0, -2.24));
  car.add(part(0.5, 0.12, 0.02, new THREE.MeshStandardMaterial({ color: 0xb9b19b, roughness: 0.8 }), 0, 0.6, -2.28));
  // hazard indicators: front corners and rear, one shared material so the
  // opening can blink all four together
  for (const [x, y, z] of [[0.95, 0.9, 2.3], [-0.95, 0.9, 2.3], [0.9, 1.0, -2.26], [-0.9, 1.0, -2.26]]) {
    car.add(part(0.14, 0.09, 0.05, amberMat, x, y, z));
  }

  // real headlight beams: two spots parented to the car, aimed down the road.
  // A 15 m low beam on a 0.42 rad cone that fades at the edges: the light has
  // to fall off along the tarmac rather than flood the forest, or the road
  // surface stops reading and the trees look lit by a campsite lantern.
  const spotL = new THREE.SpotLight(0xffe2b4, 42, 55, 0.42, 0.55, 1.35);
  const spotR = new THREE.SpotLight(0xffe2b4, 42, 55, 0.42, 0.55, 1.35);
  spotL.position.set(0.62, 0.95, 2.36);
  spotR.position.set(-0.62, 0.95, 2.36);
  spotL.target.position.set(0.9, -1.75, 15);
  spotR.target.position.set(-0.9, -1.75, 15);
  car.add(spotL, spotR, spotL.target, spotR.target);

  // --- bonnet: hinged at the windscreen end, closed until the story opens it
  const bonnet = new THREE.Group();
  bonnet.name = 'CarBonnet';
  bonnet.position.set(0, 1.16, 2.34);
  bonnet.add(part(1.72, 0.05, 1.05, paint, 0, 0, -0.52));
  car.add(bonnet);
  const stay = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), chrome);
  stay.position.set(0.6, 1.18, 1.95);
  stay.rotation.x = 0.5;
  stay.visible = false;
  car.add(stay);
  car.setBonnet = (open) => {
    bonnet.rotation.x = open ? -0.34 : 0;
    stay.visible = !!open;
  };

  // --- interior: what the driver actually sees from the seat ---------------
  const inX = (w, h, d, mat, x, y, z, rx) => car.add(part(w, h, d, mat, x, y, z, rx));
  // dashboard: a full-width shelf with a binnacle over the wheel
  inX(1.5, 0.12, 0.4, trim, 0, 1.04, 0.68);
  inX(0.52, 0.24, 0.2, trim, 0.42, 1.15, 0.6);
  inX(0.36, 0.12, 0.02, clusterMat, 0.42, 1.16, 0.51);         // lit cluster
  inX(0.06, 0.05, 0.02, warnMat, 0.56, 1.08, 0.51);            // warning lamp
  inX(0.22, 0.16, 0.18, trim, -0.05, 1.08, 0.52);              // centre stack
  // steering wheel (driver, +x) and column
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 6, 16), plastic);
  wheel.rotation.x = 1.12;
  wheel.position.set(0.42, 1.11, 0.44);
  car.add(wheel);
  inX(0.05, 0.05, 0.22, plastic, 0.42, 1.06, 0.56, 0.4);
  // console + gear lever
  inX(0.28, 0.2, 0.8, trim, -0.02, 1.0, 0.05);
  inX(0.03, 0.14, 0.03, plastic, -0.02, 1.14, 0.18);
  // seats: cushion, backrest, headrest — driver +x, passenger -x
  for (const x of [0.45, -0.45]) {
    inX(0.54, 0.14, 0.52, cloth, x, 1.05, -0.28);
    inX(0.54, 0.6, 0.13, cloth, x, 1.16, -0.56, 0.1);
    inX(0.28, 0.16, 0.1, cloth, x, 1.5, -0.6);
  }
  inX(1.42, 0.5, 0.5, cloth, 0, 1.05, -1.15);                  // rear bench
  // inner door card on the passenger side and the A-pillar trims
  inX(0.03, 0.42, 1.3, trim, -0.8, 0.92, -0.1);
  inX(0.05, 0.5, 0.07, trim, -0.74, 1.33, 0.84);
  inX(0.05, 0.5, 0.07, trim, 0.74, 1.33, 0.84);
  // headliner under the roof and the mirror
  inX(1.46, 0.03, 2.0, cloth, 0, 1.635, -0.3);
  inX(0.24, 0.06, 0.03, plastic, 0, 1.5, 0.7);
  // dash backlight: just enough to read the wheel and the stalks
  const dashLight = new THREE.PointLight(0xd9a441, 0.55, 1.6, 2);
  dashLight.position.set(0.35, 1.22, 0.55);
  car.add(dashLight);

  car.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = true;
    }
  });

  car.wheels = wheels;
  car.frontPivots = frontPivots;
  car.doorL = doorL;
  car.bonnet = bonnet;
  car.spotL = spotL;
  car.spotR = spotR;
  car.headLMat = headLMat;
  car.headRMat = headRMat;
  car.tailMat = tailMat;
  car.amberMat = amberMat;
  car.clusterMat = clusterMat;
  car.warnMat = warnMat;
  car.dashLight = dashLight;
  return car;
}
