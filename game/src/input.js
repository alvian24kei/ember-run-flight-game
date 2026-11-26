// Ember Run — input: keyboard plus mouse steering.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.mouseActive = false;
    this.onStart = null;
    this.onPause = null;
    this.onRestart = null;
    this.onMute = null;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'Enter' || e.key === ' ') this.onStart?.();
      if (e.key.toLowerCase() === 'p') this.onPause?.();
      if (e.key.toLowerCase() === 'r') this.onRestart?.();
      if (e.key.toLowerCase() === 'm') this.onMute?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / rect.width;
      this.mouseY = (e.clientY - rect.top) / rect.height;
      this.mouseActive = true;
    });
    canvas.addEventListener('mousedown', () => this.onStart?.());
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Read the current control intent: pitch -1..1, bank -1..1, throttle 0..1. */
  read(currentThrottle) {
    let pitch = 0;
    let bank = 0;
    if (this.keys.has('arrowup')) pitch += 1;
    if (this.keys.has('arrowdown')) pitch -= 1;
    if (this.keys.has('arrowleft') || this.keys.has('a')) bank -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) bank += 1;
    // Mouse steering: offset from centre steers bank and pitch, gently.
    if (this.mouseActive && !this.keys.has('arrowleft') && !this.keys.has('arrowright') &&
        !this.keys.has('arrowup') && !this.keys.has('arrowdown')) {
      bank += Math.max(-1, Math.min(1, (this.mouseX - 0.5) * 2.4));
      pitch += Math.max(-1, Math.min(1, (0.5 - this.mouseY) * 2.0));
    }
    let throttle = currentThrottle;
    if (this.keys.has('w')) throttle = Math.min(1, throttle + 0.02);
    if (this.keys.has('s')) throttle = Math.max(0, throttle - 0.02);
    if (this.keys.has('shift')) throttle = 1;
    if (this.keys.has('control')) throttle = 0;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      bank: Math.max(-1, Math.min(1, bank)),
      throttle,
    };
  }
}
