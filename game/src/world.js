// Meridian Flight — world: course generation, flight physics, rings,
// collisions, landing and scoring. Fixed-step simulation, deterministic
// for a given seed.
import { COURSE, PLANE, SCORE, STEP, FUEL, DAMAGE, WIND, STRIPS, SORTIES } from './config.js';
import { mulberry32, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_OVER = 8;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_LANDED = 'landed';

/** Build the fixed course for a seed: islands, mountains, clouds, rings. */
export function buildCourse(seed) {
  const rng = mulberry32(seed);
  const islands = [];
  let z = 700;
  while (z < 12500) {
    const w = range(rng, 320, 720);
    islands.push({
      x: range(rng, -260, 260),
      z0: z,
      z1: z + range(rng, 420, 780),
      halfW: w / 2,
      h: range(rng, 55, 210),
      tone: rng(),
    });
    z += range(rng, 850, 1150);
  }
  // The runway island: a wide flat island at the end of the course.
  islands.push({
    x: 0, z0: 12900, z1: 14200, halfW: 260, h: 30, tone: 0.5, runway: true,
  });
  // The refuel strips sit on their own flat islands.
  for (const strip of STRIPS) {
    islands.push({
      x: strip.x, z0: strip.z0 - 120, z1: strip.z1 + 120,
      halfW: 150, h: 24, tone: 0.5, strip: strip.name,
    });
  }

  const mountains = [];
  for (let i = 0; i < 11; i += 1) {
    const mz = 1200 + i * 1150 + range(rng, -150, 150);
    mountains.push({
      x: range(rng, -380, 380),
      z: mz,
      base: range(rng, 130, 260),
      h: range(rng, 260, 540),
      volcano: false,
    });
  }
  // Ember Peak: the smoking volcano that gives the run its name — the
  // tallest cone, dead centre of the course, lava-lit at dawn.
  const volcano = mountains.reduce((a, b) => (a.h > b.h ? a : b));
  volcano.x = 40;
  volcano.h = 560;
  volcano.base = 280;
  volcano.volcano = true;

  const clouds = [];
  for (let i = 0; i < 30; i += 1) {
    clouds.push({
      x: range(rng, -650, 650),
      y: range(rng, 950, 1750),
      z: range(rng, 300, 14000),
      r: range(rng, 60, 170),
    });
  }

  const rings = [];
  for (let i = 0; i < COURSE.rings; i += 1) {
    rings.push({
      x: Math.round(170 * Math.sin(i * 1.35 + 0.6)),
      y: 380 + Math.round(140 * Math.sin(i * 0.9 + 1.2)) + i * 18,
      z: 1500 + i * 1500,
      r: 70,
      taken: false,
    });
  }
  return { islands, mountains, clouds, rings, strips: STRIPS };
}

/** Crosswind at a course position, ft/s, positive pushes right. */
export function windAt(z) {
  return WIND.base * Math.sin(z / 1400) + WIND.gust * Math.sin(z / 520 + 1.7) * 0.4;
}

/** Which sortie the pilot is on, from rings collected. */
export function sortieIndex(rings) {
  let n = 0;
  for (let i = 0; i < SORTIES.length; i += 1) {
    n += SORTIES[i].rings;
    if (rings < n) return i;
  }
  return SORTIES.length - 1;
}

export function freshState() {
  return {
    x: 0,
    alt: 420,
    z: 0,
    heading: 0, // radians, 0 = straight down the course
    speed: 150,
    throttle: 0.7,
    pitch: 0,
    bank: 0,
    vspeed: 0,
    score: 0,
    rings: 0,
    lives: COURSE.lives,
    fuel: FUEL.max,
    damage: 0,
    wind: 0,
    visitedStrips: new Set(),
    time: 0,
    over: false,
    landed: false,
    crashReason: '',
    message: '',
    messageT: 0,
    nearMissGiven: new Set(),
  };
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.course = buildCourse(seed);
    this.state = freshState();
  }

  reset() {
    this.course = buildCourse(this.seed);
    this.state = freshState();
  }

  /** Ground height at (x, z): island tops, runway island, mountain cones, else sea (0). */
  terrainHeight(x, z) {
    let h = 0;
    for (const isl of this.course.islands) {
      if (z >= isl.z0 && z <= isl.z1 && Math.abs(x - isl.x) <= isl.halfW) {
        h = Math.max(h, isl.h);
      }
    }
    for (const m of this.course.mountains) {
      const dx = x - m.x;
      const dz = z - m.z;
      const d = Math.hypot(dx, dz);
      if (d < m.base) h = Math.max(h, m.h * (1 - d / m.base));
    }
    return h;
  }

  nextRing() {
    return this.course.rings.find((r) => !r.taken) ?? null;
  }

  /**
   * Advance the simulation one fixed step.
   * input: { pitch: -1..1, bank: -1..1, throttle: 0..1 }
   * Returns an event bitmask.
   */
  step(dt, input) {
    const s = this.state;
    if (s.over || s.landed) return EVENT_NONE;
    let events = EVENT_NONE;
    s.time += dt;

    // Throttle and speed. Empty tanks mean no power: the plane glides.
    s.throttle = s.fuel > 0 ? input.throttle : 0;
    s.fuel = Math.max(0, s.fuel - (FUEL.drainPerSecond + s.throttle * 0.22) * dt);
    const targetSpeed = PLANE.minSpeed + s.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    s.speed += Math.max(-PLANE.accel, Math.min(PLANE.accel, targetSpeed - s.speed)) * dt;

    // Pitch / bank ease toward the commanded values.
    s.pitch += (input.pitch - s.pitch) * Math.min(1, dt * 6);
    s.bank += (input.bank - s.bank) * Math.min(1, dt * 5);

    // Vertical speed: pitch climbs, stall sinks, drag pulls down at low speed.
    let climb = s.pitch * PLANE.climbRate * (s.speed / PLANE.cruiseSpeed);
    if (s.speed < PLANE.stallSpeed) climb -= PLANE.sinkRate * (1 - s.speed / PLANE.stallSpeed);
    s.vspeed = climb;
    s.alt += climb * dt;

    // Lateral movement from bank; forward movement from speed.
    s.heading += s.bank * PLANE.turnRate * dt * (s.speed / PLANE.cruiseSpeed);
    s.x += Math.sin(s.heading) * s.speed * dt + s.bank * s.speed * 0.5 * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
    // Crosswind pushes the airframe sideways; the pilot must crab into it.
    s.wind = windAt(s.z);
    s.x += s.wind * 0.45 * dt;
    s.x = Math.max(-900, Math.min(900, s.x));
    if (s.alt < 0) s.alt = 0;

    // Ring collection.
    for (const ring of this.course.rings) {
      if (ring.taken) continue;
      if (Math.abs(s.z - ring.z) < 34) {
        const d = Math.hypot(s.x - ring.x, s.alt - ring.y);
        if (d < ring.r) {
          ring.taken = true;
          s.rings += 1;
          s.score += SCORE.ring;
          s.message = `RING ${s.rings}/${COURSE.rings}  +${SCORE.ring}`;
          s.messageT = 2.2;
          events |= EVENT_RING;
        }
      }
    }

    // Near-miss bonus: skimming a mountain peak.
    for (let i = 0; i < this.course.mountains.length; i += 1) {
      const m = this.course.mountains[i];
      if (s.nearMissGiven.has(i)) continue;
      if (Math.abs(s.z - m.z) < 40) {
        const clearance = s.alt - m.h;
        if (clearance > 0 && clearance < 70 && Math.abs(s.x - m.x) < m.base) {
          s.nearMissGiven.add(i);
          s.score += SCORE.nearMiss;
          s.message = `NEAR MISS  +${SCORE.nearMiss}`;
          s.messageT = 1.6;
        }
      }
    }

    // Landing: on the runway strip, slow, gentle, aligned.
    const onRunway =
      s.z >= COURSE.runwayZ0 && s.z <= COURSE.runwayZ1 &&
      Math.abs(s.x - COURSE.runwayX) <= COURSE.runwayHalfWidth + 6;
    const ground = this.terrainHeight(s.x, s.z);

    // Scraping terrain without hitting it wears the airframe.
    if (s.alt - ground > 4 && s.alt - ground < 28) {
      s.damage = Math.min(100, s.damage + DAMAGE.grazePerSecond * dt);
      if (s.damage >= 100) {
        s.over = true;
        s.crashReason = 'Airframe gave out';
        return events | EVENT_OVER;
      }
    }

    // Intermediate strips: touch down gently to refuel and patch damage.
    for (const strip of this.course.strips) {
      if (s.z >= strip.z0 && s.z <= strip.z1 && Math.abs(s.x - strip.x) <= strip.halfW + 4 &&
          s.alt <= ground + 12 && s.speed <= PLANE.landingMaxSpeed && s.vspeed >= -PLANE.landingMaxSink) {
        const first = !s.visitedStrips.has(strip.name);
        s.visitedStrips.add(strip.name);
        s.fuel = FUEL.refill;
        s.damage = Math.max(0, s.damage - DAMAGE.repairOnStrip);
        if (first) s.score += SCORE.strip;
        s.message = `${strip.name} STRIP — REFUELLED${first ? `  +${SCORE.strip}` : ''} · DAMAGE PATCHED`;
        s.messageT = 3;
        // Hop back into the air just past the strip so the run continues.
        s.z = strip.z1 + 60;
        s.alt = Math.max(s.alt, ground + 120);
        s.speed = Math.max(s.speed, 130);
      }
    }
    if (onRunway && s.alt <= ground + 12 && s.speed <= PLANE.landingMaxSpeed && s.vspeed >= -PLANE.landingMaxSink) {
      s.landed = true;
      const timeBonus = Math.max(0, Math.round((COURSE.timeLimit - s.time) * SCORE.timeBonusPerSecond));
      s.score += SCORE.landing + timeBonus;
      s.message = `LANDED! +${SCORE.landing}  TIME BONUS +${timeBonus}`;
      s.messageT = 5;
      return events | EVENT_LANDED;
    }

    // Crash: terrain, mountain, sea, or flying past the course.
    if (s.alt <= ground + 4 || s.z >= COURSE.length + 200) {
      s.lives -= 1;
      s.damage = Math.min(100, s.damage + DAMAGE.crash);
      s.crashReason = s.z >= COURSE.length + 200 ? 'Flew past the airfield' : 'Terrain impact';
      if (s.lives <= 0 || s.damage >= 100) {
        s.over = true;
        if (s.damage >= 100) s.crashReason = 'Airframe destroyed';
        return events | EVENT_CRASH | EVENT_OVER;
      }
      // Respawn mid-course with a speed penalty, rings kept.
      s.x = 0;
      s.alt = 750;
      s.z = Math.max(0, s.z - 1500);
      s.speed = 140;
      s.heading = 0;
      s.pitch = 0;
      s.bank = 0;
      s.message = `CRASH — ${s.crashReason}. ${s.lives} ${s.lives === 1 ? 'life' : 'lives'} left`;
      s.messageT = 3;
      return events | EVENT_CRASH;
    }

    // Time up.
    if (s.time >= COURSE.timeLimit) {
      s.over = true;
      s.crashReason = 'Out of time';
      return events | EVENT_OVER;
    }

    if (s.messageT > 0) s.messageT -= dt;
    return events;
  }
}
