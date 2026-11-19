// The screenshot scenes behind ?shot=cover|chase|street|title. Each one plays
// the real rules forward from a fresh world for a fixed number of steps — a
// driving autopilot holds the avenue, the police chase for real — so the frame
// is what a short game really looks like, and the same seed always gives the
// same frame.
import { createCarMesh, wrapPlayerCar } from './player.js';

const STEP = 1 / 60;

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

// Steer the player's car up the avenue toward -z, holding the right-hand lane
// (x = +3 for northbound) and overtaking when stuck behind slower traffic:
// if the car crawls for a second, swing into the oncoming lane for a couple
// of seconds to pass, then pull back. Heading north is PI/2; turning left
// (heading up) veers west, turning right (heading down) veers east, so the
// lateral correction subtracts the lane error.
function makeAvenueAutopilot() {
  let lane = 3;
  let slowTimer = 0;
  let overtakeTimer = 0;
  return function autopilot(car) {
    if (car.speed < 10) slowTimer += STEP;
    else slowTimer = 0;
    if (slowTimer > 1 && overtakeTimer <= 0) {
      overtakeTimer = 2.5;
      lane = -3;
    }
    if (overtakeTimer > 0) {
      overtakeTimer -= STEP;
      if (overtakeTimer <= 0) lane = 3;
    }
    const headingError = wrapAngle(Math.PI / 2 - car.heading);
    const lateralError = lane - car.mesh.position.x;
    const steer = headingError * 1.6 - lateralError * 0.08;
    return { forward: true, back: false, left: steer > 0.05, right: steer < -0.05, handbrake: false, run: false, punch: false, shoot: false };
  };
}

function driveFor(game, seconds, autopilot) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = autopilot(game.player.state.car);
    game.stepWorld(STEP, input);
  }
}

function walkFor(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.stepWorld(STEP, { forward: false, back: false, left: false, right: false, handbrake: false, run: false, punch: false, shoot: false });
  }
}

// Put the player in a fresh sports car on the main avenue, facing north.
function stageDriving(game, x, z) {
  const mesh = createCarMesh('sports', 0xc0392b);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = Math.PI / 2;
  game.scene.add(mesh);
  const car = wrapPlayerCar(mesh, 'sports');
  game.player.enterCar(car, null);
  game.setCameraBehind(0.4);
  return car;
}

/**
 * Set the world to the named scene and return the screen to draw over it:
 * cover (driving the avenue), chase (wanted 3, PD on your tail), street (on
 * foot by the fare pickup) or title (the title screen over the city).
 */
export function stageShot(name, game) {
  if (name === 'chase') {
    stageDriving(game, 3, 150);
    game.police.addStars(3, null);
    driveFor(game, 7, makeAvenueAutopilot());
    // Look back down the avenue: the player's car from the front, the
    // police cruisers closing in behind it.
    game.lockCamera(game.facingYaw() + Math.PI, 0.3);
    return { screen: 'play' };
  }
  if (name === 'street') {
    game.missions.stageForShot('fare', 1);
    // Face the fare marker (north-east of the player) so the beacon is in frame.
    game.player.state.x = 52;
    game.player.state.z = -46;
    game.player.state.heading = (3 * Math.PI) / 4;
    game.player.mesh.position.set(52, 0, -46);
    game.player.mesh.rotation.y = (3 * Math.PI) / 4;
    game.setCameraBehind(0.55);
    walkFor(game, 5);
    return { screen: 'play' };
  }
  if (name === 'title') {
    game.setCameraCinematic();
    walkFor(game, 2);
    return { screen: 'title' };
  }
  // cover: driving the avenue with traffic, the minimap and the objective up.
  stageDriving(game, 3, 150);
  driveFor(game, 6, makeAvenueAutopilot());
  game.setCameraBehind(0.4);
  return { screen: 'play' };
}
