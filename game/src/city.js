// Solmar City: a sun-soaked coastal city built from boxes, canvas textures and
// a few landmarks — a beach, a pier, a neon hotel row and a grid of streets.
// Everything the player can bump into is recorded in `colliders` (axis-aligned
// boxes) and `circleColliders` (palms, lamps), and `mapData` feeds the minimap.
import * as THREE from 'three';
import { CITY } from './config.js';

const STREET_COORDS = [-180, -120, -60, 0, 60, 120, 180];
const PALETTE = [0xe8b48a, 0xd9a05b, 0xc97b5a, 0x8fa3b8, 0x7fb3a3, 0xe0d3b8, 0xb98a6e, 0x9db4c6];
const NEON_WORDS = ['HOTEL', 'TACOS', 'CLUB NEON', '24H', 'SOLMAR', 'PIZZA', 'BAR', 'CASINO'];
const NEON_COLORS = [0xff2e88, 0x22d3ee, 0xfacc15, 0x4ade80, 0xff6b35];

// A facade texture: a warm wall with a grid of lit and dark windows.
function facadeTexture(random, base, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = random.next() < litRatio;
      ctx.fillStyle = lit ? '#ffe9a8' : '#20242e';
      ctx.fillRect(10 + col * 19, 12 + row * 20, 12, 13);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A glowing shop sign with one word on it.
function neonTexture(word, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111118';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = `#${color.toString(16).padStart(6, '0')}`;
  ctx.shadowBlur = 18;
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillText(word, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePalm(random) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5, 6), trunkMat);
  trunk.position.y = 2.5;
  trunk.rotation.z = random.range(-0.08, 0.08);
  group.add(trunk);
  for (let i = 0; i < 8; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.4, 4), leafMat);
    const angle = (i / 8) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.9, 5.1, Math.sin(angle) * 0.9);
    leaf.rotation.z = Math.cos(angle) * 1.25;
    leaf.rotation.x = -Math.sin(angle) * 1.25;
    leaf.scale.set(1, 1, 0.22);
    group.add(leaf);
  }
  return group;
}

export function buildCity(scene, random) {
  const colliders = [];
  const circleColliders = [];
  const mapData = { streets: STREET_COORDS, buildings: [], beachZ: CITY.beachZ, oceanZ: CITY.oceanZ };

  // Warm late-afternoon light and a hazy sky.
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3dd, 120, 420);
  const sun = new THREE.DirectionalLight(0xffe3b3, 2.4);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -240;
  sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240;
  sun.shadow.camera.bottom = -240;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6b4a, 0.9));

  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9a9a8a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  // Sand, then the ocean.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 60),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, CITY.beachZ + 5);
  sand.receiveShadow = true;
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 300),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CITY.oceanZ + 130);
  scene.add(ocean);

  // Roads: asphalt strips with pale sidewalks on each side.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d90a });
  for (const c of STREET_COORDS) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(440, CITY.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.rotation.z = Math.PI / 2;
      road.position.set(horizontal ? c : 0, 0, horizontal ? 0 : c);
      road.receiveShadow = true;
      scene.add(road);
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(440, 3), walkMat);
        walk.rotation.x = -Math.PI / 2;
        if (horizontal) walk.rotation.z = Math.PI / 2;
        walk.position.set(
          horizontal ? c + side * (CITY.roadWidth / 2 + 1.5) : 0,
          0.02,
          horizontal ? 0 : c + side * (CITY.roadWidth / 2 + 1.5),
        );
        scene.add(walk);
      }
      // Dashed centre line.
      for (let t = -200; t <= 200; t += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        if (horizontal) dash.rotation.z = Math.PI / 2;
        dash.position.set(horizontal ? c : t, 0.03, horizontal ? t : c);
        scene.add(dash);
      }
    }
  }

  // Buildings fill every block between the streets.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b5d4f });
  const facades = PALETTE.map((color) =>
    facadeTexture(random, `#${color.toString(16).padStart(6, '0')}`, 0.35),
  );
  const facadeMats = facades.map(
    (map) => new THREE.MeshLambertMaterial({ map }),
  );
  for (let bx = 0; bx < STREET_COORDS.length - 1; bx += 1) {
    for (let bz = 0; bz < STREET_COORDS.length - 1; bz += 1) {
      const cx = (STREET_COORDS[bx] + STREET_COORDS[bx + 1]) / 2;
      const cz = (STREET_COORDS[bz] + STREET_COORDS[bz + 1]) / 2;
      const lots = random.int(1, 3);
      for (let lot = 0; lot < lots; lot += 1) {
        // Keep every lot inside its block, clear of the roads and sidewalks:
        // the block between two streets spans 7.5 to 52.5 from its centre.
        const w = random.range(12, 20);
        const d = random.range(12, 20);
        const h = random.range(8, 46);
        const x = cx + random.range(-6, 6);
        const z = cz + random.range(-6, 6);
        const mat = facadeMats[Math.floor(random.next() * facadeMats.length)];
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        mapData.buildings.push({ x, z, w, d });
        // A neon sign on the street-facing side of some buildings.
        if (random.next() < 0.4) {
          const word = random.pick(NEON_WORDS);
          const color = random.pick(NEON_COLORS);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(9, 2.2),
            new THREE.MeshBasicMaterial({ map: neonTexture(word, color) }),
          );
          sign.position.set(x, Math.min(h - 2, 12), z + d / 2 + 0.15);
          scene.add(sign);
        }
      }
    }
  }

  // The Solmar Grand hotel tower, the skyline's landmark, at the beach end of the
  // main avenue, with a big glowing sign.
  const tower = new THREE.Mesh(boxGeo, facadeMats[3]);
  tower.scale.set(30, 78, 24);
  tower.position.set(0, 39, 205);
  tower.castShadow = true;
  scene.add(tower);
  colliders.push({ minX: -15, maxX: 15, minZ: 193, maxZ: 217 });
  mapData.buildings.push({ x: 0, z: 205, w: 30, d: 24 });
  const towerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 5),
    new THREE.MeshBasicMaterial({ map: neonTexture('SOLMAR', 0xff2e88) }),
  );
  towerSign.position.set(0, 70, 217.3);
  scene.add(towerSign);

  // A wooden pier reaching into the ocean.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 60), pierMat);
  pier.position.set(-60, 0.6, CITY.beachZ + 35);
  pier.castShadow = true;
  scene.add(pier);
  colliders.push({ minX: -64, maxX: -56, minZ: CITY.beachZ + 5, maxZ: CITY.beachZ + 65 });

  // Palms along the beach and the main avenue.
  for (let x = -200; x <= 200; x += 25) {
    const palm = makePalm(random);
    palm.position.set(x + random.range(-3, 3), 0, CITY.beachZ - 6);
    scene.add(palm);
    circleColliders.push({ x: palm.position.x, z: palm.position.z, r: 0.6 });
  }
  for (let z = -180; z <= 180; z += 60) {
    for (const side of [-1, 1]) {
      if (random.next() < 0.6) {
        const palm = makePalm(random);
        palm.position.set(side * 10, 0, z + random.range(-8, 8));
        scene.add(palm);
        circleColliders.push({ x: palm.position.x, z: palm.position.z, r: 0.6 });
      }
    }
  }

  // Street lamps at every intersection.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of STREET_COORDS) {
    for (const z of STREET_COORDS) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(x + 8, 3, z + 8);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(x + 8, 6.2, z + 8);
      scene.add(lamp);
      circleColliders.push({ x: x + 8, z: z + 8, r: 0.3 });
    }
  }

  // Puffy clouds drifting over the city.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 10; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(random.range(6, 12), 8, 6), cloudMat);
      puff.position.set(j * 8 - 12 + random.range(-3, 3), random.range(-1, 1), random.range(-3, 3));
      puff.scale.y = 0.5;
      cloud.add(puff);
    }
    cloud.position.set(random.range(-260, 260), random.range(70, 110), random.range(-260, 260));
    scene.add(cloud);
  }

  return { colliders, circleColliders, mapData };
}
