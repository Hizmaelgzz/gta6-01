// Missions and side work in Solmar: a five-job story for Danny Cole — a fare, a
// package, a stolen sports car, a payback and a timed getaway — plus taxi fares
// that keep appearing and cash and health pickups scattered around the city.
// A glowing beacon marks the current objective; the HUD reads it from here.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { createParkedCar } from './vehicles.js';

const STORY = [
  {
    id: 'fare',
    title: 'First Fare',
    briefing: 'Marina needs a driver. Get in a car, pick up the fare at the yellow marker, and drop them at the hotel.',
  },
  {
    id: 'package',
    title: 'The Package',
    briefing: 'A package is waiting in the alley. Pick it up on foot, then drive it to the drop-off across town.',
  },
  {
    id: 'steal',
    title: 'Hot Wheels',
    briefing: 'A yellow Comet GT is parked on the east avenue. Steal it and bring it to the garage — the cops will notice.',
  },
  {
    id: 'payback',
    title: 'Payback',
    briefing: 'The Vultures jumped Marina’s courier. Go to the alley and settle it. They shoot back.',
  },
  {
    id: 'score',
    title: 'The Big Score',
    briefing: 'One last run: get to the pier in 100 seconds with the whole PD on you. Make it and you’re made in Solmar.',
  },
];

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  group.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
  );
  diamond.position.y = 6;
  group.add(diamond);
  group.userData.diamond = diamond;
  scene.add(group);
  return group;
}

function makePickupMesh(scene, x, z, color) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.12, 16),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, 1, z);
  scene.add(mesh);
  return mesh;
}

function makeRival(scene, x, z) {
  const group = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.8, 0.3), dark);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), new THREE.MeshLambertMaterial({ color: 0x7b1f1f }));
  torso.position.y = 1.16;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.74;
  group.add(head);
  group.position.set(x, 0, z);
  scene.add(group);
  return { mesh: group, health: 100, shootTimer: 1 + Math.random(), alive: true };
}

export function createMissions(scene, random, hooks) {
  const beacon = makeBeacon(scene);
  const taxiBeacon = makeBeacon(scene);
  taxiBeacon.children[0].material = taxiBeacon.children[0].material.clone();
  taxiBeacon.children[0].material.color.set(0x4ade80);
  taxiBeacon.children[1].material = taxiBeacon.children[1].material.clone();
  taxiBeacon.children[1].material.color.set(0x4ade80);

  let missionIndex = 0;
  let step = 0;
  let objective = STORY[0].briefing;
  let storyDone = false;
  let finaleTimer = 0;
  let passenger = null;
  let sportsCar = null;
  let rivals = [];
  let taxi = { state: 'idle', timer: 8, pickup: null, dropoff: null, passenger: null };

  // The sports car for Hot Wheels, parked on the east avenue.
  sportsCar = createParkedCar(scene, 186, 6, Math.PI / 2, 'sports', 0xf1c40f);

  // Cash and health pickups around the city.
  const pickups = [];
  for (let i = 0; i < MISSIONS.cashPickupCount; i += 1) {
    const x = random.range(-190, 190);
    const z = random.range(-190, 200);
    pickups.push({ mesh: makePickupMesh(scene, x, z, 0xfacc15), x, z, kind: 'cash', taken: false });
  }
  for (let i = 0; i < 3; i += 1) {
    const x = random.range(-190, 190);
    const z = random.range(-190, 200);
    pickups.push({ mesh: makePickupMesh(scene, x, z, 0x4ade80), x, z, kind: 'health', taken: false });
  }

  function setObjective(text) {
    objective = text;
    hooks.onObjective(text);
  }

  function completeMission() {
    const mission = STORY[missionIndex];
    const rewards = { fare: MISSIONS.taxiReward, package: MISSIONS.packageReward, steal: MISSIONS.stealReward, payback: MISSIONS.paybackReward, score: MISSIONS.finaleReward };
    const reward = rewards[mission.id] ?? 100;
    hooks.addMoney(reward);
    hooks.audio.missionComplete();
    hooks.onMessage(`Mission complete: ${mission.title} — +$${reward}`);
    missionIndex += 1;
    step = 0;
    if (missionIndex >= STORY.length) {
      storyDone = true;
      setObjective('Story complete — Solmar is yours. Take taxi fares or explore the city.');
      hooks.onMessage('STORY COMPLETE — You are a made driver in Solmar City.');
      hooks.onStoryComplete();
    } else {
      setObjective(STORY[missionIndex].briefing);
    }
  }

  function failMission(reason) {
    hooks.audio.missionFailed();
    hooks.onMessage(`Mission failed: ${reason} — try again.`);
    step = 0;
    setObjective(STORY[missionIndex].briefing);
  }

  function spawnRivals() {
    for (const [x, z] of [[-126, -114], [-114, -126], [-126, -126], [-114, -114]]) {
      rivals.push(makeRival(scene, x, z));
    }
  }

  function clearRivals() {
    for (const rival of rivals) scene.remove(rival.mesh);
    rivals = [];
  }

  function near(px, pz, x, z, dist) {
    return Math.hypot(px - x, pz - z) < dist;
  }

  // Where the beacon should stand for the current step.
  function markerForStep() {
    const m = STORY[missionIndex];
    if (!m) return null;
    if (m.id === 'fare') return step === 0 ? null : step === 1 ? { x: 60, z: -54 } : { x: -120, z: 126 };
    if (m.id === 'package') return step === 0 ? { x: -54, z: 60 } : { x: 126, z: -120 };
    if (m.id === 'steal') return step === 0 ? { x: 186, z: 6 } : { x: -180, z: 186 };
    if (m.id === 'payback') return { x: -120, z: -120 };
    if (m.id === 'score') return { x: -60, z: 245 };
    return null;
  }

  return {
    get objective() {
      return objective;
    },
    get storyDone() {
      return storyDone;
    },
    get missionIndex() {
      return missionIndex;
    },
    get missionTitle() {
      return storyDone ? 'Free roam' : STORY[missionIndex].title;
    },
    get rivals() {
      return rivals;
    },
    get sportsCar() {
      return sportsCar;
    },
    get finaleTimer() {
      return finaleTimer;
    },
    // Where the mission beacon stands, for the minimap and the HUD arrow.
    markerPosition() {
      return markerForStep();
    },
    taxiMarkerPosition() {
      if (taxi.state === 'waiting') return taxi.pickup;
      if (taxi.state === 'delivering') return taxi.dropoff;
      return null;
    },
    // The story mission the player is on, for the save file.
    saveState() {
      return { missionIndex, step };
    },
    // Put a mission on stage for a screenshot: the beacon and the objective
    // text follow the named mission and step, as if the player were there.
    stageForShot(missionId, stepNumber) {
      const index = STORY.findIndex((m) => m.id === missionId);
      if (index === -1) return;
      missionIndex = index;
      step = stepNumber;
      storyDone = false;
      if (missionId === 'payback' && stepNumber === 1) spawnRivals();
      setObjective(STORY[index].briefing);
    },
    loadState(saved) {
      if (!saved) return;
      missionIndex = Math.min(saved.missionIndex ?? 0, STORY.length - 1);
      step = 0;
      if (missionIndex >= STORY.length) {
        storyDone = true;
        setObjective('Story complete — Solmar is yours. Take taxi fares or explore the city.');
      } else {
        setObjective(STORY[missionIndex].briefing);
      }
    },
    // The player got in a car (any car, or the sports car for Hot Wheels).
    onEnterCar(carObj) {
      if (storyDone) return;
      const m = STORY[missionIndex];
      if (m.id === 'fare' && step === 0) {
        step = 1;
        setObjective('Pick up the fare at the yellow marker on the north avenue.');
      }
      if (m.id === 'steal' && step === 0 && carObj === sportsCar) {
        step = 1;
        hooks.onCrime(2);
        hooks.onMessage('You stole the Comet GT! Lose the cops and get it to the garage.');
        setObjective('Drive the Comet GT to the garage on the south-west corner. Lose the cops!');
      }
      if (m.id === 'score' && step === 0) {
        step = 1;
        finaleTimer = MISSIONS.finaleTimeLimit;
        hooks.onCrime(3);
        setObjective(`Get to the pier in ${MISSIONS.finaleTimeLimit} seconds — the whole PD is on you!`);
      }
    },
    // The player got out of a car (fare drop-offs happen on foot too).
    onExitCar() {},
    update(dt, player, world) {
      const px = player.state.x;
      const pz = player.state.z;
      const now = world.now;

      // Beacon follows the current objective; it bobs and spins.
      const marker = markerForStep();
      if (marker && !storyDone) {
        beacon.visible = true;
        beacon.position.set(marker.x, 0, marker.z);
        beacon.userData.diamond.rotation.y += dt * 2;
        beacon.userData.diamond.position.y = 6 + Math.sin(now * 2) * 0.6;
      } else {
        beacon.visible = false;
      }

      // Taxi side job: a fare appears, the player picks them up, then delivers.
      taxi.timer -= dt;
      if (taxi.state === 'idle' && taxi.timer <= 0) {
        taxi.pickup = { x: Math.round((Math.random() * 6 - 3)) * 60 + 6, z: Math.round((Math.random() * 6 - 3)) * 60 - 6 };
        taxi.dropoff = { x: Math.round((Math.random() * 6 - 3)) * 60 - 6, z: Math.round((Math.random() * 6 - 3)) * 60 + 6 };
        taxi.state = 'waiting';
        hooks.onMessage('Taxi fare waiting at the green marker — pick them up for cash.');
      }
      if (taxi.state === 'waiting' && taxi.pickup) {
        taxiBeacon.visible = true;
        taxiBeacon.position.set(taxi.pickup.x, 0, taxi.pickup.z);
        taxiBeacon.userData.diamond.rotation.y += dt * 2;
        if (near(px, pz, taxi.pickup.x, taxi.pickup.z, 5)) {
          taxi.state = 'delivering';
          hooks.onMessage('Fare aboard — drive them to the green marker.');
        }
      } else if (taxi.state === 'delivering' && taxi.dropoff) {
        taxiBeacon.visible = true;
        taxiBeacon.position.set(taxi.dropoff.x, 0, taxi.dropoff.z);
        taxiBeacon.userData.diamond.rotation.y += dt * 2;
        if (near(px, pz, taxi.dropoff.x, taxi.dropoff.z, 6)) {
          const fare = 60 + Math.round(Math.hypot(taxi.dropoff.x - taxi.pickup.x, taxi.dropoff.z - taxi.pickup.z) / 10) * 5;
          hooks.addMoney(fare);
          hooks.audio.pickup();
          hooks.onMessage(`Fare delivered — +$${fare}`);
          taxi.state = 'idle';
          taxi.timer = 20;
          taxiBeacon.visible = false;
        }
      } else if (taxi.state === 'idle') {
        taxiBeacon.visible = false;
      }

      // Cash and health pickups spin and vanish when collected.
      for (const pickup of pickups) {
        if (pickup.taken) continue;
        pickup.mesh.rotation.y += dt * 3;
        pickup.mesh.position.y = 1 + Math.sin(now * 3 + pickup.x) * 0.25;
        if (near(px, pz, pickup.x, pickup.z, 2.2)) {
          pickup.taken = true;
          scene.remove(pickup.mesh);
          if (pickup.kind === 'cash') {
            hooks.addMoney(MISSIONS.cashPickupValue);
            hooks.onMessage(`+$${MISSIONS.cashPickupValue} cash found`);
          } else {
            player.state.health = Math.min(100, player.state.health + 50);
            hooks.onMessage('Health +50');
          }
          hooks.audio.pickup();
        }
      }

      if (storyDone) return;
      const m = STORY[missionIndex];

      if (m.id === 'fare') {
        if (step === 1 && near(px, pz, 60, -54, 6)) {
          step = 2;
          hooks.onMessage('Fare aboard — take them to the hotel on the south avenue.');
          setObjective('Drop the fare at the hotel (south avenue, yellow marker).');
        } else if (step === 2 && near(px, pz, -120, 126, 9)) {
          completeMission();
        }
      } else if (m.id === 'package') {
        if (step === 0 && !player.state.inCar && near(px, pz, -54, 60, 4)) {
          step = 1;
          hooks.onMessage('Package secured — get in a car and drive it to the drop-off.');
          setObjective('Drive the package to the drop-off on the east side (yellow marker).');
        } else if (step === 1 && near(px, pz, 126, -120, 9)) {
          completeMission();
        }
      } else if (m.id === 'steal') {
        if (step === 1 && player.state.car === sportsCar && near(px, pz, -180, 186, 10)) {
          completeMission();
          hooks.onMessage('The Comet GT is in the garage. Marina is impressed.');
        }
      } else if (m.id === 'payback') {
        if (step === 0) {
          if (near(px, pz, -120, -120, 12)) {
            step = 1;
            spawnRivals();
            hooks.onMessage('The Vultures are here — take them all out!');
            setObjective('Take out all 4 Vultures.');
          }
        } else if (step === 1) {
          const alive = rivals.filter((r) => r.alive).length;
          if (alive === 0) completeMission();
          else {
            // Rivals close in and shoot at the player.
            for (const rival of rivals) {
              if (!rival.alive) continue;
              const dx = px - rival.mesh.position.x;
              const dz = pz - rival.mesh.position.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 12) {
                rival.mesh.position.x += (dx / dist) * 3 * dt;
                rival.mesh.position.z += (dz / dist) * 3 * dt;
              }
              rival.mesh.lookAt(px, 0, pz);
              rival.shootTimer -= dt;
              if (rival.shootTimer <= 0 && dist < 35) {
                rival.shootTimer = 1.4 + Math.random() * 0.8;
                player.damage(4 + Math.random() * 4, now);
                hooks.audio.gunshot();
                world.effects.burst(px, 1.5, pz, 0xff6666);
              }
            }
          }
        }
      } else if (m.id === 'score') {
        if (step === 1) {
          finaleTimer -= dt;
          if (near(px, pz, -60, 245, 10)) {
            completeMission();
          } else if (finaleTimer <= 0) {
            failMission('Out of time — the pier run failed.');
          }
        }
      }
    },
    // Called by the shooting code when a rival is hit.
    onRivalHit(rival, damageAmount) {
      if (!rival.alive) return;
      rival.health -= damageAmount;
      if (rival.health <= 0) {
        rival.alive = false;
        rival.mesh.rotation.x = -Math.PI / 2;
        rival.mesh.position.y = 0.4;
        hooks.onMessage('Vulture down.');
      }
    },
    // Restart the current story step after being busted or wasted.
    resetStep() {
      if (storyDone) return;
      if (STORY[missionIndex].id === 'payback') clearRivals();
      step = 0;
      finaleTimer = 0;
      setObjective(STORY[missionIndex].briefing);
    },
  };
}
