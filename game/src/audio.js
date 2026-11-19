// All sound is synthesised with WebAudio: no audio files, nothing to download.
// Engine hum, sirens, gunshots, pickups and a small synthwave loop are built
// from oscillators and filtered noise, and start only after a user gesture.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  // A short burst of white noise through a low-pass filter: a gunshot, a crash.
  function noiseBurst(duration, frequency, volume) {
    if (!context) return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    if (!context) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // A laid-back synthwave loop: a bass line under a soft pad, one step per beat.
  const bassLine = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 73.42, 0, 82.41, 73.42];
  function musicTick() {
    if (!context || muted) return;
    const note = bassLine[musicStep % bassLine.length];
    if (note > 0) tone(note, 0.42, 'sawtooth', 0.05);
    if (musicStep % 4 === 0) tone(220, 0.18, 'sine', 0.03);
    if (musicStep % 2 === 0) noiseBurst(0.03, 6000, 0.015);
    musicStep += 1;
  }

  return {
    get muted() {
      return muted;
    },
    // Call from the first click or key press: browsers unlock audio only then.
    start() {
      if (started) return;
      started = true;
      try {
        context = new (window.AudioContext || window.webkitAudioContext)();
        master = context.createGain();
        master.gain.value = 0.5;
        master.connect(context.destination);
        engineOsc = context.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 50;
        engineOsc2 = context.createOscillator();
        engineOsc2.type = 'square';
        engineOsc2.frequency.value = 25;
        engineGain = context.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineOsc2.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
        engineOsc2.start();
        sirenOsc = context.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain = context.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
        musicTimer = window.setInterval(musicTick, 240);
      } catch {
        context = null;
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    setEngine(speedRatio, inCar) {
      if (!context || !engineGain) return;
      const target = inCar ? 0.05 + speedRatio * 0.09 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(45 + speedRatio * 130, context.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(22 + speedRatio * 65, context.currentTime, 0.08);
    },
    setSiren(intensity) {
      if (!context || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(muted ? 0 : intensity * 0.045, context.currentTime, 0.2);
      const t = context.currentTime;
      sirenOsc.frequency.setValueAtTime(sirenOsc.frequency.value, t);
      sirenOsc.frequency.linearRampToValueAtTime(intensity > 0.02 ? 950 : 700, t + 0.45);
    },
    gunshot() {
      noiseBurst(0.14, 1800, 0.5);
      tone(120, 0.12, 'sine', 0.4, 0, 45);
    },
    punch() {
      noiseBurst(0.08, 900, 0.35);
    },
    crash(strength) {
      noiseBurst(0.25, 500, Math.min(0.6, strength));
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.2);
      tone(1318, 0.14, 'sine', 0.2, 0.08);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((note, i) => tone(note, 0.22, 'triangle', 0.22, i * 0.11));
    },
    missionFailed() {
      [392, 330, 262].forEach((note, i) => tone(note, 0.3, 'triangle', 0.2, i * 0.16));
    },
    wantedUp() {
      tone(660, 0.12, 'square', 0.12);
      tone(880, 0.16, 'square', 0.12, 0.12);
    },
    busted() {
      [440, 415, 392, 370].forEach((note, i) => tone(note, 0.35, 'sawtooth', 0.12, i * 0.22));
    },
  };
}
