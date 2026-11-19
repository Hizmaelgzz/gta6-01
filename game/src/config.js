// Solmar City — shared tuning: the city grid, the player, the cars, the wanted
// ladder and the mission rewards. One place for every number a designer would
// tweak, so the systems in the other files read like rules, not magic numbers.
export const CITY = {
  // Streets run on this grid; blocks sit between them.
  streetSpacing: 60,
  streetCount: 7, // streets at -180, -120, -60, 0, 60, 120, 180
  roadWidth: 12,
  blockSize: 48,
  // The city spans this half-extent; the beach and ocean lie past +z.
  halfExtent: 210,
  beachZ: 235,
  oceanZ: 260,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.6,
  maxHealth: 100,
  punchDamage: 15,
  punchRange: 2.2,
  pistolDamage: 34,
  pistolRange: 60,
  fireInterval: 0.28,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 38, // m/s, about 137 km/h for a sports car
  maxReverse: 10,
  steer: 1.9, // radians per second at low speed
  grip: 6.0,
  handbrakeGrip: 1.6,
  radius: 2.3,
  enterDistance: 4,
};

export const TRAFFIC = {
  count: 14,
  speed: 9,
  spawnDistance: 90,
};

export const PEDS = {
  count: 22,
  walkSpeed: 1.6,
  fleeSpeed: 4.5,
};

export const WANTED = {
  // Stars -> police cars chasing at once.
  carsPerStar: [0, 1, 1, 2, 2, 3],
  // Seconds with no crime and no cop nearby before a star cools off.
  coolDown: 18,
  bustDistance: 3.2,
  bustHoldSeconds: 1.6,
};

export const MISSIONS = {
  taxiReward: 150,
  packageReward: 300,
  stealReward: 500,
  paybackReward: 800,
  finaleReward: 1500,
  finaleTimeLimit: 100,
  cashPickupValue: 50,
  cashPickupCount: 10,
  bustedFine: 100,
};

export const SAVE_KEY = 'solmar-city-save-v1';
export const BEST_KEY = 'solmar-city-best-v1';
