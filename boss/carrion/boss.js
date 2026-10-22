// CARRION · 猩红像素 BOSS
// R02 定稿：10 颗头（4 颗直接生长 + 6 颗触手连接），中心巨眼，猩红像素。
// 2000 HP；一阶段单头巨触手；二阶段剩余头全部伸触手，巨眼盯船。

export const meta = {
  id: 'carrion',
  name: 'CARRION',
  maxHp: 2000,
  music: './boss/carrion/boss-theme.ogg',
  interfaceVersion: 1,
  face: false,
  desc: '猩红血肉与十颗头颅。AK 撕头颅，狙击枪打断巨触手根部；半血后万触齐发。',
  winToast: 'CARRION 崩解成猩红肉泥',
  loseToast: 'CARRION 吞没了马林鱼……'
};

export function createBossModule(api) {
  const {
    ctx, W, H, clamp, lerp, rand, choice, TAU, angleLerp,
    addParticle, addText, segPointDist, Sound,
    BOSS_FISH, BOSS_CONTACT, endBoss, damageMarlin, now
  } = api;

  const HEAD_HP = 200;
  const TENTACLE_HP = 80;
  const ATTACK_DURATION = 4.2;
  const PHASE2_TIME = 10;
  const PHASE2_DAMAGE = .10;
  const ATTACK_WINDUP = 2.2;
  const RETRACT = .7;
  const CELL = 2;

  const P = {
    ink: '#080104',
    dark: '#3a0710',
    mid: '#7a101c',
    light: '#b51f2b',
    scarlet: '#e04a3a',
    bone: '#d8c3a6',
    iris: '#d08a44',
    glow: '#ff6a4e'
  };

  // 4 颗直接生长 + 6 颗触手连接；R02 定稿
  const HEAD_DEFS = [
    { kind: 'direct', lx: -44, ly: -14, r: 15, phase: .2 },
    { kind: 'direct', lx: -18, ly: -34, r: 14, phase: 1.6 },
    { kind: 'direct', lx: 26, ly: -32, r: 15, phase: 2.8 },
    { kind: 'direct', lx: 44, ly: 2, r: 13, phase: 4.1 },
    { kind: 'stalked', ang: .25, len: 38, r: 14, phase: 5.2 },
    { kind: 'stalked', ang: 1.25, len: 44, r: 13, phase: .9 },
    { kind: 'stalked', ang: 2.3, len: 40, r: 15, phase: 3.3 },
    { kind: 'stalked', ang: 3.5, len: 45, r: 14, phase: 1.9 },
    { kind: 'stalked', ang: 4.6, len: 42, r: 13, phase: 4.7 },
    { kind: 'stalked', ang: 5.6, len: 40, r: 15, phase: 2.4 }
  ];

  function snap(v) { return Math.round(v / CELL) * CELL; }

  function pr(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(snap(x), snap(y), Math.max(CELL, snap(w)), Math.max(CELL, snap(h)));
  }

  function pl(x0, y0, x1, y1, color, w) {
    x0 = snap(x0); y0 = snap(y0); x1 = snap(x1); y1 = snap(y1);
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / CELL));
    const size = Math.max(CELL, snap(w || 2));
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      pr(lerp(x0, x1, f), lerp(y0, y1, f), size, size, color);
    }
  }

  function pEllipse(cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y += CELL) {
      const w = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)));
      pr(cx - w, cy + y, w * 2 + CELL, CELL, color);
    }
  }

  function pSpan(pts, colorFn) {
    let minY = 1e9, maxY = -1e9;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY / CELL) * CELL; y <= maxY; y += CELL) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.floor(xs[k] / CELL) * CELL; x < xs[k + 1]; x += CELL) {
          const c = colorFn(x, y);
          if (c) pr(x, y, CELL, CELL, c);
        }
      }
    }
  }

  function pPoly(pts, color) { pSpan(pts, () => color); }

  function bodyPoints(b) {
    const pts = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const r = 56 + Math.sin(a * 3.1) * 7 + Math.cos(a * 5.2) * 4;
      pts.push([b.x + Math.cos(a) * r * 1.12, b.y + Math.sin(a) * r * .7]);
    }
    return pts;
  }

  function syncHeads(b) {
    const t = now();
    for (const h of b.heads) {
      if (h.kind === 'direct') {
        h.x = b.x + h.lx + Math.sin(t * 1.25 + h.phase) * 1.4;
        h.y = b.y + h.ly + Math.cos(t * 1.05 + h.phase) * 1.2;
        h.ax = b.x + h.lx;
        h.ay = b.y + h.ly;
      } else {
        const sway = Math.sin(t * .62 + h.phase) * .16;
        h.ax = b.x + Math.cos(h.ang) * 52;
        h.ay = b.y + Math.sin(h.ang) * 34;
        h.x = h.ax + Math.cos(h.ang + sway) * h.len;
        h.y = h.ay + Math.sin(h.ang + sway) * h.len * .72;
      }
      if (h.dead) h.open = 0;
      else if (b.phase === 2) h.open = 1;
      else if (b.attack && b.attack.head === h) h.open = 1;
      else h.open = .22 + .13 * Math.sin(t * 1.6 + h.phase);
    }
  }

  function aliveHeads(b) { return b.heads.filter(h => !h.dead); }
  function allHeadsDead(b) { return b.heads.every(h => h.dead); }
  function recomputeHp(b) { b.hp = b.heads.reduce((s, h) => s + Math.max(0, h.hp), 0); }

  function create() {
    const b = {
      x: 90, y: 220, angle: 0, hp: 0, maxHp: 0,
      reveal: 0, flash: 0, deathT: 0,
      attack: null, attackCd: 6.5,
      phase: 1, enraged: false, enrageT: 0,
      tentacles: [], contactCd: 0,
      activeTentacle: null, nextAttackT: 1.4, tentacleCursor: 0,
      heads: []
    };
    b.angle = Math.atan2(BOSS_FISH.y - b.y, BOSS_FISH.x - b.x);
    b.heads = HEAD_DEFS.map((d, i) => ({
      id: i, kind: d.kind,
      lx: d.lx || 0, ly: d.ly || 0,
      ang: d.ang || 0, len: d.len || 0,
      r: d.r, phase: d.phase,
      hp: HEAD_HP, maxHp: HEAD_HP, dead: false,
      flash: 0, open: 0, x: 0, y: 0, ax: 0, ay: 0
    }));
    b.maxHp = b.heads.reduce((s, h) => s + h.maxHp, 0);
    b.hp = b.maxHp;
    syncHeads(b);
    return b;
  }

  function startAttack(b) {
    const alive = aliveHeads(b);
    if (!alive.length) return;
    const head = choice(alive);
    b.attackCd = 7;
    const dir = Math.atan2(BOSS_FISH.y - head.y, BOSS_FISH.x - head.x);
    b.attack = { head, t: 0, dur: ATTACK_DURATION, impacted: false, root: { x: head.x + Math.cos(dir) * 22, y: head.y + Math.sin(dir) * 22, r: 20 } };
    head.open = 1;
    Sound.bossRoar();
    api.game.shake = Math.max(api.game.shake, 8);
  }

  function endAttack(b) {
    if (!b.attack) return;
    b.attack = null;
    b.attackCd = 6;
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
    api.game.shake = Math.max(api.game.shake, bySniper ? 11 : 7);
    addText(h.x, h.y - 18, bySniper ? '处决' : '头颅破碎', '#ffb18a', 1);
    if (allHeadsDead(b)) endBoss(true);
  }

  function startEnrage(b) {
    if (b.enraged) return;
    b.enraged = true;
    b.phase = 2;
    b.enrageT = 0;
    b.attack = null;
    b.activeTentacle = null;
    b.nextAttackT = 1.4;
    b.tentacleCursor = 0;
    const alive = aliveHeads(b);
    b.tentacles = alive.map((h, i) => ({
      id: i, head: h, hp: TENTACLE_HP, maxHp: TENTACLE_HP,
      dead: false, flash: 0, phase: rand(0, TAU),
      state: 'idle', attackT: 0, hit: false, points: []
    }));
    for (const h of b.heads) if (!h.dead) h.open = 1;
    for (const t of b.tentacles) computeIdleTentacle(b, t);
    Sound.bossRoar();
    api.game.shake = Math.max(api.game.shake, 16);
    addText(b.x, b.y - 86, '十头齐鸣', '#ff7a5a', 2);
  }

  function endEnrage(b) {
    for (const h of b.heads) h.open = 0;
    b.tentacles = [];
    b.activeTentacle = null;
    b.phase = 1;
    b.enrageT = 0;
    b.attackCd = 6;
    api.game.shake = Math.max(api.game.shake, 10);
    Sound.bossRoar();
  }

  function easeOut(x) { x = clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); }

  function computeIdleTentacle(b, t) {
    const h = t.head;
    const base = Math.atan2(h.y - b.y, h.x - b.x) + .3 + t.id * .55;
    t.points = [];
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      const a = base + Math.sin(now() * .7 + t.phase + f * 3) * .22 + f * 1.1;
      const reach = 16 + f * 38;
      t.points.push({
        x: h.x + Math.cos(a) * reach,
        y: h.y + Math.sin(a) * reach * .72
      });
    }
  }

  function computeAttackTentacle(b, t) {
    const h = t.head;
    const start = { x: h.x, y: h.y };
    const target = BOSS_FISH;
    let ext;
    if (t.attackT <= ATTACK_WINDUP) {
      ext = .08 + .92 * easeOut(t.attackT / ATTACK_WINDUP);
    } else {
      const r = clamp((t.attackT - ATTACK_WINDUP) / RETRACT, 0, 1);
      ext = 1 - r * .9;
    }
    const tip = {
      x: lerp(start.x, target.x, ext),
      y: lerp(start.y, target.y, ext)
    };
    const dx = tip.x - start.x, dy = tip.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const arc = Math.sin(ext * Math.PI) * 34;
    const cx = (start.x + tip.x) / 2 + nx * arc;
    const cy = (start.y + tip.y) / 2 + ny * arc;
    t.points = [];
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      const u = 1 - f;
      t.points.push({
        x: u * u * start.x + 2 * u * f * cx + f * f * tip.x,
        y: u * u * start.y + 2 * u * f * cy + f * f * tip.y
      });
    }
  }

  function updatePhase2(b, dt) {
    const active = b.activeTentacle;
    if (active) {
      if (active.dead) {
        b.activeTentacle = null;
        b.nextAttackT = .6;
      } else {
        active.attackT += dt;
        if (!active.hit && active.attackT >= ATTACK_WINDUP) {
          active.hit = true;
          damageMarlin(PHASE2_DAMAGE);
          addText(BOSS_FISH.x, BOSS_FISH.y - 22, '10%', '#ff8b6a', 2);
          api.game.shake = Math.max(api.game.shake, 12);
          Sound.bossRoar();
        }
        if (active.attackT >= ATTACK_WINDUP + RETRACT) {
          active.state = 'idle';
          active.attackT = 0;
          b.activeTentacle = null;
          b.nextAttackT = .7;
        } else {
          computeAttackTentacle(b, active);
        }
      }
    }
    if (!b.activeTentacle) {
      b.nextAttackT -= dt;
      if (b.nextAttackT <= 0) {
        const alive = b.tentacles.filter(t => !t.dead);
        if (!alive.length) {
          endEnrage(b);
          return;
        }
        const idx = b.tentacleCursor % alive.length;
        b.tentacleCursor++;
        const t = alive[idx];
        t.state = 'attack';
        t.attackT = 0;
        t.hit = false;
        b.activeTentacle = t;
        computeAttackTentacle(b, t);
      }
    }
    for (const t of b.tentacles) {
      if (t.dead) continue;
      if (t !== b.activeTentacle) computeIdleTentacle(b, t);
    }
    if (!b.tentacles.some(t => !t.dead)) endEnrage(b);
  }

  function update(b, dt) {
    b.contactCd = Math.max(0, b.contactCd - dt);
    b.reveal = Math.min(1, b.reveal + dt * 1.2);
    for (const h of b.heads) h.flash = Math.max(0, h.flash - dt);
    for (const t of b.tentacles) t.flash = Math.max(0, t.flash - dt);

    const desired = Math.atan2(BOSS_FISH.y - b.y, BOSS_FISH.x - b.x);
    b.angle = angleLerp(b.angle, desired, 1 - Math.exp(-dt * .4));
    const speed = b.phase === 2 ? 2.2 : 1.15;
    b.x += Math.cos(b.angle) * speed * dt;
    b.y += Math.sin(b.angle) * speed * dt;
    b.x = clamp(b.x, 70, W - 40);
    b.y = clamp(b.y, 100, H - 20);
    syncHeads(b);

    if (b.phase === 2) {
      updatePhase2(b, dt);
    } else if (b.attack) {
      b.attack.t += dt;
      const rootX = b.attack.head.x + Math.cos(b.angle) * 22;
      const rootY = b.attack.head.y + Math.sin(b.angle) * 22;
      b.attack.root.x = lerp(b.attack.root.x, rootX, 1 - Math.exp(-dt * 8));
      b.attack.root.y = lerp(b.attack.root.y, rootY, 1 - Math.exp(-dt * 8));
      // 触手真正拍到鱼身时才掉血，而不是计时结束凭空掉血
      if (!b.attack.impacted && b.attack.t >= b.attack.dur * .78) {
        b.attack.impacted = true;
        damageMarlin(.49);
        addText(BOSS_FISH.x, BOSS_FISH.y - 22, '49%', '#ff8b6a', 2);
        api.game.shake = Math.max(api.game.shake, 14);
        Sound.bossRoar();
      }
      if (b.attack.t >= b.attack.dur) endAttack(b);
    } else {
      b.attackCd -= dt;
      if (b.attackCd <= 0) startAttack(b);
    }

    if (b.phase === 1 && b.hp <= b.maxHp * .5 && !b.enraged) startEnrage(b);

    const dx = BOSS_FISH.x - b.x, dy = BOSS_FISH.y - b.y;
    if (b.contactCd <= 0 && Math.hypot(dx, dy) < 78) {
      damageMarlin(.49);
      b.contactCd = 5;
      b.x -= Math.cos(b.angle) * 70;
      b.y -= Math.sin(b.angle) * 70;
      api.game.shake = Math.max(api.game.shake, 14);
      Sound.bossRoar();
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
      // 正在伸过来的触手优先判定，避免被身后的闲置触手挡枪
      if (b.activeTentacle && !b.activeTentacle.dead) {
        const t = b.activeTentacle;
        for (let i = 0; i < t.points.length - 1; i++) {
          const a = t.points[i], c = t.points[i + 1];
          if (segPointDist(a.x, a.y, p.px, p.py, p.x, p.y) < 13) {
            return { kind: 'tentacle', tentacle: t, x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
          }
        }
      }
      for (const t of b.tentacles) {
        if (t.dead || t === b.activeTentacle) continue;
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
      for (let i = 0; i < 4; i++) {
        addParticle(hit.x, hit.y, rand(-24, 24), rand(-24, 24), rand(.15, .35), P.bone, 1, 20, .95);
      }
      return;
    }
    const dmg = ak ? 10 : 20;
    api.game.shake = Math.max(api.game.shake, ak ? 2 : 6);
    addParticle(hit.x, hit.y, rand(-30, 30), rand(-30, 30), rand(.2, .5), P.scarlet, 2, 20, .94);

    if (hit.kind === 'root') {
      hit.head.flash = .18;
      if (sniper) killHead(b, hit.head, true);
      else {
        hit.head.hp = Math.max(0, hit.head.hp - dmg);
        if (hit.head.hp <= 0) killHead(b, hit.head, false);
      }
    } else if (hit.kind === 'head') {
      hit.head.flash = .18;
      hit.head.hp = Math.max(0, hit.head.hp - dmg);
      if (hit.head.hp <= 0) killHead(b, hit.head, false);
    } else if (hit.kind === 'tentacle') {
      hit.tentacle.flash = .18;
      hit.tentacle.hp = Math.max(0, hit.tentacle.hp - dmg);
      if (hit.tentacle.hp <= 0) {
        hit.tentacle.dead = true;
        if (b.activeTentacle === hit.tentacle) {
          b.activeTentacle = null;
          b.nextAttackT = .6;
        }
        Sound.bossDeath();
        api.game.shake = Math.max(api.game.shake, 5);
      }
    }

    recomputeHp(b);
    const away = Math.atan2(b.y - BOSS_FISH.y, b.x - BOSS_FISH.x);
    b.x += Math.cos(away) * (ak ? .4 : 1.0);
    b.y += Math.sin(away) * (ak ? .4 : 1.0);
    addText(hit.x, hit.y - 12, ak ? '-10' : '-20', ak ? '#ffd9a0' : '#e7f4ff', 1);
    if (ak) Sound.bossHit(); else Sound.bossKnock();
    if (allHeadsDead(b)) endBoss(true);
    else if (b.phase === 1 && b.hp <= b.maxHp * .5 && !b.enraged) startEnrage(b);
  }

  function updateShots(dt) {
    const g = api.game;
    if (!g || !g.boss) return;
    const b = g.boss;
    for (let i = g.bossShots.length - 1; i >= 0; i--) {
      const p = g.bossShots[i];
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (Math.random() < .3) {
        addParticle(p.x, p.y, -p.vx * .03 + rand(-5, 5), -p.vy * .03 + rand(-5, 5),
          rand(.15, .35), choice([P.scarlet, P.light, P.bone]), 1, 0, .96);
      }
      const hit = hitTest(b, p);
      if (hit) {
        if (p.weapon === 'sniper' && hit.kind !== 'root') {
          // 巴雷特强穿透：穿过头颅/普通触手继续飞行，只被巨触手根部拦下
          p._hits = p._hits || {};
          const key = hit.kind + ':' + (hit.head ? hit.head.id : (hit.tentacle ? hit.tentacle.id : ''));
          if (!p._hits[key]) {
            p._hits[key] = true;
            applyHit(b, p, hit);
          }
          continue;
        }
        applyHit(b, p, hit);
        g.bossShots.splice(i, 1);
        continue;
      }
      if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) g.bossShots.splice(i, 1);
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
      if (b.activeTentacle && !b.activeTentacle.dead) {
        const t = b.activeTentacle;
        for (let i = 0; i < t.points.length - 1; i++) {
          const a = t.points[i], c = t.points[i + 1];
          if (segPointDist(x, y, a.x, a.y, c.x, c.y) < 15) return true;
        }
      }
      for (const t of b.tentacles) {
        if (t.dead || t === b.activeTentacle) continue;
        for (let i = 0; i < t.points.length - 1; i++) {
          const a = t.points[i], c = t.points[i + 1];
          if (segPointDist(x, y, a.x, a.y, c.x, c.y) < 13) return true;
        }
      }
      return false;
    }
    for (const h of b.heads) if (!h.dead && Math.hypot(x - h.x, y - h.y) < h.r + 3) return true;
    return false;
  }

  function updateEnding(b, dt, outcome) {
    b.deathT += dt;
    if (outcome === 'win') {
      b.y += dt * 14;
      b.reveal = Math.max(0, 1 - b.deathT / 2.6);
      if (Math.random() < dt * 26) {
        addParticle(b.x + rand(-70, 70), b.y + rand(-55, 45), rand(-20, 20), rand(-40, 10),
          rand(.3, 1.2), choice([P.scarlet, P.dark, P.bone]), 2, 12, .95);
      }
    } else {
      b.x += Math.cos(b.angle) * 2.2 * dt;
      b.y += Math.sin(b.angle) * 2.2 * dt;
      b.reveal = Math.max(.4, b.reveal);
    }
  }

  // ---------- 绘制 ----------
  function drawTentacle(points, width, color, dark, tipColor) {
    if (!points || points.length < 2) return;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      pl(a.x, a.y, b.x, b.y, P.ink, width + 4);
      pl(a.x, a.y, b.x, b.y, dark, width + 2);
      pl(a.x, a.y, b.x, b.y, color, width);
      if (i % 2 === 0) pl(a.x, a.y, b.x, b.y, P.light, 1);
    }
    const tip = points[points.length - 1];
    pr(tip.x - 1, tip.y - 1, 4, 4, tipColor || color);
  }

  function drawFreeTentacles(b, front) {
    const t = now();
    const rx = 58, ry = 38;
    for (let i = 0; i < 42; i++) {
      if ((i % 3 === 0) !== !!front) continue;
      const a = i / 42 * TAU + .12;
      const rootX = b.x + Math.cos(a) * rx;
      const rootY = b.y + Math.sin(a) * ry;
      const len = 30 + (i % 7) * 6 + Math.sin(t * .5 + i) * 5;
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const f = k / 5;
        const aa = a + Math.sin(t * .8 + i * 1.7 + f * 3) * .22 + f * .7;
        pts.push({
          x: rootX + Math.cos(aa) * len * f,
          y: rootY + Math.sin(aa) * len * f * .72 + Math.sin(t + i + f * 2) * 2 * f
        });
      }
      drawTentacle(pts, 2 + (i % 4 === 0 ? 2 : 0), P.mid, P.dark, P.light);
    }
  }

  function drawBody(b) {
    const pts = bodyPoints(b);
    pPoly(pts, P.dark);
    pSpan(pts, (x, y) => {
      return ((x + y) % 5 === 0) ? P.mid : (x % 13 === 0 ? P.light : P.dark);
    });
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      pl(a[0], a[1], c[0], c[1], P.scarlet, 2);
    }
    pEllipse(b.x - 22, b.y - 6, 17, 10, P.mid);
    pEllipse(b.x + 18, b.y + 4, 19, 11, P.mid);
    pEllipse(b.x - 4, b.y + 12, 24, 9, P.light);
  }

  function drawEye(b) {
    const ex = b.x + 8;
    const ey = b.y - 4;
    const r = 28;
    pEllipse(ex, ey, r + 10, r + 9, P.ink);
    pEllipse(ex, ey, r + 8, r + 7, P.dark);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      pr(ex + Math.cos(a) * (r + 7) - 1, ey + Math.sin(a) * (r + 7) - 1, 4, 4, i % 3 ? P.bone : P.light);
    }
    pEllipse(ex, ey, r + 2, r, P.ink);
    pEllipse(ex, ey, r, r - 2, P.dark);
    pEllipse(ex, ey, 21, 18, P.glow);
    pEllipse(ex, ey, 13, 11, P.iris);
    // 二阶段盯船；一阶段朝前
    const gaze = b.phase === 2 ? Math.atan2(BOSS_FISH.y - ey, BOSS_FISH.x - ex) : b.angle;
    const gx = Math.cos(gaze) * 4;
    const gy = Math.sin(gaze) * 3;
    pr(ex - 3 + gx, ey - 17 + gy, 6, 34, '#050102');
    pr(ex - 1 + gx, ey - 13 + gy, 2, 26, '#1b0305');
    pr(ex - 8 + gx, ey - 7 + gy, 4, 4, P.bone);
    pr(ex + 8 + gx, ey + 4 + gy, 2, 2, P.scarlet);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU;
      pl(ex + Math.cos(a) * 17, ey + Math.sin(a) * 14,
        ex + Math.cos(a) * 35, ey + Math.sin(a) * 28, P.light, 1);
    }
  }

  function drawHead(b, h) {
    const x = h.x, y = h.y, r = h.r;
    if (h.dead) {
      pEllipse(x, y, r + 2, r, P.ink);
      pEllipse(x, y, r - 1, r - 2, P.dark);
      pr(x - r * .55, y - 1, r * 1.1, 2, '#120407');
      return;
    }
    const open = clamp(h.open, 0, 1);
    const flash = h.flash > 0;
    pEllipse(x, y, r + 3, r + 2, P.ink);
    pEllipse(x - 1, y + 1, r + 2, r + 1, flash ? P.bone : P.dark);
    pEllipse(x - 1, y, r + 1, r, flash ? P.light : P.mid);
    pEllipse(x - 3, y - 3, r * .6, r * .48, flash ? P.bone : P.light);
    const dir = h.kind === 'direct' ? Math.atan2(h.ly, h.lx) : Math.atan2(h.y - h.ay, h.x - h.ax);
    const mx = x + Math.cos(dir) * r * .28;
    const my = y + Math.sin(dir) * r * .18 + 3;
    const mw = r * (.38 + open * .4);
    const mh = r * (.16 + open * .34);
    pEllipse(mx, my, mw, mh, '#030103');
    pr(mx - mw * .7, my - mh * .3, mw * 1.4, mh * .6, '#2a060a');
    for (let i = 0; i < 5; i++) {
      const tx = mx - mw + 3 + i * ((mw * 2 - 6) / 4);
      pr(tx, my - mh - 1, 2, 3 + (i % 2) * 2, P.bone);
      pr(tx + 1, my + mh - 1, 2, 2 + (i % 2) * 2, P.bone);
    }
    const ex = x - Math.cos(dir) * r * .38;
    const ey = y - r * .34;
    pr(ex - 2, ey, 5, 3, P.ink);
    pr(ex - 1, ey, 2, 1, P.bone);
    if (h.kind === 'stalked') {
      pr(h.ax + (x - h.ax) * .78 - 2, h.ay + (y - h.ay) * .78 - 2, 5, 5, P.ink);
      pr(h.ax + (x - h.ax) * .78 - 1, h.ay + (y - h.ay) * .78 - 1, 3, 3, P.light);
    }
  }

  function drawStalk(b, h) {
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const f = k / 5;
      pts.push({
        x: lerp(h.ax, h.x, f) + Math.sin(now() * .9 + h.phase + f * 3) * 4 * f,
        y: lerp(h.ay, h.y, f) + Math.cos(now() * .8 + h.phase + f * 2) * 3 * f
      });
    }
    drawTentacle(pts, 6, h.flash > 0 ? P.light : P.mid, h.flash > 0 ? P.bone : P.dark, P.light);
  }

  function drawPhaseTentacles(b) {
    // 非攻击触手先画，正在伸过来的触手最后画，保证玩家能看到并优先射击
    for (const t of b.tentacles) {
      if (t.dead || t === b.activeTentacle) continue;
      const col = t.flash > 0 ? P.bone : P.light;
      drawTentacle(t.points, 5, col, P.dark, P.scarlet);
      const hp = t.points[0];
      if (hp) {
        pr(hp.x - 2, hp.y - 2, 6, 6, P.ink);
        pr(hp.x - 1, hp.y - 1, 4, 4, P.bone);
      }
    }
    const a = b.activeTentacle;
    if (a && !a.dead) {
      const col = a.flash > 0 ? P.bone : P.scarlet;
      drawTentacle(a.points, 8, col, P.dark, P.bone);
      const hp = a.points[0];
      if (hp) {
        pr(hp.x - 3, hp.y - 3, 8, 8, P.ink);
        pr(hp.x - 2, hp.y - 2, 5, 5, P.bone);
      }
    }
  }

  function drawAttack(b) {
    if (!b.attack) return;
    const start = { x: b.attack.root.x, y: b.attack.root.y };
    const target = BOSS_FISH;
    const q = clamp(b.attack.t / b.attack.dur, 0, 1);
    const wind = .32;
    const impact = .78;
    let ext;
    if (q < wind) ext = .06 + (q / wind) * .08;
    else if (q < impact) ext = .14 + easeOut((q - wind) / (impact - wind)) * .86;
    else ext = 1 - easeOut((q - impact) / .22) * .8;
    const tip = {
      x: lerp(start.x, target.x, ext),
      y: lerp(start.y, target.y, ext)
    };
    const dx = tip.x - start.x, dy = tip.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const arc = Math.sin(ext * Math.PI) * 42;
    const cx = (start.x + tip.x) / 2 + nx * arc;
    const cy = (start.y + tip.y) / 2 + ny * arc;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      const u = 1 - f;
      pts.push({
        x: u * u * start.x + 2 * u * f * cx + f * f * tip.x,
        y: u * u * start.y + 2 * u * f * cy + f * f * tip.y
      });
    }
    drawTentacle(pts, 10, P.light, P.dark, P.bone);
    // 触手尖端在鱼身上抽击的可见反馈
    if (q >= impact && q < .93) {
      const k = 1 - (q - impact) / .15;
      pEllipse(target.x, target.y, 8 + 8 * k, 6 + 6 * k, P.ink);
      pEllipse(target.x, target.y, 5 + 5 * k, 3 + 3 * k, P.scarlet);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        pl(target.x + Math.cos(a) * 5, target.y + Math.sin(a) * 4,
          target.x + Math.cos(a) * (16 + 8 * k), target.y + Math.sin(a) * (12 + 6 * k), P.bone, 2);
      }
    }
    const r = b.attack.root;
    pEllipse(r.x, r.y, r.r + 5, r.r + 4, P.ink);
    pEllipse(r.x, r.y, r.r, r.r - 1, P.light);
    pEllipse(r.x, r.y, r.r - 5, r.r - 6, P.bone);
    pEllipse(r.x, r.y, 5, 5, P.glow);
  }

  function draw(b) {
    if (!b || b.reveal <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(b.reveal, 0, 1);
    drawFreeTentacles(b, false);
    drawBody(b);
    drawEye(b);
    for (const h of b.heads) if (h.kind === 'direct') drawHead(b, h);
    for (const h of b.heads) if (h.kind === 'stalked') drawStalk(b, h);
    for (const h of b.heads) if (h.kind === 'stalked') drawHead(b, h);
    drawFreeTentacles(b, true);
    drawPhaseTentacles(b);
    drawAttack(b);
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
    draw
  };
}
