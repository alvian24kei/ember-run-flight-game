// Screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (aim at the next ring, climb out of terrain, keep the
// throttle up), so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER, EVENT_LANDED } from './world.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const END_LIMIT_SECONDS = 600;

/** Steer toward the next ring, or land on the runway once the rings are done. */
function autopilot(world) {
  const s = world.state;
  const ring = world.nextRing();
  if (!ring) {
    // Final approach: line up on the runway and descend.
    const wantAlt = s.z < 12000 ? 420 : Math.max(34, 420 - (s.z - 12000) * 0.4);
    return {
      pitch: Math.max(-1, Math.min(1, (wantAlt - s.alt) / 180)),
      bank: Math.max(-1, Math.min(1, -s.x / 140 - s.wind * 0.02)),
      throttle: s.z > 12800 ? 0.42 : 0.72,
    };
  }
  const tx = ring.x;
  const ty = ring.y;
  const dx = tx - s.x;
  let wantAlt;
  if (ring.z - s.z < 1400) {
    // Close in: fly the ring itself, clearing only terrain at the ring.
    wantAlt = Math.max(ty, world.terrainHeight(tx, ring.z) + 130);
  } else {
    const groundAhead = world.terrainHeight(s.x, s.z + s.speed * 2.5);
    wantAlt = Math.max(ty, groundAhead + 230);
  }
  const pitch = Math.max(-1, Math.min(1, (wantAlt - s.alt) / 180));
  const bank = Math.max(-1, Math.min(1, dx / 140 - s.wind * 0.02));
  return { pitch, bank, throttle: 0.78 };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, autopilot(world));
    return { screen: 'title', best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world));
    if (events & EVENT_OVER) break;
    if (events & EVENT_LANDED) break;
  }
  if (world.state.landed) return { screen: 'landed', best: world.state.score };
  if (world.state.over) return { screen: 'over', best: world.state.score };
  return { screen: 'play', best: world.state.score };
}
