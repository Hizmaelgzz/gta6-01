// The HUD: cash, health, wanted stars, speed, the mission objective, a message
// feed and a live minimap drawn on a 2D canvas — roads, buildings, the beach,
// the player arrow, traffic, police and the mission markers.
export function createHud(mapData) {
  const cashEl = document.getElementById('cash');
  const healthFill = document.getElementById('health-fill');
  const healthText = document.getElementById('health-text');
  const starsEl = document.getElementById('stars');
  const speedEl = document.getElementById('speed');
  const clockEl = document.getElementById('clock');
  const missionEl = document.getElementById('mission-title');
  const objectiveEl = document.getElementById('objective');
  const timerEl = document.getElementById('timer');
  const messagesEl = document.getElementById('messages');
  const minimap = document.getElementById('minimap');
  const ctx = minimap.getContext('2d');
  const crosshair = document.getElementById('crosshair');
  const hintEl = document.getElementById('hint');
  const messageLog = [];

  function showMessage(text) {
    messageLog.push(text);
    if (messageLog.length > 4) messageLog.shift();
    messagesEl.innerHTML = messageLog.map((m) => `<div>${m}</div>`).join('');
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => {
      messageLog.length = 0;
      messagesEl.innerHTML = '';
    }, 9000);
  }

  function drawMinimap(state) {
    const W = minimap.width;
    const H = minimap.height;
    const toMap = (x, z) => [((x + 230) / 500) * W, ((z + 230) / 500) * H];
    ctx.clearRect(0, 0, W, H);
    // Ocean and sand, placed by the same mapping as everything else.
    const [, oceanY] = toMap(0, mapData.oceanZ);
    const [, beachY] = toMap(0, mapData.beachZ);
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(0, oceanY, W, H - oceanY);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, beachY, W, oceanY - beachY);
    // Ground.
    ctx.fillStyle = '#6f7a6a';
    ctx.fillRect(0, 0, W, beachY);
    // Roads.
    ctx.strokeStyle = '#3a3d44';
    ctx.lineWidth = 5;
    for (const c of mapData.streets) {
      const [x1, y1] = toMap(c, -210);
      const [x2, y2] = toMap(c, 210);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-210, c);
      const [x4, y4] = toMap(210, c);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#2c2f36';
    for (const b of mapData.buildings) {
      const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(x, y, (b.w / 500) * W, (b.d / 500) * H);
    }
    // Taxi marker, then the mission marker on top.
    if (state.taxiMarker) {
      const [x, y] = toMap(state.taxiMarker.x, state.taxiMarker.z);
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.missionMarker) {
      const [x, y] = toMap(state.missionMarker.x, state.missionMarker.z);
      ctx.fillStyle = '#facc15';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    // Traffic as pale dots, police flashing blue/red.
    ctx.fillStyle = '#f5d90a';
    for (const car of state.trafficCars) {
      const [x, y] = toMap(car.mesh.position.x, car.mesh.position.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#3b82f6' : '#ef4444';
    for (const cop of state.policeCars) {
      const [x, y] = toMap(cop.mesh.position.x, cop.mesh.position.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player: a white arrow pointing where they face. The arrow is drawn
    // pointing up, so rotating it by atan2(dirX, -dirZ) aims it along the
    // facing vector (dirX, dirZ) on a map where +z points down.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(state.playerDirX, -state.playerDirZ));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', 6, 14);
  }

  return {
    showMessage,
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    setMissionTitle(text) {
      missionEl.textContent = text;
    },
    update(state) {
      cashEl.textContent = `$${state.money.toLocaleString('en-US')}`;
      healthFill.style.width = `${Math.max(0, state.health)}%`;
      healthFill.style.background = state.health > 50 ? '#4ade80' : state.health > 25 ? '#facc15' : '#ef4444';
      healthText.textContent = `${Math.ceil(state.health)}`;
      starsEl.textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
      starsEl.style.color = state.stars > 0 ? '#facc15' : '#ffffff88';
      speedEl.textContent = state.inCar ? `${Math.round(state.speed * 3.6)} km/h` : '';
      const hours = Math.floor(state.clockMinutes / 60) % 24;
      const minutes = Math.floor(state.clockMinutes % 60);
      clockEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      timerEl.textContent = state.finaleTimer > 0 ? `⏱ ${Math.ceil(state.finaleTimer)}s` : '';
      crosshair.style.display = !state.inCar && state.playing ? 'block' : 'none';
      hintEl.textContent = state.inCar
        ? 'W/S drive · A/D steer · Space handbrake · E exit car · P pause · M mute'
        : 'WASD move · Shift run · E enter car · F punch · Click shoot · P pause · M mute';
      drawMinimap(state);
    },
  };
}
