// Cars: box-built models (sedan, taxi, sports car, van, police cruiser) and the
// traffic that drives them around the street grid, turning at intersections
// and braking for the car ahead.
import * as THREE from 'three';
import { CAR, TRAFFIC } from './config.js';

const CAR_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad, 0xe67e22, 0x7f8c8d, 0x2c3e50, 0xd4ac0d, 0xeeeeee];
const WHEEL_GEO = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x141414 });
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
const TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xff2222 });

export function createCarMesh(type = 'sedan', color = null) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({
    color: type === 'taxi' ? 0xf1c40f : type === 'police' ? 0x1c1c22 : color ?? 0xc0392b,
  });
  const isSports = type === 'sports';
  const isVan = type === 'van';
  const length = isVan ? 5.2 : isSports ? 4.2 : 4.4;
  const bodyH = isSports ? 0.55 : isVan ? 1.1 : 0.75;
  const bodyY = isSports ? 0.45 : 0.65;
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, bodyH, 2), paint);
  body.position.y = bodyY;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(isVan ? 3.4 : 2.2, isSports ? 0.45 : 0.6, 1.8),
    isVan ? paint : GLASS_MAT,
  );
  cabin.position.set(isVan ? -0.3 : -0.2, bodyY + bodyH / 2 + (isSports ? 0.22 : 0.3), 0);
  cabin.castShadow = true;
  group.add(cabin);
  for (const [wx, wz] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx * (length / 4.4), 0.38, wz);
    group.add(wheel);
  }
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.4), LIGHT_MAT);
    head.position.set(length / 2 + 0.02, 0.6, side * 0.6);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.4), TAIL_MAT);
    tail.position.set(-length / 2 - 0.02, 0.6, side * 0.6);
    group.add(tail);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x111111 }),
    );
    sign.position.set(-0.2, bodyY + bodyH / 2 + 0.75, 0);
    group.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.2), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(-0.2, bodyY + bodyH / 2 + 0.68, 0);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(-0.2, bodyY + bodyH / 2 + 0.68, 0.55);
    group.add(bar2);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    door.position.set(0.1, 0.65, 1.01);
    group.add(door);
    const door2 = door.clone();
    door2.position.z = -1.01;
    door2.rotation.y = Math.PI;
    group.add(door2);
  }
  group.userData.length = length;
  return group;
}

const STREETS = [-180, -120, -60, 0, 60, 120, 180];

// One traffic car: which street it is on, which way it drives, how fast.
// avoidSpots are (x, z) points it must not spawn on top of (parked cars).
function spawnTrafficCar(scene, random, avoidSpots) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const horizontal = random.next() < 0.5;
    const street = random.pick(STREETS);
    const dir = random.next() < 0.5 ? 1 : -1;
    const t = random.range(-200, 200);
    const x = horizontal ? t : street + dir * 3;
    const z = horizontal ? street + dir * 3 : t;
    if (avoidSpots.some((s) => Math.hypot(s.x - x, s.z - z) < 9)) continue;
    const type = random.next() < 0.12 ? 'taxi' : random.next() < 0.1 ? 'van' : 'sedan';
    const mesh = createCarMesh(type, random.pick(CAR_COLORS));
    mesh.position.set(x, 0, z);
    // The model's nose points along +x, so forward is (cos ry, 0, -sin ry).
    mesh.rotation.y = horizontal ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(mesh);
    return {
      mesh,
      horizontal,
      street,
      dir,
      speed: TRAFFIC.speed * random.range(0.7, 1.15),
      along: t,
    };
  }
  // Every spot tried was taken: spawn anyway at the last one.
  const horizontal = random.next() < 0.5;
  const street = random.pick(STREETS);
  const dir = random.next() < 0.5 ? 1 : -1;
  const type = random.next() < 0.12 ? 'taxi' : random.next() < 0.1 ? 'van' : 'sedan';
  const mesh = createCarMesh(type, random.pick(CAR_COLORS));
  const t = random.range(-200, 200);
  mesh.position.set(horizontal ? t : street + dir * 3, 0, horizontal ? street + dir * 3 : t);
  mesh.rotation.y = horizontal ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  scene.add(mesh);
  return { mesh, horizontal, street, dir, speed: TRAFFIC.speed, along: t };
}

export function createTraffic(scene, random, avoidSpots = []) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) cars.push(spawnTrafficCar(scene, random, avoidSpots));

  function carAhead(car, others) {
    // Model forward is +x rotated by rotation.y: (cos ry, 0, -sin ry).
    const forward = new THREE.Vector3(Math.cos(car.mesh.rotation.y), 0, -Math.sin(car.mesh.rotation.y));
    for (const other of others) {
      if (other === car) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 9 && dist > 0.01) {
        const dot = (dx * forward.x + dz * forward.z) / dist;
        if (dot > 0.85) return true;
      }
    }
    return false;
  }

  return {
    cars,
    // Take a car out of traffic (the player just stole it); a fresh one
    // drives in from the edge so the streets never empty out.
    remove(car) {
      const index = cars.indexOf(car);
      if (index !== -1) cars.splice(index, 1);
    },
    // staticCars are meshes that never move (parked cars): traffic brakes
    // for them instead of driving through them.
    update(dt, playerCar, staticCars = []) {
      while (cars.length < TRAFFIC.count) cars.push(spawnTrafficCar(scene, random, avoidSpots));
      const statics = staticCars.map((mesh) => ({ mesh }));
      for (const car of cars) {
        // Brake for the car ahead, for a parked car, or for the player's car.
        const blocked = carAhead(car, cars) || carAhead(car, statics) || (playerCar && carAhead(car, [playerCar]));
        const speed = blocked ? 0 : car.speed;
        const step = speed * dt;
        if (car.horizontal) car.mesh.position.x += car.dir * step;
        else car.mesh.position.z += car.dir * step;
        // Ease back to the centre of the lane after any shove.
        const lane = car.street + car.dir * 3;
        if (car.horizontal) car.mesh.position.z += (lane - car.mesh.position.z) * Math.min(1, dt * 1.5);
        else car.mesh.position.x += (lane - car.mesh.position.x) * Math.min(1, dt * 1.5);
        // At an intersection, sometimes turn onto the cross street.
        const nearStreet = STREETS.find((s) => Math.abs((car.horizontal ? car.mesh.position.z : car.mesh.position.x) - s) < 1.5);
        const cross = car.horizontal ? car.mesh.position.x : car.mesh.position.z;
        const atCross = STREETS.some((s) => Math.abs(cross - s) < 2.5);
        if (nearStreet !== undefined && atCross && random.next() < 0.008) {
          const turn = random.pick([-1, 1]);
          const newStreet = car.horizontal ? car.mesh.position.x : car.mesh.position.z;
          const snapped = STREETS.reduce((best, s) => (Math.abs(s - newStreet) < Math.abs(best - newStreet) ? s : best), STREETS[0]);
          car.horizontal = !car.horizontal;
          car.dir = turn;
          car.street = snapped;
          if (car.horizontal) {
            car.mesh.position.z = snapped + turn * 3;
            car.mesh.rotation.y = turn > 0 ? 0 : Math.PI;
          } else {
            car.mesh.position.x = snapped + turn * 3;
            car.mesh.rotation.y = turn > 0 ? -Math.PI / 2 : Math.PI / 2;
          }
        }
        // Past the city edge: respawn on the far side so traffic never runs out.
        const pos = car.horizontal ? car.mesh.position.x : car.mesh.position.z;
        if (Math.abs(pos) > 215) {
          scene.remove(car.mesh);
          const fresh = spawnTrafficCar(scene, random, avoidSpots);
          Object.assign(car, fresh);
        }
      }
    },
  };
}

// A parked car the player can steal, sitting still until taken.
export function createParkedCar(scene, x, z, angle, type, color) {
  const mesh = createCarMesh(type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  scene.add(mesh);
  return { mesh, x, z, angle, type, stolen: false };
}

export { CAR };
