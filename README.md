# Solmar City — an original open-world crime game

**Solmar City** is a complete open-world crime game in the spirit of GTA 6,
built for the [make.fun](https://make.fun) `gta6-01` bounty. It plays offline
in a desktop browser from static files — no build step, no network requests.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD** move / drive · **Shift** run · **E** enter / steal a car · **F** punch · **Click** shoot
- **Space** handbrake · **Mouse drag** camera · **P** pause · **M** mute

## The game

Danny Cole is back in Solmar, a sun-soaked coastal city. The game has:

- A drivable city on foot and by car, with traffic, pedestrians, a beach, a pier and a neon hotel row
- Stealable cars (parked and in traffic), a 5-star wanted system and police chases
- A five-mission story (a fare, a package, a stolen sports car, a payback, a timed getaway) plus repeating taxi fares
- Combat (punching and a pistol), health, cash pickups, busted/wasted respawns
- A HUD with a live minimap, wanted stars, speed, health and a mission objective
- Synthesised sound (engine, sirens, gunshots, music) — no audio files
- Autosave to localStorage, with New Game / Continue

## Layout

- `game/index.html` — the page, HUD and screens
- `game/src/main.js` — boot, the fixed-step loop, input, camera
- `game/src/city.js` — the city: streets, buildings, beach, ocean, palms, neon
- `game/src/vehicles.js` — car models and traffic AI
- `game/src/pedestrians.js` — pedestrians who stroll and flee
- `game/src/police.js` — the wanted system and police chases
- `game/src/player.js` — on-foot movement, arcade driving, combat
- `game/src/missions.js` — the story missions, taxi fares and pickups
- `game/src/hud.js` — HUD and minimap
- `game/src/audio.js` — WebAudio sound effects and music
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=cover|chase|street|title`)
- `game/vendor/three.module.min.js` — three.js r160 (MIT), vendored

## License

MIT — see [LICENSE](LICENSE). Everything in the city, the story, the names and
the art is original; nothing comes from any commercial game.
