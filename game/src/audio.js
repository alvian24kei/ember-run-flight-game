// Ember Run — sound: everything is synthesised with WebAudio at runtime.
// No audio files, no network.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engine = null;
    this.engineGain = null;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      osc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      osc.start();
      this.engine = osc;
    } catch {
      this.ctx = null;
    }
  }

  setEngine(throttle, speed) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.engine.frequency.value = 48 + throttle * 70 + speed * 0.12;
    this.engineGain.gain.value = 0.02 + throttle * 0.05;
  }

  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  ring() {
    this.blip(880, 0.16);
    setTimeout(() => this.blip(1318, 0.24), 90);
  }

  crash() {
    this.blip(90, 0.5, 'square', 0.2);
    setTimeout(() => this.blip(55, 0.6, 'sawtooth', 0.18), 80);
  }

  land() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.3), i * 120));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    return this.muted;
  }
}
