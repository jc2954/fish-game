// Pure Web Audio API procedural sound engine for immersive underwater atmosphere

class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.ambientGain = null;
    this.swimGain = null;
    this.swimFilter = null;
    this.noiseNode = null;
    this.subOsc = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupUnderwaterDrone();
      this.setupSwimSwoosh();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    if (!this.initialized) {
      this.init();
    }
    this.resume();

    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      const targetGain = this.isMuted ? 0 : 0.85;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }
    return !this.isMuted;
  }

  // Continuous deep ocean rumble and marine atmosphere
  setupUnderwaterDrone() {
    // Generate pink noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Heavy underwater lowpass filter
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(140, this.ctx.currentTime);
    lowpass.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.45, this.ctx.currentTime);

    whiteNoise.connect(lowpass);
    lowpass.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
    whiteNoise.start();

    // Deep sub-bass hydrophone resonance
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(42, this.ctx.currentTime);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start();
  }

  // Dynamic swim rushing sound tied to speed
  setupSwimSwoosh() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.05;
    }

    const swooshNoise = this.ctx.createBufferSource();
    swooshNoise.buffer = noiseBuffer;
    swooshNoise.loop = true;

    this.swimFilter = this.ctx.createBiquadFilter();
    this.swimFilter.type = 'bandpass';
    this.swimFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    this.swimFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.swimGain = this.ctx.createGain();
    this.swimGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    swooshNoise.connect(this.swimFilter);
    this.swimFilter.connect(this.swimGain);
    this.swimGain.connect(this.masterGain);
    swooshNoise.start();
  }

  // Update dynamic swimming audio from shark speed
  updateSwimSpeed(speedRatio) {
    if (!this.initialized || this.isMuted) return;

    const t = this.ctx.currentTime;
    const freq = 160 + speedRatio * 380;
    const gain = 0.04 + speedRatio * 0.22;

    this.swimFilter.frequency.setTargetAtTime(freq, t, 0.1);
    this.swimGain.gain.setTargetAtTime(gain, t, 0.1);
  }

  // Satisfying chomp bite sound
  playChomp() {
    if (!this.initialized || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Jaw clamp snap
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);

    // Water bubble pop
    const popOsc = this.ctx.createOscillator();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(350 + Math.random() * 200, t + 0.04);
    popOsc.frequency.exponentialRampToValueAtTime(700, t + 0.18);

    const popGain = this.ctx.createGain();
    popGain.gain.setValueAtTime(0.5, t + 0.04);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    popOsc.connect(popGain);
    popGain.connect(this.masterGain);
    popOsc.start(t + 0.04);
    popOsc.stop(t + 0.21);
  }

  // Dash sprint bubble cavitation
  playDash() {
    if (!this.initialized || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  // Sonar blip
  playSonarPing() {
    if (!this.initialized || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.51);
  }

  // Frenzy reward sound chord
  playFrenzyStinger() {
    if (!this.initialized || this.isMuted) return;

    const notes = [440, 554.37, 659.25, 880];
    const t = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.42);
    });
  }
}

export const audio = new AudioManager();
