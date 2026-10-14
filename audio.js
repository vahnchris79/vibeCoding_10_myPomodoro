/**
 * FocusFlow Audio Engine (Web Audio API Procedural Synthesizer)
 * - 100% Offline, Zero external dependencies, Crystal-clear procedural ambient audio
 * - 3 Ambient Sound Generators: Ocean Waves, Soothing Rain, Forest Birds
 * - Rich Harmonic Chimes for Session Transitions
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.alarmGain = null;

    // Current State
    this.currentSound = 'none';
    this.volume = 0.6; // 0.0 to 1.0
    this.isMuted = false;
    this.previousVolume = 0.6;

    // Active Node References for Ambient Sound
    this.activeNodes = [];
    this.birdTimer = null;
    this.isInitialized = false;
  }

  /**
   * Lazily initialize AudioContext upon user gesture
   */
  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API is not supported in this browser.');
      return;
    }

    this.ctx = new AudioContextClass();

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Ambient Sound Sub-gain
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    // Alarm Sound Sub-gain
    this.alarmGain = this.ctx.createGain();
    this.alarmGain.gain.setValueAtTime(1.2, this.ctx.currentTime);
    this.alarmGain.connect(this.masterGain);

    this.isInitialized = true;
  }

  /**
   * Generate 5-second Pink Noise Buffer
   */
  createPinkNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 5;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  /**
   * Play Ocean Waves (파도 소리)
   * Pink noise + cyclic low-pass filter LFO + volume swell modulation
   */
  startWaves() {
    this.stopAmbientNodes();
    const now = this.ctx.currentTime;

    // 1. Noise Source
    const noiseBuffer = this.createPinkNoiseBuffer();
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // 2. Dynamic Low-Pass Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);
    filter.Q.setValueAtTime(1.8, now);

    // 3. Swell Gain Node
    const swellGain = this.ctx.createGain();
    swellGain.gain.setValueAtTime(0.3, now);

    // 4. LFO for Wave Swell (Period ~ 11 seconds: 0.09 Hz)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.09, now);

    // LFO to Filter Frequency: sweeps ~180Hz to ~650Hz
    const lfoFilterGain = this.ctx.createGain();
    lfoFilterGain.gain.setValueAtTime(240, now);
    lfo.connect(lfoFilterGain);
    lfoFilterGain.connect(filter.frequency);

    // LFO to Gain (Swell volume): sweeps between 0.15 and 0.65
    const lfoVolumeGain = this.ctx.createGain();
    lfoVolumeGain.gain.setValueAtTime(0.25, now);
    lfo.connect(lfoVolumeGain);
    lfoVolumeGain.connect(swellGain.gain);

    // Fade In
    const fadeIn = this.ctx.createGain();
    fadeIn.gain.setValueAtTime(0.001, now);
    fadeIn.gain.exponentialRampToValueAtTime(0.7, now + 1.2);

    // Connections
    noiseSource.connect(filter);
    filter.connect(swellGain);
    swellGain.connect(fadeIn);
    fadeIn.connect(this.ambientGain);

    noiseSource.start(now);
    lfo.start(now);

    this.activeNodes.push(noiseSource, lfo, filter, swellGain, fadeIn);
  }

  /**
   * Play Rain (빗소리)
   * Pink noise + dual bandpass & highpass filters + randomized droplet clicks
   */
  startRain() {
    this.stopAmbientNodes();
    const now = this.ctx.currentTime;

    // 1. Base Rain Noise
    const noiseBuffer = this.createPinkNoiseBuffer();
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Highpass to remove heavy mud
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(500, now);

    // Peaking filter for soothing rain hiss
    const peakFilter = this.ctx.createBiquadFilter();
    peakFilter.type = 'peaking';
    peakFilter.frequency.setValueAtTime(2800, now);
    peakFilter.Q.setValueAtTime(1.4, now);
    peakFilter.gain.setValueAtTime(4.0, now);

    // Fade In
    const fadeIn = this.ctx.createGain();
    fadeIn.gain.setValueAtTime(0.001, now);
    fadeIn.gain.exponentialRampToValueAtTime(0.65, now + 1.0);

    noiseSource.connect(hpFilter);
    hpFilter.connect(peakFilter);
    peakFilter.connect(fadeIn);
    fadeIn.connect(this.ambientGain);

    noiseSource.start(now);
    this.activeNodes.push(noiseSource, hpFilter, peakFilter, fadeIn);

    // 2. Randomized Droplet Impulses
    const scheduleDrop = () => {
      if (this.currentSound !== 'rain' || !this.ctx) return;
      const dropTime = this.ctx.currentTime + Math.random() * 0.15;
      const osc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();

      const freq = 1200 + Math.random() * 2000;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, dropTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, dropTime + 0.04);

      dropGain.gain.setValueAtTime(0.02, dropTime);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, dropTime + 0.035);

      osc.connect(dropGain);
      dropGain.connect(this.ambientGain);

      osc.start(dropTime);
      osc.stop(dropTime + 0.04);

      const nextDelay = 80 + Math.random() * 180;
      this.birdTimer = setTimeout(scheduleDrop, nextDelay);
    };

    scheduleDrop();
  }

  /**
   * Play Birds & Gentle Forest Ambience (새소리)
   * Soft ambient breeze bed + procedural bird chirping intervals
   */
  startBirds() {
    this.stopAmbientNodes();
    const now = this.ctx.currentTime;

    // 1. Soft Forest Breeze Base
    const noiseBuffer = this.createPinkNoiseBuffer();
    const breezeSource = this.ctx.createBufferSource();
    breezeSource.buffer = noiseBuffer;
    breezeSource.loop = true;

    const breezeFilter = this.ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.setValueAtTime(450, now);
    breezeFilter.Q.setValueAtTime(0.8, now);

    const breezeGain = this.ctx.createGain();
    breezeGain.gain.setValueAtTime(0.001, now);
    breezeGain.gain.exponentialRampToValueAtTime(0.12, now + 1.5);

    breezeSource.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(this.ambientGain);

    breezeSource.start(now);
    this.activeNodes.push(breezeSource, breezeFilter, breezeGain);

    // 2. Procedural Chirping Routine
    const playChirp = () => {
      if (this.currentSound !== 'birds' || !this.ctx) return;
      const chirpTime = this.ctx.currentTime;
      const numNotes = 2 + Math.floor(Math.random() * 3);
      let noteDelay = 0;

      const baseFreq = 2400 + Math.random() * 800;

      for (let i = 0; i < numNotes; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        const startTime = chirpTime + noteDelay;
        const noteDuration = 0.06 + Math.random() * 0.05;

        osc.type = 'sine';
        // Up & Down pitch bend characteristic of small songbirds
        const f0 = baseFreq + (i * 200) + Math.random() * 300;
        const f1 = f0 + 600 + Math.random() * 400;
        const f2 = f0 - 200;

        osc.frequency.setValueAtTime(f0, startTime);
        osc.frequency.exponentialRampToValueAtTime(f1, startTime + noteDuration * 0.4);
        osc.frequency.exponentialRampToValueAtTime(f2, startTime + noteDuration);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

        if (panner) {
          panner.pan.setValueAtTime((Math.random() * 1.4) - 0.7, startTime);
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(this.ambientGain);
        } else {
          osc.connect(gain);
          gain.connect(this.ambientGain);
        }

        osc.start(startTime);
        osc.stop(startTime + noteDuration + 0.02);

        noteDelay += noteDuration + 0.03 + Math.random() * 0.04;
      }

      // Schedule next bird song in 2.5 ~ 6 seconds
      const nextInterval = 2500 + Math.random() * 3500;
      this.birdTimer = setTimeout(playChirp, nextInterval);
    };

    // Trigger initial chirp quickly
    this.birdTimer = setTimeout(playChirp, 800);
  }

  /**
   * Stop Ambient Generator Nodes
   */
  stopAmbientNodes() {
    if (this.birdTimer) {
      clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }

    if (this.activeNodes.length > 0) {
      this.activeNodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch (e) {
          // Ignore already stopped nodes
        }
      });
      this.activeNodes = [];
    }
  }

  /**
   * Switch Active Ambient Sound
   * @param {'none' | 'waves' | 'rain' | 'birds'} soundType 
   */
  setAmbientSound(soundType) {
    this.init();
    if (!this.ctx) return;

    if (this.currentSound === soundType) return;
    this.currentSound = soundType;

    switch (soundType) {
      case 'waves':
        this.startWaves();
        break;
      case 'rain':
        this.startRain();
        break;
      case 'birds':
        this.startBirds();
        break;
      case 'none':
      default:
        this.stopAmbientNodes();
        break;
    }
  }

  /**
   * Set Master Audio Volume (0.0 to 1.0)
   */
  setVolume(val) {
    this.init();
    this.volume = Math.max(0, Math.min(1, val));

    if (this.masterGain && this.ctx) {
      if (this.isMuted) {
        this.isMuted = false;
      }
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
    }
  }

  /**
   * Toggle Mute State
   */
  toggleMute() {
    this.init();
    if (!this.masterGain || !this.ctx) return !this.isMuted;

    this.isMuted = !this.isMuted;
    const now = this.ctx.currentTime;

    if (this.isMuted) {
      this.previousVolume = this.volume > 0 ? this.volume : 0.6;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.05);
    } else {
      const restoreVol = this.previousVolume || 0.6;
      this.volume = restoreVol;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(restoreVol, now + 0.05);
    }

    return this.isMuted;
  }

  /**
   * Play Crystal Harmonious Session End Alarm
   * @param {'work' | 'break'} sessionEnded
   */
  playAlarm(sessionEnded) {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Frequencies:
    // When 25m Focus completes: Bright uplifting C-Major triad (C5, E5, G5, C6)
    // When 5m Break completes: Warm gentle return chime (A4, E5, A5)
    const chords = sessionEnded === 'work' 
      ? [523.25, 659.25, 783.99, 1046.50]
      : [440.00, 659.25, 880.00];

    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      const noteStart = now + idx * 0.12;
      const decayDuration = 2.4;

      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(0.3, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + decayDuration);

      osc.connect(gain);
      gain.connect(this.alarmGain);

      osc.start(noteStart);
      osc.stop(noteStart + decayDuration + 0.1);
    });
  }
}

// Global Sound Engine Instance
window.soundEngine = new SoundEngine();
