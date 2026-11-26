// Ember Run — entry point: game loop, screens, shot staging for screenshots.
import { VIEW, STEP, BEST_KEY, COURSE } from './config.js';
import { World, EVENT_RING, EVENT_CRASH, EVENT_LANDED, EVENT_OVER } from './world.js';
import { render } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
const world = new World(1);
const input = new Input(canvas);
const sound = new Sound();

let screen = 'title';
let best = 0;
try {
  best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
} catch {
  best = 0;
}

function resize() {
  // Fixed 1280x720 presentation: the backing store and the displayed size
  // are the same, so screenshots are exactly 1280x720 with no letterbox.
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  canvas.style.width = `${VIEW.width}px`;
  canvas.style.height = `${VIEW.height}px`;
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startGame() {
  if (screen === 'play') return;
  sound.ensure();
  world.reset();
  screen = 'play';
  announce('Flying. Thread the golden rings, then land at Meridian Field.');
}

input.onStart = () => {
  if (screen === 'title' || screen === 'over' || screen === 'landed') startGame();
};
input.onPause = () => {
  if (screen === 'play') screen = 'paused';
  else if (screen === 'paused') screen = 'play';
};
input.onRestart = () => startGame();
input.onMute = () => sound.toggleMute();

// Screenshot scenes: ?shot=start|play|end — staged synchronously at load,
// so a headless capture sees the finished frame.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
let shotScreen = null;
if (shot) {
  const staged = stageShot(shot, world);
  shotScreen = staged.screen;
  best = staged.best;
  screen = shotScreen;
  render(ctx, world, screen, best);
} else {
  render(ctx, world, screen, best);
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (shot || screen === 'paused') {
    if (!shot) render(ctx, world, screen, best);
    return;
  }
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    if (screen === 'play') {
      const s = world.state;
      const events = world.step(STEP, input.read(s.throttle));
      sound.setEngine(s.throttle, s.speed);
      if (events & EVENT_RING) sound.ring();
      if (events & EVENT_CRASH) sound.crash();
      if (events & EVENT_LANDED) {
        sound.land();
        screen = 'landed';
        best = Math.max(best, s.score);
        try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode */ }
        announce(`Landed. Score ${s.score}.`);
      }
      if (events & EVENT_OVER) {
        screen = 'over';
        best = Math.max(best, s.score);
        try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode */ }
        announce(`Flight over. ${s.crashReason}. Score ${s.score}.`);
      }
    }
  }
  render(ctx, world, screen, best);
}
if (!shot) requestAnimationFrame(frame);
