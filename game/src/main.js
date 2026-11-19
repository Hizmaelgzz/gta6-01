// Solmar City — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between four screens: title, play, paused and busted/wasted.
//
// ?seed=N fixes the city. ?shot=cover|chase|street|title (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createTraffic, createParkedCar } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createPlayer, createEffects, wrapPlayerCar } from './player.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { readSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_EVERY_SECONDS = 20;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

// --- Scene ---------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

const { colliders, circleColliders, mapData } = buildCity(scene, random);
const audio = createAudio();
const effects = createEffects(scene);
const player = createPlayer(scene, 6, 6);
const hud = createHud(mapData);

// Parked cars the player can steal, scattered along the avenues.
const parkedCars = [
  createParkedCar(scene, 66, 3, 0, 'sedan', 0x2980b9),
  createParkedCar(scene, -66, -3, Math.PI, 'sedan', 0x27ae60),
  createParkedCar(scene, 126, 63, Math.PI / 2, 'van', 0xeeeeee),
  createParkedCar(scene, -126, -63, -Math.PI / 2, 'sedan', 0x8e44ad),
  createParkedCar(scene, 6, -126, Math.PI, 'taxi', 0xf1c40f),
];

const peds = createPedestrians(scene, random);
const police = createPolice(scene);

const missions = createMissions(scene, random, {
  audio,
  onObjective: (text) => hud.setObjective(text),
  onMessage: (text) => hud.showMessage(text),
  addMoney: (amount) => {
    player.state.money += amount;
    saveSoon();
  },
  onCrime: (stars) => police.addStars(stars, audio),
  onStoryComplete: () => {
    hud.showMessage('STORY COMPLETE — Solmar City is yours, Danny.');
    saveSoon();
  },
});

// Traffic spawns clear of the parked cars and the mission sports car, and
// brakes for them instead of driving through them.
const traffic = createTraffic(scene, random, [
  ...parkedCars.map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z })),
  { x: missions.sportsCar.mesh.position.x, z: missions.sportsCar.mesh.position.z },
]);

// --- State -----------------------------------------------------------------
let screen = 'title';
let clockMinutes = 16 * 60 + 30;
let now = 0;
let saveTimer = SAVE_EVERY_SECONDS;
let cameraYaw = Math.PI / 4;
let cameraPitch = 0.32;
let cameraDistance = 8;
let autoAlignTimer = 0;
let cinematic = false;

const saved = readSave();
if (saved) {
  document.getElementById('continue-btn').style.display = 'inline-block';
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Input -----------------------------------------------------------------
const input = {
  forward: false, back: false, left: false, right: false,
  run: false, handbrake: false, punch: false, shoot: false,
};
const keys = {};
let dragging = false;
let dragMoved = false;
let lastMouse = { x: 0, y: 0 };

function applyKeys() {
  input.forward = keys.KeyW || keys.ArrowUp || false;
  input.back = keys.KeyS || keys.ArrowDown || false;
  input.left = keys.KeyA || keys.ArrowLeft || false;
  input.right = keys.KeyD || keys.ArrowRight || false;
  input.run = keys.ShiftLeft || keys.ShiftRight || false;
  input.handbrake = keys.Space || false;
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  keys[event.code] = true;
  applyKeys();
  audio.start();
  if (event.code === 'KeyM') {
    const muted = audio.toggleMute();
    hud.showMessage(muted ? 'Sound off' : 'Sound on');
  }
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (screen === 'play') pauseGame();
    else if (screen === 'paused') resumeGame();
  }
  if (event.code === 'KeyF') input.punch = true;
  if (event.code === 'KeyE' && screen === 'play') toggleEnterCar();
  if (event.code === 'Enter' && screen === 'title') startGame(false);
  if (event.code === 'Enter' && (screen === 'busted' || screen === 'wasted')) respawn();
});
window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
  applyKeys();
});
canvas.addEventListener('mousedown', (event) => {
  dragging = true;
  dragMoved = false;
  lastMouse = { x: event.clientX, y: event.clientY };
  audio.start();
});
window.addEventListener('mousemove', (event) => {
  if (!dragging) return;
  const dx = event.clientX - lastMouse.x;
  const dy = event.clientY - lastMouse.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
  cameraYaw -= dx * 0.005;
  cameraPitch = Math.max(-0.1, Math.min(1.1, cameraPitch + dy * 0.004));
  autoAlignTimer = 2.5;
  lastMouse = { x: event.clientX, y: event.clientY };
});
window.addEventListener('mouseup', () => {
  if (dragging && !dragMoved && screen === 'play' && !player.state.inCar) input.shoot = true;
  dragging = false;
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

// --- Entering and stealing cars -------------------------------------------
function nearestEnterableCar() {
  const px = player.state.x;
  const pz = player.state.z;
  let best = null;
  let bestDist = 4.5;
  const candidates = [];
  for (const car of traffic.cars) candidates.push({ obj: { mesh: car.mesh, speed: 0, heading: car.mesh.rotation.y, type: 'traffic', trafficCar: car }, x: car.mesh.position.x, z: car.mesh.position.z });
  for (const parked of parkedCars) candidates.push({ obj: { mesh: parked.mesh, speed: 0, heading: parked.mesh.rotation.y, type: 'parked', parked }, x: parked.mesh.position.x, z: parked.mesh.position.z });
  candidates.push({ obj: missions.sportsCar ? { mesh: missions.sportsCar.mesh, speed: 0, heading: missions.sportsCar.mesh.rotation.y, type: 'sports', sports: true } : null, x: missions.sportsCar.mesh.position.x, z: missions.sportsCar.mesh.position.z });
  for (const c of candidates) {
    if (!c.obj) continue;
    const dist = Math.hypot(px - c.x, pz - c.z);
    if (dist < bestDist) {
      best = c.obj;
      bestDist = dist;
    }
  }
  return best;
}

function toggleEnterCar() {
  if (player.state.inCar) {
    player.exitCar();
    return;
  }
  const car = nearestEnterableCar();
  if (!car) return;
  if (car.trafficCar) {
    traffic.remove(car.trafficCar);
    police.addStars(1, audio);
    hud.showMessage('You stole a car! The PD is on you.');
  } else if (car.type === 'parked' || car.sports) {
    police.addStars(1, audio);
    hud.showMessage('You stole a car! The PD is on you.');
  }
  const wrapped = wrapPlayerCar(car.mesh, car.type);
  wrapped.heading = car.heading;
  player.enterCar(wrapped, null);
  missions.onEnterCar(car.sports ? missions.sportsCar : wrapped);
}

// --- Camera ----------------------------------------------------------------
function facingYaw() {
  if (player.state.inCar) {
    const h = player.state.car.heading;
    return Math.atan2(Math.cos(h), -Math.sin(h));
  }
  return player.state.heading;
}

function setCameraBehind(pitch) {
  cameraYaw = facingYaw();
  cameraPitch = pitch;
  cinematic = false;
}

function setCameraCinematic() {
  cinematic = true;
}

function updateCamera(dt) {
  if (cinematic) {
    const t = now * 0.05;
    camera.position.set(Math.sin(t) * 180, 55, 120 + Math.cos(t) * 60);
    camera.lookAt(0, 8, 40);
    return;
  }
  autoAlignTimer = Math.max(0, autoAlignTimer - dt);
  if (autoAlignTimer <= 0) {
    // Ease the camera back behind the player's facing.
    let diff = facingYaw() - cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cameraYaw += diff * Math.min(1, dt * 1.4);
    cameraPitch += (0.32 - cameraPitch) * Math.min(1, dt * 1.4);
  }
  const target = player.state.inCar
    ? player.state.car.mesh.position
    : player.mesh.position;
  const speed = player.speed;
  const dist = (player.state.inCar ? 9.5 : 7) + speed * 0.06;
  cameraDistance += (dist - cameraDistance) * Math.min(1, dt * 3);
  const tx = target.x;
  const ty = target.y + 2.2;
  const tz = target.z;
  camera.position.set(
    tx - Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
    ty + Math.sin(cameraPitch) * cameraDistance,
    tz - Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
  );
  camera.lookAt(tx, ty, tz);
  camera.fov = 62 + Math.min(10, speed * 0.25);
  camera.updateProjectionMatrix();
}

// --- World step --------------------------------------------------------------
function carObstacles() {
  const list = [];
  for (const car of traffic.cars) {
    list.push({
      mesh: car.mesh,
      push: (dx, dz) => {
        car.mesh.position.x += dx;
        car.mesh.position.z += dz;
      },
    });
  }
  for (const parked of parkedCars) list.push({ mesh: parked.mesh });
  if (missions.sportsCar && !player.state.inCar) list.push({ mesh: missions.sportsCar.mesh });
  for (const cop of police.cruisers) list.push({ mesh: cop.mesh });
  return list;
}

function shootTargets() {
  const list = [];
  for (const ped of peds.peds) {
    if (ped.dead) continue;
    list.push({
      mesh: ped.mesh,
      onHit: (dmg) => {
        peds.kill(ped);
        police.addStars(2, audio);
        hud.showMessage('You shot a pedestrian! The PD is coming.');
      },
    });
  }
  for (const rival of missions.rivals) {
    if (!rival.alive) continue;
    list.push({ mesh: rival.mesh, onHit: (dmg) => missions.onRivalHit(rival, dmg) });
  }
  for (const cop of police.cruisers) {
    list.push({
      mesh: cop.mesh,
      onHit: () => {
        police.addStars(1, audio);
        hud.showMessage('You shot at the police!');
      },
    });
  }
  return list;
}

function stepWorld(dt, stepInput) {
  now += dt;
  clockMinutes += dt / 1.5;
  const world = {
    colliders,
    circleColliders,
    carObstacles: carObstacles(),
    peds,
    audio,
    effects,
    cameraYaw,
    now,
    onHitPedestrian: (ped) => {
      if (ped.dead) return;
      peds.kill(ped);
      police.addStars(1, audio);
      hud.showMessage('You hit a pedestrian! +1 star.');
    },
    punchTargets: shootTargets(),
    shootTargets: shootTargets(),
  };
  player.update(dt, stepInput, world, now, camera);
  const staticCars = [...parkedCars.map((p) => p.mesh), missions.sportsCar.mesh];
  traffic.update(dt, player.state.inCar ? { mesh: player.state.car.mesh } : null, staticCars);
  peds.update(dt, { x: player.state.x, z: player.state.z });
  const nearestCop = police.update(dt, { x: player.state.x, z: player.state.z }, player.speed, player.state.inCar, random, () => bustPlayer(), colliders);
  missions.update(dt, player, { ...world, effects });
  effects.update(dt);
  audio.setEngine(player.state.inCar ? Math.abs(player.state.car.speed) / 38 : 0, player.state.inCar);
  audio.setSiren(police.stars > 0 ? Math.max(0, 1 - nearestCop / 90) : 0);
  if (player.state.health <= 0) wastePlayer();
  saveTimer -= dt;
  if (saveTimer <= 0) {
    saveTimer = SAVE_EVERY_SECONDS;
    saveGame();
  }
}

// --- Busted / wasted ---------------------------------------------------------
function bustPlayer() {
  if (screen !== 'play') return;
  screen = 'busted';
  audio.busted();
  player.state.money = Math.max(0, player.state.money - 100);
  police.clearStars();
  missions.resetStep();
  showScreen('busted');
  saveGame();
}

function wastePlayer() {
  if (screen !== 'play') return;
  screen = 'wasted';
  audio.busted();
  player.state.money = Math.max(0, player.state.money - 100);
  police.clearStars();
  missions.resetStep();
  showScreen('wasted');
  saveGame();
}

function respawn() {
  if (player.state.inCar) {
    const car = player.state.car;
    player.exitCar();
    scene.remove(car.mesh);
  }
  player.state.x = 6;
  player.state.z = -174;
  player.state.heading = Math.PI;
  player.mesh.position.set(6, 0, -174);
  player.mesh.rotation.y = Math.PI;
  player.mesh.visible = true;
  player.state.health = PLAYER.maxHealth;
  cameraYaw = Math.PI;
  cameraPitch = 0.32;
  saveGame();
  screen = 'play';
  showScreen('play');
  hud.showMessage('You are back on the streets of Solmar.');
}

// --- Screens -----------------------------------------------------------------
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  busted: document.getElementById('screen-busted'),
  wasted: document.getElementById('screen-wasted'),
};
const hudEl = document.getElementById('hud');

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.classList.toggle('hidden', key !== name);
  if (name === 'play') {
    for (const el of Object.values(screens)) el.classList.add('hidden');
    hudEl.classList.remove('hidden');
  } else {
    hudEl.classList.add('hidden');
  }
}

function pauseGame() {
  screen = 'paused';
  showScreen('pause');
}
function resumeGame() {
  screen = 'play';
  showScreen('play');
}

function startGame(useSave) {
  audio.start();
  if (useSave && saved) {
    player.state.money = saved.money ?? 0;
    player.state.health = saved.health ?? PLAYER.maxHealth;
    player.state.x = saved.x ?? 6;
    player.state.z = saved.z ?? 6;
    player.mesh.position.set(player.state.x, 0, player.state.z);
    missions.loadState(saved.mission);
    hud.showMessage('Welcome back to Solmar.');
  } else {
    player.state.money = 0;
    player.state.health = PLAYER.maxHealth;
    missions.loadState(null);
    hud.showMessage('Danny Cole is back in Solmar. Marina is waiting — get in a car.');
  }
  hud.setMissionTitle(missions.missionTitle);
  hud.setObjective(missions.objective);
  screen = 'play';
  showScreen('play');
  saveGame();
}

function saveGame() {
  writeSave({
    money: player.state.money,
    health: player.state.health,
    x: player.state.x,
    z: player.state.z,
    mission: missions.saveState(),
    storyDone: missions.storyDone,
  });
}

function saveSoon() {
  saveTimer = Math.min(saveTimer, 2);
}

document.getElementById('start-btn').addEventListener('click', () => startGame(false));
document.getElementById('continue-btn').addEventListener('click', () => startGame(true));
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('respawn-btn').addEventListener('click', respawn);
document.getElementById('respawn-btn-2').addEventListener('click', respawn);
document.getElementById('quit-btn').addEventListener('click', () => {
  screen = 'title';
  showScreen('title');
  setCameraCinematic();
});

// --- Main loop ---------------------------------------------------------------
function frame(frameNow) {
  requestAnimationFrame(frame);
  const dt = Math.min((frameNow - (frame.last ?? frameNow)) / 1000, MAX_FRAME);
  frame.last = frameNow;
  if (screen === 'title') {
    stepWorld(dt, { forward: false, back: false, left: false, right: false, handbrake: false, run: false, punch: false, shoot: false });
    setCameraCinematic();
    updateCamera(dt);
  } else if (screen === 'play') {
    let remaining = dt;
    while (remaining >= STEP) {
      stepWorld(STEP, input);
      remaining -= STEP;
    }
    updateCamera(dt);
    hud.setMissionTitle(missions.missionTitle);
    hud.update({
      money: player.state.money,
      health: player.state.health,
      stars: police.stars,
      speed: player.speed,
      inCar: player.state.inCar,
      clockMinutes,
      finaleTimer: missions.finaleTimer,
      playing: true,
      playerX: player.state.x,
      playerZ: player.state.z,
      playerDirX: player.state.inCar ? Math.cos(player.state.car.heading) : Math.sin(player.state.heading),
      playerDirZ: player.state.inCar ? -Math.sin(player.state.car.heading) : Math.cos(player.state.heading),
      missionMarker: missions.markerPosition(),
      taxiMarker: missions.taxiMarkerPosition(),
      trafficCars: traffic.cars,
      policeCars: police.cruisers,
    });
  } else if (screen === 'paused') {
    updateCamera(0);
  }
  renderer.render(scene, camera);
}

// --- Screenshot mode -----------------------------------------------------------
function runShot(name) {
  screen = 'play';
  showScreen('play');
  const game = {
    scene,
    player,
    police,
    missions,
    setCameraBehind,
    setCameraCinematic,
    facingYaw,
    // Hold the camera at this yaw/pitch instead of easing back behind the
    // player: for the chase shot, which looks back at the pursuing police.
    lockCamera: (yaw, pitch) => {
      cameraYaw = yaw;
      cameraPitch = pitch;
      autoAlignTimer = 3600;
    },
    stepWorld: (dt, stepInput) => {
      stepWorld(dt, stepInput);
      updateCamera(dt);
    },
  };
  const sceneResult = stageShot(name, game);
  if (sceneResult.screen === 'title') {
    screen = 'title';
    showScreen('title');
    setCameraCinematic();
  }
  hud.setMissionTitle(missions.missionTitle);
  hud.update({
    money: player.state.money,
    health: player.state.health,
    stars: police.stars,
    speed: player.speed,
    inCar: player.state.inCar,
    clockMinutes,
    finaleTimer: missions.finaleTimer,
    playing: true,
    playerX: player.state.x,
    playerZ: player.state.z,
    playerDirX: player.state.inCar ? Math.cos(player.state.car.heading) : Math.sin(player.state.heading),
    playerDirZ: player.state.inCar ? -Math.sin(player.state.car.heading) : Math.cos(player.state.heading),
    missionMarker: missions.markerPosition(),
    taxiMarker: missions.taxiMarkerPosition(),
    trafficCars: traffic.cars,
    policeCars: police.cruisers,
  });
  updateCamera(0.016);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// Debug handle for playtesting: state, a way to press keys from a script, and
// a way to step the world deterministically without waiting on the renderer.
window.__game = {
  player, police, missions, traffic, peds,
  get screen() {
    return screen;
  },
  start: () => startGame(false),
  setInput: (next) => Object.assign(input, next),
  setCameraYaw: (yaw) => { cameraYaw = yaw; },
  step: (dt, stepInput) => {
    stepWorld(dt, stepInput ?? input);
    updateCamera(dt);
  },
  render: () => renderer.render(scene, camera),
};

if (shot) runShot(shot);
else {
  showScreen('title');
  setCameraCinematic();
  requestAnimationFrame(frame);
}
