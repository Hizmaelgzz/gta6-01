// Pedestrians: simple people who stroll the sidewalks, cross at corners and run
// when they hear a gunshot or a car bears down on them.
import * as THREE from 'three';
import { PEDS } from './config.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xfd79a8];
const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const STREETS = [-180, -120, -60, 0, 60, 120, 180];

function createPedMesh(random) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: random.pick(SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: random.pick(SKIN_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: random.pick([0x2c3e50, 0x34495e, 0x5d4037]) });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.28), pants);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  return group;
}

function randomSidewalkSpot(random) {
  const street = random.pick(STREETS);
  const along = random.range(-200, 200);
  const side = random.pick([-1, 1]) * 8.5;
  return random.next() < 0.5
    ? { x: along, z: street + side }
    : { x: street + side, z: along };
}

export function createPedestrians(scene, random) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const mesh = createPedMesh(random);
    const spot = randomSidewalkSpot(random);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = random.range(0, Math.PI * 2);
    scene.add(mesh);
    peds.push({
      mesh,
      heading: random.range(0, Math.PI * 2),
      speed: PEDS.walkSpeed * random.range(0.7, 1.3),
      fleeing: false,
      retarget: random.range(2, 8),
    });
  }

  return {
    peds,
    // A pedestrian is down: tip them over and stop them walking. They stay
    // where they fell, as a reminder.
    kill(ped) {
      if (ped.dead) return;
      ped.dead = true;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.35;
    },
    // A scare at (x, z) sends nearby pedestrians running away from it.
    scare(x, z, radius) {
      for (const ped of peds) {
        const dx = ped.mesh.position.x - x;
        const dz = ped.mesh.position.z - z;
        if (Math.hypot(dx, dz) < radius) {
          ped.fleeing = true;
          ped.heading = Math.atan2(dx, dz);
        }
      }
    },
    update(dt, playerPos) {
      for (const ped of peds) {
        if (ped.dead) continue;
        ped.retarget -= dt;
        // A fast car close by is scary too.
        const dxp = ped.mesh.position.x - playerPos.x;
        const dzp = ped.mesh.position.z - playerPos.z;
        const nearPlayer = Math.hypot(dxp, dzp) < 6;
        const speed = ped.fleeing || nearPlayer ? PEDS.fleeSpeed : ped.speed;
        if (ped.retarget <= 0) {
          ped.retarget = random.range(3, 9);
          if (!ped.fleeing) ped.heading = random.range(0, Math.PI * 2);
        }
        ped.mesh.position.x += Math.sin(ped.heading) * speed * dt;
        ped.mesh.position.z += Math.cos(ped.heading) * speed * dt;
        ped.mesh.rotation.y = ped.heading;
        // A little bob while walking.
        ped.mesh.position.y = Math.abs(Math.sin(performance.now() / 130 + ped.heading * 7)) * 0.05;
        // Stay inside the city; turn around at the edge.
        if (Math.abs(ped.mesh.position.x) > 205 || Math.abs(ped.mesh.position.z) > 205 || ped.mesh.position.z > 232) {
          ped.heading += Math.PI;
          ped.retarget = random.range(2, 5);
        }
        if (ped.fleeing && Math.hypot(dxp, dzp) > 40) ped.fleeing = false;
      }
    },
  };
}
