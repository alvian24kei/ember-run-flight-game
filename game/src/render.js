// Meridian Flight — renderer: pseudo-3D chase view over sea, islands and
// mountains, runway, rings, the aircraft, cockpit instruments and HUD.
// All art is drawn in code; no external assets, no network.
import { COURSE, PALETTE, VIEW, FONT, GAME_NAME, GAME_TAGLINE, SORTIES } from './config.js';
import { sortieIndex } from './world.js';

const CX = VIEW.width / 2;

function project(cam, px, py, pz) {
  const depth = pz - cam.z;
  if (depth < 8) return null;
  const scale = VIEW.focal / depth;
  return {
    x: CX + (px - cam.x) * scale,
    y: VIEW.horizon - (py - cam.y) * scale,
    s: scale,
    depth,
  };
}

function islandGroundHeight(course, x, z) {
  let h = 0;
  for (const isl of course.islands) {
    if (z >= isl.z0 && z <= isl.z1 && Math.abs(x - isl.x) <= isl.halfW) h = Math.max(h, isl.h);
  }
  return h;
}

function drawLabel(ctx, cam, x, y, z, text) {
  const p = project(cam, x, y, z);
  if (!p || p.y < 20 || p.y > 560 || p.s < 0.12) return; // skip far-away labels
  ctx.font = `700 ${Math.max(11, Math.min(16, 13 * p.s + 8))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,16,24,0.6)';
  const w = ctx.measureText(text).width + 12;
  ctx.fillRect(p.x - w / 2, p.y - 13, w, 18);
  ctx.fillStyle = '#ffe9c4';
  ctx.fillText(text, p.x, p.y);
  ctx.textAlign = 'left';
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

export function render(ctx, world, screen, best) {
  const s = world.state;
  const course = world.course;
  const W = VIEW.width;
  const H = VIEW.height;
  const cam = { x: s.x, y: s.alt + 26, z: s.z - 70 };

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.horizon);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.65, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, VIEW.horizon + 2);

  // Low dawn sun, big and orange.
  ctx.beginPath();
  ctx.arc(W - 200, 168, 46, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,178,90,0.95)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 200, 168, 70, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,178,90,0.22)';
  ctx.fill();

  // Sea.
  const sea = ctx.createLinearGradient(0, VIEW.horizon, 0, H);
  sea.addColorStop(0, PALETTE.seaShallow);
  sea.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, VIEW.horizon, W, H - VIEW.horizon);
  // Moving swell lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i += 1) {
    const zz = cam.z + 120 + i * 260 + ((s.z % 260));
    const p = project(cam, 0, 0, zz);
    if (!p) continue;
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(W, p.y);
    ctx.stroke();
  }

  // Clouds (far to near).
  const clouds = [...course.clouds].sort((a, b) => b.z - a.z);
  for (const c of clouds) {
    const p = project(cam, c.x, c.y, c.z);
    if (!p || p.y < -80 || p.y > VIEW.horizon + 40) continue;
    const r = c.r * p.s;
    if (r < 2) continue;
    ctx.fillStyle = PALETTE.cloud;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Islands far to near.
  const islands = [...course.islands].sort((a, b) => b.z1 - a.z1);
  for (const isl of islands) {
    if (isl.z1 < cam.z - 50 || isl.z0 > cam.z + 4200) continue;
    const nearL = project(cam, isl.x - isl.halfW, isl.h, isl.z0);
    const nearR = project(cam, isl.x + isl.halfW, isl.h, isl.z0);
    const farL = project(cam, isl.x - isl.halfW, isl.h, isl.z1);
    const farR = project(cam, isl.x + isl.halfW, isl.h, isl.z1);
    if (!nearL || !nearR || !farL || !farR) continue;
    const top = isl.tone > 0.66 ? PALETTE.sand : isl.tone > 0.33 ? PALETTE.grass : shade(PALETTE.grass, 0.85);
    poly(ctx, [nearL, nearR, farR, farL], top);
    // Front skirt down to the sea.
    const baseL = project(cam, isl.x - isl.halfW, 0, isl.z0);
    const baseR = project(cam, isl.x + isl.halfW, 0, isl.z0);
    if (baseL && baseR) poly(ctx, [nearL, nearR, baseR, baseL], shade(PALETTE.rock, 0.9));
  }

  // Mountains far to near.
  const mountains = [...course.mountains].sort((a, b) => b.z - a.z);
  for (const m of mountains) {
    if (m.z < cam.z - 50 || m.z > cam.z + 4200) continue;
    const baseY = islandGroundHeight(course, m.x, m.z);
    const apex = project(cam, m.x, baseY + m.h, m.z);
    const left = project(cam, m.x - m.base, baseY, m.z);
    const right = project(cam, m.x + m.base, baseY, m.z);
    if (!apex || !left || !right) continue;
    poly(ctx, [left, apex, right], shade(PALETTE.rock, 1.05));
    // Snow cap — or, on Ember Peak, a lava-lit crater and drifting smoke.
    if (m.volcano) {
      const crater = { x: apex.x, y: apex.y + (right.y - apex.y) * 0.12 };
      ctx.save();
      ctx.shadowColor = PALETTE.lava;
      ctx.shadowBlur = 22;
      ctx.fillStyle = PALETTE.lava;
      ctx.beginPath();
      ctx.ellipse(crater.x, crater.y, Math.max(4, (right.x - left.x) * 0.05), Math.max(2, (right.y - apex.y) * 0.05), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      for (let i = 0; i < 4; i += 1) {
        const drift = ((s.time * 12 + i * 46) % 180) - 40;
        ctx.fillStyle = PALETTE.smoke;
        ctx.beginPath();
        ctx.arc(apex.x + drift * 0.4, apex.y - 26 - i * 26 - drift * 0.1, 20 + i * 9, 0, Math.PI * 2);
        ctx.fill();
      }
      drawLabel(ctx, cam, m.x, islandGroundHeight(course, m.x, m.z) + m.h + 90, m.z, 'EMBER PEAK · 1,840 FT');
    } else {
      const capL = { x: left.x + (apex.x - left.x) * 0.72, y: left.y + (apex.y - left.y) * 0.72 };
      const capR = { x: right.x + (apex.x - right.x) * 0.72, y: right.y + (apex.y - right.y) * 0.72 };
      poly(ctx, [capL, apex, capR], PALETTE.snow);
    }
  }

  // Intermediate strips: short runway quads on their islands, with labels.
  for (const strip of course.strips) {
    const s0 = project(cam, strip.x - strip.halfW, 26, strip.z0);
    const s1 = project(cam, strip.x + strip.halfW, 26, strip.z0);
    const s2 = project(cam, strip.x + strip.halfW, 26, strip.z1);
    const s3 = project(cam, strip.x - strip.halfW, 26, strip.z1);
    if (s0 && s1 && s2 && s3) {
      poly(ctx, [s0, s1, s2, s3], PALETTE.runway);
      drawLabel(ctx, cam, strip.x, 60, (strip.z0 + strip.z1) / 2, `${strip.name} STRIP · REFUEL`);
    }
  }
  drawLabel(ctx, cam, 0, 90, (COURSE.runwayZ0 + COURSE.runwayZ1) / 2, 'MERIDIAN FIELD');

  // Runway strip on the runway island.
  const rz0 = COURSE.runwayZ0;
  const rz1 = COURSE.runwayZ1;
  const rw = COURSE.runwayHalfWidth;
  const strip = [
    project(cam, -rw, 32, rz0), project(cam, rw, 32, rz0),
    project(cam, rw, 32, rz1), project(cam, -rw, 32, rz1),
  ];
  if (strip.every(Boolean)) {
    poly(ctx, strip, PALETTE.runway);
    // Centreline dashes.
    ctx.fillStyle = PALETTE.runwayMark;
    for (let z = rz0 + 120; z < rz1 - 60; z += 260) {
      const a = project(cam, -3, 33, z);
      const b = project(cam, 3, 33, z + 130);
      if (a && b) ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 2, Math.abs(b.y - a.y) + 2);
    }
    // Threshold bars.
    for (const zt of [rz0 + 30, rz1 - 60]) {
      const a = project(cam, -rw + 4, 33, zt);
      const b = project(cam, rw - 4, 33, zt + 40);
      if (a && b) ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y) + 3);
    }
  }

  // Rings far to near, with a guide line down to the ground.
  const rings = [...course.rings].sort((a, b) => b.z - a.z);
  for (const ring of rings) {
    if (ring.taken) continue;
    const c = project(cam, ring.x, ring.y, ring.z);
    if (!c) continue;
    const r = Math.max(3, ring.r * c.s);
    const g = project(cam, ring.x, 0, ring.z);
    if (g) {
      ctx.strokeStyle = 'rgba(255,210,63,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = PALETTE.ringGlow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,210,63,0.10)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Next-ring pointer.
  const next = world.nextRing();
  if (next && screen === 'play') {
    const c = project(cam, next.x, next.y, next.z);
    if (c && (c.x < 60 || c.x > W - 60 || c.y < 60 || c.y > 520)) {
      const ax = Math.max(40, Math.min(W - 40, c.x));
      const ay = Math.max(50, Math.min(500, c.y));
      ctx.fillStyle = PALETTE.ring;
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`◈ NEXT RING ${Math.max(0, Math.round(next.z - s.z))}m`, ax, ay - 14);
    }
  }

  drawAircraft(ctx, s);
  drawHud(ctx, s, world, screen);
  drawPanel(ctx, s, world);
  if (screen === 'title') drawTitle(ctx, best);
  if (screen === 'paused') drawOverlay(ctx, 'PAUSED', 'Press P to resume · R to restart');
  if (screen === 'over') drawOverlay(ctx, 'FLIGHT OVER', `${s.crashReason} · Score ${s.score} · Best ${Math.max(best, s.score)} — press R to fly again`);
  if (screen === 'landed') drawOverlay(ctx, 'TOUCHDOWN!', `${s.message} · Score ${s.score} · Best ${Math.max(best, s.score)} — press R to fly again`);
  if (s.messageT > 0 && screen === 'play') {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(s.message, CX, 150);
  }
}

function drawAircraft(ctx, s) {
  const px = CX;
  const py = 468 - s.pitch * 46;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-s.bank * 0.55);
  // Engine glow.
  if (s.throttle > 0.55) {
    const glow = ctx.createRadialGradient(0, 26, 2, 0, 26, 26 + s.throttle * 22);
    glow.addColorStop(0, 'rgba(255,180,60,0.9)');
    glow.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 26, 26 + s.throttle * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wings.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-14, 6); ctx.lineTo(-118, 34); ctx.lineTo(-112, 44); ctx.lineTo(-12, 20); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 6); ctx.lineTo(118, 34); ctx.lineTo(112, 44); ctx.lineTo(12, 20); ctx.closePath();
  ctx.fill();
  // Tail.
  ctx.fillStyle = PALETTE.planeAccent;
  ctx.beginPath();
  ctx.moveTo(-8, 22); ctx.lineTo(-26, 46); ctx.lineTo(-14, 48); ctx.lineTo(0, 30); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 22); ctx.lineTo(26, 46); ctx.lineTo(14, 48); ctx.lineTo(0, 30); ctx.closePath();
  ctx.fill();
  // Fuselage.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.quadraticCurveTo(14, -30, 12, 8);
  ctx.quadraticCurveTo(10, 34, 0, 40);
  ctx.quadraticCurveTo(-10, 34, -12, 8);
  ctx.quadraticCurveTo(-14, -30, 0, -58);
  ctx.fill();
  // Canopy.
  ctx.fillStyle = PALETTE.planeGlass;
  ctx.beginPath();
  ctx.ellipse(0, -28, 7, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Accent stripe.
  ctx.fillStyle = PALETTE.planeAccent;
  ctx.fillRect(-12, 2, 24, 5);
  ctx.restore();
}

function drawHud(ctx, s, world, screen) {
  const W = VIEW.width;
  ctx.textAlign = 'left';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.fillText(`${Math.round(s.speed)} KT`, 22, 46);
  ctx.fillText(`${Math.round(s.alt)} FT`, 22, 84);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('AIRSPEED', 24, 60);
  ctx.fillText('ALTITUDE', 24, 98);
  ctx.shadowBlur = 0;

  // Compass strip.
  const hdg = Math.round(((s.heading * 180) / Math.PI) % 360 + 360) % 360;
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(CX - 170, 14, 340, 34);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${String(hdg).padStart(3, '0')}°`, CX, 37);
  ctx.strokeStyle = PALETTE.muted;
  ctx.beginPath();
  ctx.moveTo(CX, 48);
  ctx.lineTo(CX - 6, 58);
  ctx.lineTo(CX + 6, 58);
  ctx.closePath();
  ctx.fillStyle = PALETTE.ring;
  ctx.fill();
  // Wind indicator under the compass.
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`WIND ${s.wind >= 0 ? '→' : '←'} ${Math.abs(Math.round(s.wind))} KT`, CX, 76);

  // Score block.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(`${s.score}`, W - 22, 44);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`RINGS ${s.rings}/${COURSE.rings}   TIME ${Math.max(0, Math.ceil(COURSE.timeLimit - s.time))}s`, W - 22, 66);
  ctx.fillText(`LIVES ${'● '.repeat(Math.max(0, s.lives)).trim()}`, W - 22, 86);
  ctx.textAlign = 'left';

  // Throttle + vertical speed, left edge.
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(22, 118, 14, 120);
  ctx.fillStyle = s.throttle > 0.85 ? PALETTE.warn : PALETTE.good;
  ctx.fillRect(22, 118 + (1 - s.throttle) * 120, 14, s.throttle * 120);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('THR', 22, 254);
  // Fuel and damage bars.
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(22, 264, 130, 11);
  ctx.fillRect(22, 282, 130, 11);
  ctx.fillStyle = s.fuel < 25 ? PALETTE.bad : PALETTE.warn;
  ctx.fillRect(22, 264, Math.max(0, 130 * (s.fuel / 100)), 11);
  ctx.fillStyle = s.damage > 60 ? PALETTE.bad : PALETTE.good;
  ctx.fillRect(22, 282, Math.max(0, 130 * (s.damage / 100)), 11);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText(`FUEL ${Math.round(s.fuel)}%`, 158, 273);
  ctx.fillText(`DMG ${Math.round(s.damage)}%`, 158, 291);
  // Sortie checklist.
  ctx.font = `700 12px ${FONT}`;
  SORTIES.forEach((sortie, i) => {
    const done = sortieIndex(s.rings) > i;
    const current = sortieIndex(s.rings) === i;
    ctx.fillStyle = done ? PALETTE.good : current ? PALETTE.ring : PALETTE.muted;
    ctx.fillText(`${done ? '✓' : current ? '▶' : '·'} ${sortie.name}`, 22, 316 + i * 16);
  });
  ctx.fillStyle = s.vspeed > 0 ? PALETTE.good : s.vspeed < -30 ? PALETTE.bad : PALETTE.text;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(`VS ${s.vspeed >= 0 ? '+' : ''}${Math.round(s.vspeed)}`, 44, 150);
  if (s.speed < 72 && screen === 'play') {
    ctx.fillStyle = PALETTE.bad;
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠ STALL — THROTTLE UP', CX, 120);
    ctx.textAlign = 'left';
  }
}

function drawPanel(ctx, s, world) {
  const W = VIEW.width;
  const H = VIEW.height;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 606, W, H - 606);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 606, W, 3);

  // Artificial horizon.
  const hx = 120;
  const hy = 663;
  const hr = 44;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-s.bank * 0.8);
  ctx.translate(0, s.pitch * 34);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-hr, -hr, hr * 2, hr);
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(-hr, 0, hr * 2, hr);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-hr, 0);
  ctx.lineTo(hr, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, hy + hr + 14);

  // Centre: current sortie and next objective.
  const next = world.nextRing();
  const cur = SORTIES[sortieIndex(s.rings)];
  ctx.fillStyle = PALETTE.ring;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(cur.name, CX, 640);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(next ? `Next ring ${Math.max(0, Math.round(next.z - s.z))} m ahead — land on KORA / EMBER strips to refuel` : 'All rings done — land at MERIDIAN FIELD', CX, 664);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('Arrows / WASD fly · W/S throttle · Mouse steers · P pause · M sound', CX, 684);

  // Right: big alt / speed readouts.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText(`${Math.round(s.alt)} FT`, W - 120, 652);
  ctx.fillText(`${Math.round(s.speed)} KT`, W - 120, 684);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('ALT', W - 190, 652);
  ctx.fillText('SPD', W - 190, 684);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, best) {
  ctx.fillStyle = 'rgba(8,14,22,0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ring;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(GAME_NAME.toUpperCase(), CX, 180);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(GAME_TAGLINE, CX, 224);
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('SORTIE 1 · KORA ATOLL — SORTIE 2 · EMBER PEAK — SORTIE 3 · MERIDIAN FIELD', CX, 262);
  ctx.fillText('Fuel, damage and crosswind matter: land on the strips to refuel and patch up', CX, 290);
  ctx.fillText('Arrows or WASD to fly · W / S throttle · Mouse steers · P pause', CX, 318);
  ctx.fillText('3 lives · 8 rings · 300 seconds · mind the volcano', CX, 346);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText('Press ENTER or click to fly', CX, 400);
  if (best > 0) {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(`Best score: ${best}`, CX, 440);
  }
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, title, sub) {
  ctx.fillStyle = 'rgba(8,14,22,0.5)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(title, CX, 300);
  ctx.font = `600 19px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(sub, CX, 344);
  ctx.textAlign = 'left';
}
