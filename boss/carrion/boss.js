// CARRION · BOSS 模块
// 一团由多张头颅、巨口和触手组成的血肉。公共 Runner 负责武器、血条、入场和结算。

export const meta = {
  id: 'carrion',
  name: 'CARRION',
  maxHp: 650,
  music: './boss/carrion/boss-theme.ogg',
  interfaceVersion: 1,
  face: false,
  desc: '由头颅与触手组成的血肉。AK 撕碎头颅，狙击枪打断触手根部。',
  winToast: 'CARRION 崩解成一滩血肉',
  loseToast: 'CARRION 吞没了马林鱼……'
};

export function createBossModule(api) {
  const {
    ctx, W, H, clamp, lerp, rand, choice, TAU,
    fillPoly, pxLine, fillCircle, angleLerp, addParticle, addText,
    segPointDist, Sound, BOSS_FISH, BOSS_CONTACT, endBoss, damageMarlin, now
  } = api;

  const HEAD_DEFS = [
    { lx: -38, ly: -50, r: 25, rot: -0.22 },
    { lx: 28, ly: -58, r: 23, rot: 0.30 },
    { lx: -66, ly: -12, r: 22, rot: -0.58 },
    { lx: 56, ly: -18, r: 23, rot: 0.50 },
    { lx: -4, ly: -20, r: 28, rot: 0.02 }
  ];
  const HEAD_HP = 130;
  const TENTACLE_HP = 60;
  const PHASE2_TIME = 10;
  const ATTACK_DURATION = 4.2;

  function ell(x, y, a, rx, ry, color, ox, oy) {
    const pts = [];
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < 12; i++) {
      const t = i / 12 * TAU;
      const ex = Math.cos(t) * rx + (ox || 0);
      const ey = Math.sin(t) * ry + (oy || 0);
      pts.push([x + ca * ex - sa * ey, y + sa * ex + ca * ey]);
    }
    fillPoly(ctx, pts, color);
  }

  function local(x, y, a, lx, ly) {
    const ca = Math.cos(a), sa = Math.sin(a);
    return { x: x + ca * lx - sa * ly, y: y + sa * lx + ca * ly };
  }

  function create() {
    const b = {
      x: 78, y: 236, angle: 0,
      hp: 0, maxHp: 0,
      reveal: 0, flash: 0, deathT: 0,
      attack: null, attackCd: 7,
      enraged: false, phase: 1, enrageT: 0,
      tentacles: [], contactCd: 0,
      heads: []
    };
    b.angle = Math.atan2(BOSS_FISH.y - b.y, BOSS_FISH.x - b.x);
    b.heads = HEAD_DEFS.map((d, i) => ({
      id: i, lx: d.lx, ly: d.ly, r: d.r, rot: d.rot,
      hp: HEAD_HP, maxHp: HEAD_HP, dead: false,
      open: 0, mouthT: rand(0, TAU), x: 0, y: 0
    }));
    b.maxHp = b.heads.reduce((s, h) => s + h.maxHp, 0);
    b.hp = b.maxHp;
    syncHeads(b);
    return b;
  }

  function headPos(b, h) {
    return local(b.x, b.y, b.angle, h.lx, h.ly);
  }

  function syncHeads(b) {
    for (const h of b.heads) {
      const p = headPos(b, h);
      h.x = p.x;
      h.y = p.y;
      h.mouthT += 0.016;
      if (h.dead) h.open = 0;
      else if (b.phase === 2) h.open = 1;
      else if (b.attack && b.attack.head === h) h.open = 1;
      else h.open = Math.max(0, h.open - 0.03);
    }
  }

  function aliveHeads(b) {
    return b.heads.filter(h => !h.dead);
  }

  function allHeadsDead(b) {
    return b.heads.every(h => h.dead);
  }

  function recomputeHp(b) {
    b.hp = b.heads.reduce((s, h) => s + Math.max(0, h.hp), 0);
  }

  function chooseAttackHead(b) {
    const alive = aliveHeads(b).filter(h => h.hp > 0);
    return alive.length ? choice(alive) : null;
  }

  function startAttack(b) {
    const h = chooseAttackHead(b);
    if (!h) return;
    const hp = headPos(b, h);
    b.attackCd = 7;
    b.attack = {
      head: h,
      t: 0,
      dur: ATTACK_DURATION,
      root: { x: hp.x + Math.cos(b.angle) * 24, y: hp.y + Math.sin(b.angle) * 24, r: 15 },
      points: []
    };
    h.open = 1;
    Sound.bossRoar();
    api.game.shake = Math.max(api.game.shake, 8);
  }

  function failAttack(b) {
    if (!b.attack) return;
    b.attack = null;
    Sound.bossRoar();
    api.game.shake = Math.max(api.game.shake, 13);
    damageMarlin(0.49);
    addText(BOSS_FISH.x, BOSS_FISH.y - 22, '49%', '#ff8b6a', 2);
    b.attackCd = 6.5;
  }

  function killHead(b, h, bySniper) {
    if (!h || h.dead) return;
    h.dead = true;
    h.hp = 0;
    h.open = 0;
    if (b.attack && b.attack.head === h) b.attack = null;
    b.attackCd = 6;
    recomputeHp(b);
    Sound.bossDeath();
    api.game.shake = Math.max(api.game.shake, bySniper ? 10 : 6);
    addText(h.x, h.y - 18, bySniper ? '处决' : '头颅破碎', '#ffb18a', 1);
    if (allHeadsDead(b)) endBoss(true);
  }

  function startEnrage(b) {
    if (b.enraged) return;
    b.enraged = true;
    b.phase = 2;
    b.enrageT = PHASE2_TIME;
    b.attack = null;
    b.tentacles = aliveHeads(b).map(h => ({
      head: h, hp: TENTACLE_HP, maxHp: TENTACLE_HP,
      dead: false, phase: rand(0, TAU), points: []
    }));
    for (const h of b.heads) if (!h.dead) h.open = 1;
    Sound.bossRoar();
    api.game.shake = Math.max(api.game.shake, 16);
    addText(b.x, b.y - 90, '全部张开', '#ff8b6a', 2);
  }

  function endEnrage(b, timedOut) {
    if (timedOut) {
      damageMarlin(0.49);
      addText(BOSS_FISH.x, BOSS_FISH.y - 22, '49%', '#ff8b6a', 2);
    }
    for (const h of b.heads) h.open = 0;
    b.tentacles = [];
    b.phase = 1;
    b.enrageT = 0;
    b.attackCd = 6;
    Sound.bossRoar();
    api.game.shake = Math.max(api.game.shake, 10);
  }

  function computeTentacle(b, t) {
    const hp = headPos(b, t.head);
    const dirX = Math.cos(b.angle), dirY = Math.sin(b.angle);
    const px = -dirY, py = dirX;
    t.points = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      const reach = 22 + f * 92;
      const sway = Math.sin(f * 4.2 + t.phase + now() * 1.7) * (24 * (1 - f * 0.35));
      t.points.push({
        x: hp.x + dirX * reach + px * sway,
        y: hp.y + dirY * reach + py * sway
      });
    }
  }

  function updateTentacles(b) {
    for (const t of b.tentacles) if (!t.dead) computeTentacle(b, t);
  }

  function update(b, dt) {
    b.flash = Math.max(0, b.flash - dt);
    b.contactCd = Math.max(0, b.contactCd - dt);
    b.reveal = Math.min(1, b.reveal + dt * 1.2);

    const desired = Math.atan2(BOSS_FISH.y - b.y, BOSS_FISH.x - b.x);
    b.angle = angleLerp(b.angle, desired, 1 - Math.exp(-dt * 0.5));
    const speed = b.phase === 2 ? 2.6 : 1.45;
    b.x += Math.cos(b.angle) * speed * dt;
    b.y += Math.sin(b.angle) * speed * dt;
    b.x = clamp(b.x, 60, W - 30);
    b.y = clamp(b.y, 80, H - 20);
    syncHeads(b);

    if (b.phase === 2) {
      b.enrageT -= dt;
      updateTentacles(b);
      const armsLeft = b.tentacles.some(t => !t.dead);
      if (!armsLeft) endEnrage(b, false);
      else if (b.enrageT <= 0) endEnrage(b, true);
    } else if (b.attack) {
      b.attack.t += dt;
      const hp = headPos(b, b.attack.head);
      b.attack.root.x = hp.x + Math.cos(b.angle) * 24;
      b.attack.root.y = hp.y + Math.sin(b.angle) * 24;
      if (b.attack.t >= b.attack.dur) failAttack(b);
    } else {
      b.attackCd -= dt;
      if (b.attackCd <= 0) startAttack(b);
    }

    if (b.phase === 1 && b.hp <= b.maxHp * 0.5 && !b.enraged) startEnrage(b);

    if (b.contactCd <= 0 && Math.hypot(b.x - BOSS_FISH.x, b.y - BOSS_FISH.y) < 68) {
      damageMarlin(0.49);
      b.contactCd = 5;
      b.x -= Math.cos(b.angle) * 80;
      b.y -= Math.sin(b.angle) * 80;
      Sound.bossRoar();
      api.game.shake = Math.max(api.game.shake, 14);
    }
  }

  function hitTest(b, p) {
    if (b.attack) {
      const r = b.attack.root;
      if (segPointDist(r.x, r.y, p.px, p.py, p.x, p.y) < r.r) {
        return { kind: 'root', head: b.attack.head, x: r.x, y: r.y };
      }
    }
    if (b.phase === 2) {
      for (const t of b.tentacles) {
        if (t.dead) continue;
        for (let i = 0; i < t.points.length - 1; i++) {
          const a = t.points[i], c = t.points[i + 1];
          if (segPointDist(a.x, a.y, p.px, p.py, p.x, p.y) < 11) {
            return { kind: 'tentacle', tentacle: t, x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
          }
        }
      }
      return null;
    }
    for (const h of b.heads) {
      if (h.dead) continue;
      if (segPointDist(h.x, h.y, p.px, p.py, p.x, p.y) < h.r) {
        return { kind: 'head', head: h, x: h.x, y: h.y };
      }
    }
    return null;
  }

  function applyHit(b, p, hit) {
    const ak = p.weapon === 'rifle';
    const sniper = p.weapon === 'sniper';
    if (!ak && !sniper) {
      for (let i = 0; i < 5; i++) {
        addParticle(hit.x, hit.y, rand(-24, 24), rand(-24, 24), rand(0.15, 0.4),
          choice(['#8b3a34', '#d08b70', '#efe0c4']), 1, 20, 0.95);
      }
      return;
    }
    const damage = ak ? 7 : 14;
    let flashText = ak ? '-7' : '-14';
    b.flash = 0.14;
    api.game.shake = Math.max(api.game.shake, ak ? 2.2 : 6);
    addParticle(hit.x, hit.y, rand(-30, 30), rand(-30, 30), rand(0.2, 0.5),
      choice(['#b53630', '#7a1720', '#f0d9b0']), 2, 20, 0.94);

    if (hit.kind === 'root') {
      if (sniper) {
        killHead(b, hit.head, true);
        flashText = '处决';
      } else {
        hit.head.hp = Math.max(0, hit.head.hp - damage);
        if (hit.head.hp <= 0) killHead(b, hit.head, false);
      }
    } else if (hit.kind === 'head') {
      hit.head.hp = Math.max(0, hit.head.hp - damage);
      if (hit.head.hp <= 0) killHead(b, hit.head, false);
    } else if (hit.kind === 'tentacle') {
      hit.tentacle.hp = Math.max(0, hit.tentacle.hp - damage);
      if (hit.tentacle.hp <= 0) {
        hit.tentacle.dead = true;
        Sound.bossDeath();
        api.game.shake = Math.max(api.game.shake, 5);
      }
    }

    recomputeHp(b);
    const away = Math.atan2(b.y - BOSS_FISH.y, b.x - BOSS_FISH.x);
    b.x += Math.cos(away) * (ak ? 0.45 : 1.1);
    b.y += Math.sin(away) * (ak ? 0.45 : 1.1);
    addText(hit.x, hit.y - 12, flashText, ak ? '#ffd9a0' : '#e7f4ff', 1);
    if (ak) Sound.bossHit(); else Sound.bossKnock();
    if (allHeadsDead(b)) endBoss(true);
    else if (b.phase === 1 && b.hp <= b.maxHp * 0.5 && !b.enraged) startEnrage(b);
  }

  function updateShots(dt) {
    const g = api.game;
    if (!g || !g.boss) return;
    const b = g.boss;
    for (let i = g.bossShots.length - 1; i >= 0; i--) {
      const p = g.bossShots[i];
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (Math.random() < 0.3) {
        addParticle(p.x, p.y, -p.vx * 0.03 + rand(-5, 5), -p.vy * 0.03 + rand(-5, 5),
          rand(0.15, 0.35), choice(['#d88a62', '#b53630', '#efe0c4']), 1, 0, 0.96);
      }
      const hit = hitTest(b, p);
      if (hit) {
        applyHit(b, p, hit);
        g.bossShots.splice(i, 1);
        continue;
      }
      if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
        g.bossShots.splice(i, 1);
      }
    }
  }

  function pointHit(x, y) {
    const b = api.game && api.game.boss;
    if (!b) return false;
    if (b.attack) {
      const r = b.attack.root;
      if (Math.hypot(x - r.x, y - r.y) < r.r + 5) return true;
    }
    if (b.phase === 2) {
      for (const t of b.tentacles) {
        if (t.dead) continue;
        for (let i = 0; i < t.points.length - 1; i++) {
          const a = t.points[i], c = t.points[i + 1];
          if (segPointDist(x, y, a.x, a.y, c.x, c.y) < 13) return true;
        }
      }
      return false;
    }
    for (const h of b.heads) {
      if (!h.dead && Math.hypot(x - h.x, y - h.y) < h.r + 3) return true;
    }
    return false;
  }

  function updateEnding(b, dt, outcome) {
    b.deathT += dt;
    if (outcome === 'win') {
      b.y += dt * 14;
      b.reveal = Math.max(0, 1 - b.deathT / 2.6);
      if (Math.random() < dt * 26) {
        addParticle(b.x + rand(-70, 70), b.y + rand(-60, 50), rand(-20, 20), rand(-40, 10),
          rand(0.3, 1.2), choice(['#8e2026', '#4b0e14', '#d7b28e']), 2, 12, 0.95);
      }
    } else {
      b.x += Math.cos(b.angle) * 2.2 * dt;
      b.y += Math.sin(b.angle) * 2.2 * dt;
      b.reveal = Math.max(0.4, b.reveal);
    }
  }

  // ---------- 绘制 ----------
  function drawTentacle(points, width, color, highlight, dark) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], c = points[i + 1];
      pxLine(ctx, a.x, a.y, c.x, c.y, dark || '#190507', width + 4);
      pxLine(ctx, a.x, a.y, c.x, c.y, color, width);
    }
    if (highlight) {
      for (let i = 0; i < points.length - 1; i += 2) {
        const a = points[i], c = points[i + 1];
        pxLine(ctx, a.x - 1, a.y - 1, c.x - 1, c.y - 1, highlight, 1);
      }
    }
    const tip = points[points.length - 1];
    if (tip) {
      fillCircle(ctx, tip.x, tip.y, width * 0.42, color);
      fillCircle(ctx, tip.x - 1, tip.y - 1, width * 0.2, highlight || color);
    }
  }

  function drawHead(b, h) {
    const open = h.dead ? 0 : clamp(h.open, 0, 1);
    const hit = b.flash > 0;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(b.angle + h.rot);
    const s = h.r / 25;
    ctx.scale(s, s);
    if (h.dead) {
      fillPoly(ctx, [[-24, -16], [20, -20], [30, -4], [22, 16], [-20, 18], [-30, 4]], '#221317');
      fillPoly(ctx, [[-18, -10], [14, -13], [22, -2], [15, 10], [-15, 12], [-22, 2]], '#49352f');
      ctx.fillStyle = '#10080a';
      ctx.fillRect(-12, -2, 26, 3);
      ctx.restore();
      return;
    }
    // 头部血肉与骨甲
    fillPoly(ctx, [[-27, -17], [-12, -25], [10, -23], [25, -13], [30, 1], [22, 16], [2, 23], [-18, 18], [-29, 5]], '#160509');
    fillPoly(ctx, [[-23, -13], [-9, -20], [9, -18], [21, -9], [25, 1], [18, 12], [1, 18], [-15, 14], [-24, 4]], hit ? '#d47a6a' : '#8d2d31');
    fillPoly(ctx, [[-18, -9], [-5, -14], [9, -12], [18, -5], [14, 3], [0, 9], [-14, 6]], '#ad4b44');
    fillPoly(ctx, [[-22, 5], [-8, 1], [8, 2], [20, 7], [14, 14], [-2, 18], [-16, 13]], '#d9c5a0');
    // 黑眼窝
    fillCircle(ctx, 4, -13, 3.2, '#050205');
    fillCircle(ctx, 14, -10, 2.4, '#050205');
    fillCircle(ctx, 4, -13, 1.1, '#c79a62');
    // 口腔：越大越张开
    const jaw = 6 + open * 19;
    fillPoly(ctx, [[8, -4], [24, -4], [31, 1], [27, 8], [12, 10], [5, 3]], '#050205');
    fillPoly(ctx, [[11, 1], [25, 0], [28, 3], [24, 7], [12, 7], [8, 4]], '#2a090d');
    // 上下牙
    for (let i = 0; i < 7; i++) {
      const tx = 10 + i * 2.8;
      fillPoly(ctx, [[tx, -2], [tx + 1.4, -2], [tx + .6, -2 + 3.5 + open * 3]], '#e8dcc3');
      fillPoly(ctx, [[tx, 4 + open * 2], [tx + 1.4, 4 + open * 2], [tx + .6, 4 + open * 2 - 3.5 - open * 2]], '#d8c8aa');
    }
    // 下颚下坠
    fillPoly(ctx, [[7, 7 + jaw], [25, 8 + jaw], [30, 12 + jaw], [20, 18 + jaw], [4, 15 + jaw], [-3, 11 + jaw]], '#1b080a');
    fillPoly(ctx, [[9, 9 + jaw], [24, 10 + jaw], [27, 13 + jaw], [19, 16 + jaw], [6, 14 + jaw], [1, 11 + jaw]], '#b94e45');
    // 血肉纹路
    pxLine(ctx, -20, -8, -12, -15, '#5f1118', 1, 2);
    pxLine(ctx, -17, 5, -6, 9, '#e0b69a', 1, 2);
    pxLine(ctx, 18, -15, 23, -9, '#e0b69a', 1, 2);
    // 嘶吼/阶段二的深喉光
    if (open > 0.55 || b.phase === 2) {
      ctx.globalAlpha = 0.22 + open * 0.12;
      fillCircle(ctx, 19, 7, 13, '#ff5b42', 0.7);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawBody(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    // 主体轮廓
    fillPoly(ctx, [
      [-86, -16], [-78, -52], [-56, -78], [-22, -94], [16, -92], [50, -76],
      [76, -48], [86, -12], [78, 28], [52, 52], [16, 62], [-22, 58], [-58, 40], [-80, 12]
    ], '#120407');
    fillPoly(ctx, [
      [-78, -14], [-70, -46], [-50, -70], [-20, -85], [14, -83], [45, -68],
      [68, -42], [78, -10], [70, 23], [46, 45], [14, 54], [-18, 50], [-52, 34], [-72, 9]
    ], '#65151d');
    // 血肉块与裸露组织
    ell(-38, -34, -0.4, 42, 36, '#8e2428');
    ell(22, -42, 0.5, 38, 32, '#7a1a22');
    ell(-10, 4, 0.1, 58, 38, '#a23432');
    ell(-48, 16, 0.7, 26, 22, '#92302b');
    ell(38, 8, -0.6, 30, 26, '#5e1119');
    // 高光与湿滑粘液
    ell(-22, -52, -0.2, 16, 8, '#c36a5a');
    ell(30, -30, 0.4, 12, 6, '#b1584e');
    ell(-4, -6, 0, 22, 10, '#c46d5a');
    // 骨刺
    for (const [x, y, a] of [[-62, -35, -1.2], [-34, -72, -0.6], [8, -84, 0.1], [48, -60, 0.8], [72, -24, 1.3]]) {
      const p1 = local(x, y, 0, 0, 0);
      fillPoly(ctx, [[p1.x - 4, p1.y + 5], [p1.x + 4, p1.y + 5], [p1.x + Math.cos(a) * 16, p1.y + Math.sin(a) * 16]], '#201014');
      fillPoly(ctx, [[p1.x - 2, p1.y + 4], [p1.x + 2, p1.y + 4], [p1.x + Math.cos(a) * 12, p1.y + Math.sin(a) * 12]], '#d7c5a2');
    }
    // 血管
    pxLine(ctx, -66, -24, -30, -52, '#4b0b12', 2, 3);
    pxLine(ctx, -48, 22, 10, 36, '#4b0b12', 2, 4);
    pxLine(ctx, 28, -62, 62, -20, '#4b0b12', 2, 3);
    pxLine(ctx, 4, -4, 52, 28, '#54101a', 1, 3);
    // 裂口与牙
    fillPoly(ctx, [[-74, 18], [-58, 10], [-38, 16], [-30, 28], [-52, 34], [-70, 30]], '#0b0305');
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#d8c5a2';
      ctx.fillRect(-66 + i * 7, 17 + (i % 2) * 2, 2, 4);
    }
    ctx.restore();
  }

  function drawRestTendrils(b) {
    const t = now();
    for (let i = 0; i < 7; i++) {
      const a = b.angle + Math.PI * 0.65 + i * 0.27 + Math.sin(t * 0.4 + i) * 0.08;
      const base = local(b.x, b.y, b.angle, -10 + Math.cos(i) * 30, 22 + Math.sin(i) * 18);
      const points = [];
      for (let k = 0; k <= 5; k++) {
        const f = k / 5;
        const r = 28 + f * (58 + i * 5);
        points.push({
          x: base.x + Math.cos(a) * r + Math.sin(t * 0.8 + i + k) * 8,
          y: base.y + Math.sin(a) * r + Math.cos(t * 0.7 + i + k) * 8
        });
      }
      drawTentacle(points, 4 + (i % 3), '#7b1e23', '#b74c42', '#180508');
    }
  }

  function drawAttackTentacle(b) {
    if (!b.attack) return;
    const r = b.attack.root;
    const t = now();
    const points = [{ x: r.x, y: r.y }];
    for (let i = 1; i <= 9; i++) {
      const f = i / 9;
      const angle = b.angle + f * 3.4 + Math.sin(t * 1.6 + f * 2) * 0.35;
      points.push({
        x: r.x + Math.cos(angle) * (18 + f * 100),
        y: r.y + Math.sin(angle) * (18 + f * 100)
      });
    }
    drawTentacle(points, 12, '#8c2428', '#d16a55', '#180508');
    // 根部靶心
    fillCircle(ctx, r.x, r.y, r.r + 4, '#21070b');
    fillCircle(ctx, r.x, r.y, r.r, '#a93434');
    fillCircle(ctx, r.x, r.y, r.r - 4, '#e4b06e');
    ctx.globalAlpha = 0.5 + Math.sin(t * 9) * 0.2;
    fillCircle(ctx, r.x, r.y, r.r - 7, '#fff0c0');
    ctx.globalAlpha = 1;
  }

  function drawEnrageTentacles(b) {
    for (const t of b.tentacles) {
      if (t.dead) continue;
      drawTentacle(t.points, 8, '#8b2428', '#d36b58', '#180508');
      const hp = t.points[0];
      fillCircle(ctx, hp.x, hp.y, 7, '#d08b58');
      fillCircle(ctx, hp.x, hp.y, 3, '#3c0d12');
    }
  }

  function drawCarrion(b) {
    if (!b || b.reveal <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(b.reveal, 0, 1);
    drawRestTendrils(b);
    drawBody(b);
    for (const h of b.heads) drawHead(b, h);
    drawEnrageTentacles(b);
    drawAttackTentacle(b);
    // 漂浮的碎肉与血雾
    for (let i = 0; i < 8; i++) {
      const a = now() * 0.5 + i * 1.7;
      const d = 36 + (i % 4) * 13;
      ctx.globalAlpha = 0.18 + (i % 3) * 0.05;
      ctx.fillStyle = i % 2 ? '#8e2a2c' : '#d08b70';
      ctx.fillRect(Math.round(b.x + Math.cos(a) * d), Math.round(b.y + Math.sin(a) * d), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  return {
    meta,
    create,
    update,
    updateEnding,
    updateShots,
    pointHit,
    draw: drawCarrion
  };
}
