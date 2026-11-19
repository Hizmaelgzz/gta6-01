// The player: Danny Cole on foot and behind the wheel. Arcade car physics
// (speed, steering that bites harder at low speed, handbrake slides), building
// and car collision as circle tests, and combat — a punch up close and a pistol
// fired through the crosshair.
import * as THREE from 'three';
import { CAR, PLAYER } from './config.js';
import { createCarMesh } from './vehicles.js';

function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.8, 0.3), jeans);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), jacket);
  torso.position.y = 1.16;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.74;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 1.94;
  group.add(cap);
  return group;
}

// Push a circle (x, z, radius) out of every building box it overlaps.
export function collideBuildings(x, z, radius, colliders) {
  let px = x;
  let pz = z;
  for (const box of colliders) {
    const cx = Math.max(box.minX, Math.min(px, box.maxX));
    const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        px = cx + (dx / dist) * radius;
        pz = cz + (dz / dist) * radius;
      } else {
        pz = box.maxZ + radius;
      }
    }
  }
  return { x: px, z: pz };
}

// Push a circle out of every small round obstacle (palms, lamps).
export function collideCircles(x, z, radius, circles) {
  let px = x;
  let pz = z;
  for (const c of circles) {
    const dx = px - c.x;
    const dz = pz - c.z;
    const dist = Math.hypot(dx, dz);
    const min = radius + c.r;
    if (dist < min && dist > 0.0001) {
      px = c.x + (dx / dist) * min;
      pz = c.z + (dz / dist) * min;
    }
  }
  return { x: px, z: pz };
}

// Tiny hit sparks: a few glowing tetrahedra that fly out and fade.
export function createEffects(scene) {
  const bursts = [];
  const geo = new THREE.TetrahedronGeometry(0.16);
  return {
    burst(x, y, z, color) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      for (let i = 0; i < 6; i += 1) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        bursts.push({ mesh, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5 + 1, vz: (Math.random() - 0.5) * 6, life: 0.5 });
      }
    },
    update(dt) {
      for (let i = bursts.length - 1; i >= 0; i -= 1) {
        const b = bursts[i];
        b.life -= dt;
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.y += b.vy * dt;
        b.mesh.position.z += b.vz * dt;
        b.vy -= 12 * dt;
        b.mesh.material.opacity = Math.max(0, b.life * 2);
        if (b.life <= 0) {
          scene.remove(b.mesh);
          bursts.splice(i, 1);
        }
      }
    },
  };
}

export function createPlayer(scene, startX, startZ) {
  const mesh = createPlayerMesh();
  mesh.position.set(startX, 0, startZ);
  scene.add(mesh);
  const raycaster = new THREE.Raycaster();

  const state = {
    mesh,
    x: startX,
    z: startZ,
    heading: 0,
    health: PLAYER.maxHealth,
    money: 0,
    inCar: false,
    car: null, // { mesh, speed, heading, type }
    fireCooldown: 0,
    lastDamageAt: -10,
  };

  function damage(amount, now) {
    state.health = Math.max(0, state.health - amount);
    state.lastDamageAt = now;
  }

  function enterCar(carObj, onSteal) {
    state.inCar = true;
    state.car = carObj;
    mesh.visible = false;
    if (onSteal) onSteal(carObj);
  }

  function exitCar() {
    if (!state.car) return;
    const side = state.car.heading + Math.PI / 2;
    state.x = state.car.mesh.position.x + Math.cos(side) * 2.5;
    state.z = state.car.mesh.position.z - Math.sin(side) * 2.5;
    state.heading = state.car.heading;
    mesh.position.set(state.x, 0, state.z);
    mesh.visible = true;
    state.inCar = false;
    state.car = null;
  }

  // Drive the current car: W/S speed, A/D steering, Space handbrake.
  function drive(dt, input, world, now) {
    const car = state.car;
    const forward = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    if (forward) car.speed += CAR.accel * dt;
    if (back) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
    if (!forward && !back) car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.2 && !forward && !back) car.speed = 0;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerAuthority = 1 - Math.min(0.65, Math.abs(car.speed) / CAR.maxSpeed * 0.65);
    car.heading += steerInput * CAR.steer * steerAuthority * Math.sign(car.speed || 1) * dt * (input.handbrake ? 1.6 : 1);
    const nx = car.mesh.position.x + Math.cos(car.heading) * car.speed * dt;
    const nz = car.mesh.position.z + -Math.sin(car.heading) * car.speed * dt;
    const speedBefore = Math.abs(car.speed);
    const fixed = collideBuildings(nx, nz, CAR.radius, world.colliders);
    const fixed2 = collideCircles(fixed.x, fixed.z, CAR.radius, world.circleColliders);
    // The map edge: soft-clamp the car inside the city and the beach.
    const clampedX = Math.max(-212, Math.min(212, fixed2.x));
    const clampedZ = Math.max(-212, Math.min(255, fixed2.z));
    const hitEdge = clampedX !== fixed2.x || clampedZ !== fixed2.z;
    const hitWall = Math.hypot(fixed2.x - nx, fixed2.z - nz) > 0.05;
    car.mesh.position.x = clampedX;
    car.mesh.position.z = clampedZ;
    if (hitEdge) car.speed *= 0.6;
    if (hitWall && speedBefore > 8) {
      car.speed *= 0.45;
      damage(Math.min(18, speedBefore * 0.5), now);
      world.audio.crash(Math.min(1, speedBefore / 30));
      world.effects.burst(fixed2.x, 1, fixed2.z, 0xffcc00);
    } else if (hitWall) {
      car.speed *= 0.7;
    }
    // Bump into traffic, parked cars and police cruisers.
    for (const other of world.carObstacles) {
      if (other.mesh === car.mesh) continue;
      const dx = car.mesh.position.x - other.mesh.position.x;
      const dz = car.mesh.position.z - other.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < CAR.radius + 2.2 && dist > 0.01) {
        // Separate the two cars: the player takes a third of the push, the
        // other car two thirds, capped per step so a deep overlap does not
        // fling either car across the street.
        const overlap = CAR.radius + 2.2 - dist;
        const step = Math.min(0.5, overlap * 0.5);
        const nx2 = dx / dist;
        const nz2 = dz / dist;
        car.mesh.position.x += nx2 * step * 0.3;
        car.mesh.position.z += nz2 * step * 0.3;
        if (other.push) other.push(-nx2 * step * 0.7, -nz2 * step * 0.7);
        if (Math.abs(car.speed) > 15) {
          car.speed *= 0.8;
          damage(6, now);
          world.audio.crash(0.4);
        } else if (Math.abs(car.speed) > 3) {
          // A slow nudge, not a stop: the car can push through a jam.
          car.speed *= 0.95;
        }
      }
    }
    car.mesh.rotation.y = car.heading;
    // A fast car near a pedestrian scares them (and hitting one is a crime).
    for (const ped of world.peds.peds) {
      const dx = ped.mesh.position.x - car.mesh.position.x;
      const dz = ped.mesh.position.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3 && Math.abs(car.speed) > 4) {
        world.onHitPedestrian(ped);
      } else if (dist < 8 && Math.abs(car.speed) > 12) {
        world.peds.scare(car.mesh.position.x, car.mesh.position.z, 10);
      }
    }
    state.x = car.mesh.position.x;
    state.z = car.mesh.position.z;
  }

  function walk(dt, input, world, now) {
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (f !== 0 || s !== 0) {
      // Camera forward on the ground is (sin yaw, cos yaw); screen-right is
      // its mirror, so strafe subtracts the angle.
      const moveAngle = world.cameraYaw - Math.atan2(s, f);
      const nx = state.x + Math.sin(moveAngle) * speed * dt;
      const nz = state.z + Math.cos(moveAngle) * speed * dt;
      const fixed = collideBuildings(nx, nz, PLAYER.radius, world.colliders);
      const fixed2 = collideCircles(fixed.x, fixed.z, PLAYER.radius, world.circleColliders);
      state.x = Math.max(-208, Math.min(208, fixed2.x));
      state.z = Math.max(-208, Math.min(255, fixed2.z));
      state.heading = moveAngle;
      mesh.position.set(state.x, 0, state.z);
      mesh.rotation.y = state.heading;
    }
  }

  function punch(world) {
    let best = null;
    let bestDist = PLAYER.punchRange;
    for (const target of world.punchTargets) {
      const dx = target.mesh.position.x - state.x;
      const dz = target.mesh.position.z - state.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) {
        best = target;
        bestDist = dist;
      }
    }
    if (best) {
      world.audio.punch();
      best.onHit(PLAYER.punchDamage);
      world.effects.burst(best.mesh.position.x, 1.4, best.mesh.position.z, 0xffffff);
    } else {
      world.audio.punch();
    }
  }

  function shoot(camera, world) {
    if (state.fireCooldown > 0) return;
    state.fireCooldown = PLAYER.fireInterval;
    world.audio.gunshot();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = PLAYER.pistolRange;
    const meshes = world.shootTargets.map((t) => t.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && !world.shootTargets.some((t) => t.mesh === obj)) obj = obj.parent;
      const target = world.shootTargets.find((t) => t.mesh === obj);
      if (target) {
        target.onHit(PLAYER.pistolDamage);
        world.effects.burst(hits[0].point.x, hits[0].point.y, hits[0].point.z, 0xff4444);
        return;
      }
    }
    // A miss still kicks up a spark where the shot lands.
    const end = raycaster.ray.at(PLAYER.pistolRange, new THREE.Vector3());
    world.effects.burst(end.x, Math.max(0.2, end.y), end.z, 0xaaaaaa);
  }

  return {
    state,
    mesh,
    damage,
    enterCar,
    exitCar,
    get position() {
      return { x: state.x, z: state.z };
    },
    get speed() {
      return state.inCar ? Math.abs(state.car.speed) : 0;
    },
    update(dt, input, world, now, camera) {
      state.fireCooldown = Math.max(0, state.fireCooldown - dt);
      // Slow health regen out of trouble.
      if (now - state.lastDamageAt > 8 && state.health > 0 && state.health < PLAYER.maxHealth) {
        state.health = Math.min(PLAYER.maxHealth, state.health + 2 * dt);
      }
      if (state.inCar) drive(dt, input, world, now);
      else walk(dt, input, world, now);
      if (input.punch && !state.inCar) {
        input.punch = false;
        punch(world);
      }
      if (input.shoot && !state.inCar) {
        input.shoot = false;
        shoot(camera, world);
      }
    },
  };
}

// The player's own car object, for a car the player drives (a stolen traffic
// car, a parked car, or the starter sedan).
export function wrapPlayerCar(mesh, type) {
  return { mesh, speed: 0, heading: mesh.rotation.y, type, push: null };
}
export { createCarMesh };
