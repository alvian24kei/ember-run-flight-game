// Meridian Flight — tuning numbers, palette and course constants in one place.
// Original game written for the make.fun "best flight game" bounty.
export const VIEW = { width: 1280, height: 720, horizon: 300, focal: 760 };

export const STEP = 1 / 60;

export const COURSE = {
  length: 14200,
  rings: 8,
  runwayZ0: 13100,
  runwayZ1: 14000,
  runwayX: 0,
  runwayHalfWidth: 30,
  islandHalfWidth: 250,
  timeLimit: 300,
  lives: 3,
};

export const PLANE = {
  minSpeed: 55,
  maxSpeed: 265,
  cruiseSpeed: 170,
  accel: 55,
  climbRate: 95, // ft/s at full pitch up
  sinkRate: 70, // ft/s when stalled
  turnRate: 0.75, // lateral speed factor per unit bank
  maxBank: 1,
  maxPitch: 1,
  stallSpeed: 72,
  landingMaxSpeed: 185,
  landingMaxSink: 45,
};

export const GAME_NAME = 'Ember Run';
export const GAME_TAGLINE = 'Volcano rescue at dawn: three sorties, five airstrips, one smoking peak';

// Three sorties, each with a named destination airstrip. Rings are grouped
// into sorties so the HUD can show a real mission list, not just a counter.
export const SORTIES = [
  { name: 'SORTIE 1 · KORA ATOLL', rings: 3, strip: 'KORA' },
  { name: 'SORTIE 2 · EMBER PEAK', rings: 3, strip: 'EMBER' },
  { name: 'SORTIE 3 · MERIDIAN FIELD', rings: 2, strip: 'MERIDIAN' },
];

// Intermediate landing strips: touch down to refuel and patch damage.
export const STRIPS = [
  { name: 'KORA', x: -40, z0: 4300, z1: 5100, halfW: 34 },
  { name: 'EMBER', x: 60, z0: 8800, z1: 9600, halfW: 34 },
];

export const FUEL = {
  max: 100,
  drainPerSecond: 0.16, // plus throttle * 0.22 /s at full power
  refill: 100,
};

export const DAMAGE = {
  crash: 34,
  grazePerSecond: 2.5, // scraping terrain without crashing
  repairOnStrip: 25,
};

export const WIND = {
  // Crosswind (lateral push, ft/s) varies along the course; shown on the HUD.
  base: 14,
  gust: 22,
};

export const SCORE = { ring: 250, landing: 1000, nearMiss: 50, timeBonusPerSecond: 5, strip: 150 };

export const PALETTE = {
  skyTop: '#3a2350',
  skyMid: '#b4503f',
  skyHorizon: '#f2a35e',
  seaDeep: '#1d2f52',
  seaShallow: '#3d6a8a',
  sand: '#e8d9a0',
  grass: '#5da24a',
  rock: '#6e5a4e',
  lava: '#ff6a1f',
  smoke: 'rgba(70,60,70,0.55)',
  snow: '#f4f8fb',
  cloud: 'rgba(255,214,180,0.8)',
  runway: '#3a3f46',
  runwayMark: '#f5f5f0',
  ring: '#ffd23f',
  ringGlow: '#ff9d00',
  planeBody: '#e8ecf1',
  planeAccent: '#e0533d',
  planeGlass: '#1c2f45',
  panel: '#141a22',
  panelEdge: '#2c3644',
  gauge: '#0b0f14',
  text: '#f2f5f7',
  muted: '#c8b8a8',
  good: '#57d977',
  warn: '#ffb02e',
  bad: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'ember-run.best';
