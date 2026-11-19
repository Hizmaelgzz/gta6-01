// The wanted system and the Solmar PD: stars rise with crimes, police cruisers
// spawn at the edge of view and chase the player, ramming the car or running
// the player down on foot. Lose them, and the heat cools off star by star.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';
import { collideBuildings } from './player.js';
import { WANTED } from './config.js';

export function createPolice(scene) {
  let stars = 0;
  let quietTimer = 0;
  let bustTimer = 0;
  const cruisers = [];

  function spawnCruiser(playerPos, random) {
    const angle = random.range(0, Math.PI * 2);
    const x = playerPos.x + Math.cos(angle) * 70;
    const z = playerPos.z + Math.sin(angle) * 70;
    const mesh = createCarMesh('police');
    mesh.position.set(Math.max(-200, Math.min(200, x)), 0, Math.max(-200, Math.min(200, z)));
    scene.add(mesh);
    const cruiser = { mesh, speed: 0, maxSpeed: 26 };
    cruisers.push(cruiser);
    return cruiser;
  }

  function setStars(next, audio) {
    const clamped = Math.max(0, Math.min(5, next));
    if (clamped > stars && audio) audio.wantedUp();
    stars = clamped;
    if (stars === 0) {
      for (const cruiser of cruisers) scene.remove(cruiser.mesh);
      cruisers.length = 0;
    }
    quietTimer = 0;
  }

  return {
    get stars() {
      return stars;
    },
    get cruisers() {
      return cruisers;
    },
    addStars(count, audio) {
      setStars(stars + count, audio);
    },
    clearStars() {
      setStars(0, null);
    },
    // Called every frame: keep the right number of cruisers and steer them.
    // colliders keeps them on the roads instead of phasing through buildings.
    update(dt, playerPos, playerSpeed, inCar, random, onBusted, colliders) {
      const wanted = WANTED.carsPerStar[stars];
      while (cruisers.length < wanted) spawnCruiser(playerPos, random);
      while (cruisers.length > wanted) {
        const cruiser = cruisers.pop();
        scene.remove(cruiser.mesh);
      }
      let nearest = Infinity;
      for (const cruiser of cruisers) {
        const dx = playerPos.x - cruiser.mesh.position.x;
        const dz = playerPos.z - cruiser.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        // The model's nose is +x, so the heading that points at the player is
        // atan2(-dz, dx); turn toward it smoothly instead of snapping.
        const desired = Math.atan2(-dz, dx);
        let diff = desired - cruiser.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cruiser.mesh.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        // Chase hard from afar, but pace the player up close: bump, don't
        // shove them across the city.
        let targetSpeed = dist > 6 ? cruiser.maxSpeed + stars * 1.5 : 6;
        if (dist < 5) targetSpeed = Math.min(targetSpeed, playerSpeed + 3);
        cruiser.speed += Math.max(-20 * dt, Math.min(14 * dt, targetSpeed - cruiser.speed));
        const nx = cruiser.mesh.position.x + Math.cos(cruiser.mesh.rotation.y) * cruiser.speed * dt;
        const nz = cruiser.mesh.position.z + -Math.sin(cruiser.mesh.rotation.y) * cruiser.speed * dt;
        const fixed = colliders ? collideBuildings(nx, nz, 2.3, colliders) : { x: nx, z: nz };
        if (Math.hypot(fixed.x - nx, fixed.z - nz) > 0.05) cruiser.speed *= 0.5;
        cruiser.mesh.position.x = fixed.x;
        cruiser.mesh.position.z = fixed.z;
      }
      // Busted: on foot, a cruiser sitting on the player holds them.
      if (!inCar && nearest < WANTED.bustDistance && stars > 0) {
        bustTimer += dt;
        if (bustTimer > WANTED.bustHoldSeconds) {
          bustTimer = 0;
          onBusted();
        }
      } else {
        bustTimer = 0;
      }
      // Cooling off: no cops near and no fresh crime for a while.
      if (stars > 0 && nearest > 60) {
        quietTimer += dt;
        if (quietTimer > WANTED.coolDown) setStars(stars - 1, null);
      } else {
        quietTimer = 0;
      }
      return nearest;
    },
  };
}

// A flashing light bar glow above a cruiser, for the screenshots and the chase.
export function policeLightPosition(cruiser) {
  return new THREE.Vector3(cruiser.mesh.position.x, 1.4, cruiser.mesh.position.z);
}
