// 死神利维坦 · BOSS 模块
// 这个文件只负责利维坦自己的状态、移动、受击反应和绘制。
// 公共流程（武器、血条、入场、结算、音乐）在 index.html/game.js 的 BOSS Runner 里。

export const meta = {
  id: 'leviathan',
  name: '死神利维坦',
  maxHp: 2600,
  music: './boss/leviathan/boss-theme.ogg',
  interfaceVersion: 1,
  face: false,
  desc: '从深渊浮起的蓝身深红脊海蛇。AK 输出，巴雷特击退。',
  winToast: '死神利维坦沉入深渊',
  loseToast: '利维坦吞没了马林鱼……'
};

export function createBossModule(api) {
  const {
    ctx, W, H, clamp, lerp, rand, choice, TAU,
    fillPoly, pxLine, fillCircle, angleLerp, addParticle,
    BOSS_FISH, BOSS_GUN, BOSS_CONTACT, endBoss, now
  } = api;

  const headImg = typeof Image !== 'undefined' ? new Image() : null;
  let headReady = false;
  let headFlashCanvas = null, headFlashCtx = null;
  // 主路径：boss/leviathan/assets/；兼容旧根目录 assets；最后内嵌兜底，避免部署漏传后头消失
  const HEAD_DATA_FALLBACK = 'data:image/png;base64,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';
  const HEAD_SOURCES = [
    new URL('./assets/leviathan-head-v2-128.png?v=1.7.22', import.meta.url).href,
    new URL('../../assets/leviathan-head-v2-128.png?v=1.7.22', import.meta.url).href,
    HEAD_DATA_FALLBACK
  ];
  let headSourceIndex = 0;
  function loadHeadSource() {
    if (!headImg) return;
    headImg.onload = () => { headReady = true; };
    headImg.onerror = () => {
      if (headSourceIndex < HEAD_SOURCES.length - 1) {
        headSourceIndex++;
        headImg.src = HEAD_SOURCES[headSourceIndex];
      }
    };
    headImg.src = HEAD_SOURCES[headSourceIndex];
  }
  loadHeadSource();

  function createBoss() {
    const angle = Math.atan2(BOSS_FISH.y - 246, BOSS_FISH.x - 82);
    return {
      x: 82, y: 246, angle,
      hp: 2600, maxHp: 2600,
      state: 'approach', stateT: 0, recoilAngle: angle,
      headR: 60, phase: 1, knockCount: 0, skillQueue: [], pendingSkill: false,
      roarT: 0, roarAge: 0, targetX: 82, targetY: 246, lastPoint: null,
      moveSpeed: 0, moveAccel: 0, chargeSpeed: 0, chargeDir: angle,
      mouthT: rand(0, TAU), mouth: 0,
      flash: 0, hitFlash: 0, deathT: 0,
      spine: [], reveal: 0
    };
  }

  function spineRadius(i, n) {
    if (i === 0) return 24;
    if (i < 4) return 26 + i * 4;
    const k = (i - 3) / Math.max(1, n - 4);
    return 40 * (1 - k * .9) + 3;
  }

  function initBossSpine(b) {
    b.spine = [];
    const n = 20;
    const step = 14;
    let x = b.x, y = b.y;
    for (let i = 0; i < n; i++) {
      let a = b.angle + Math.PI;
      if (i > 0) {
        a = b.angle + Math.PI + Math.sin(i * 0.7) * 0.14;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
      }
      const k = i / (n - 1);
      b.spine.push({
        x, y, angle: a,
        r: spineRadius(i, n)
      });
    }
  }

  function updateBossSpine(b, dt) {
    if (!b.spine || b.spine.length < 2) { initBossSpine(b); return; }
    const n = b.spine.length;
    const step = 14;
    const head = b.spine[0];
    head.x = b.x;
    head.y = b.y;
    head.angle = b.angle;
    head.r = spineRadius(0, n);
    for (let i = 1; i < n; i++) {
      const prev = b.spine[i - 1];
      const s = b.spine[i];
      const targetAngle = Math.atan2(prev.y - s.y, prev.x - s.x);
      s.angle = angleLerp(s.angle, targetAngle, 1 - Math.exp(-dt * 18));
      // 每一节都有独立的肌肉摆动，越靠尾摆幅越大
      const sway = Math.sin(now() * 2.05 - i * 0.62) * Math.min(1.7, i * 0.13);
      const nx = -Math.sin(prev.angle), ny = Math.cos(prev.angle);
      const tx = prev.x - Math.cos(prev.angle) * step + nx * sway;
      const ty = prev.y - Math.sin(prev.angle) * step + ny * sway;
      const follow = 1 - Math.exp(-dt * 16);
      s.x += (tx - s.x) * follow;
      s.y += (ty - s.y) * follow;
      // 防止高速击退时被无限拉长
      const dx = s.x - prev.x, dy = s.y - prev.y;
      const d = Math.hypot(dx, dy) || 1;
      const maxD = step * 1.35;
      if (d > maxD) {
        const k = (d - maxD) / d;
        s.x -= dx * k;
        s.y -= dy * k;
      }
      s.r = spineRadius(i, n);
    }
  }

  function bossEllipse(x, y, a, rx, ry, color, ox, oy) {
    const pts = [];
    const ca = Math.cos(a), sa = Math.sin(a);
    const lx = ox || 0, ly = oy || 0;
    for (let i = 0; i < 10; i++) {
      const t = i / 10 * TAU;
      const ex = Math.cos(t) * rx + lx;
      const ey = Math.sin(t) * ry + ly;
      pts.push([x + ca * ex - sa * ey, y + sa * ex + ca * ey]);
    }
    fillPoly(ctx, pts, color);
  }

  function bossLocal(x, y, a, lx, ly) {
    const ca = Math.cos(a), sa = Math.sin(a);
    return { x: x + ca * lx - sa * ly, y: y + sa * lx + ca * ly };
  }

  const HEAD_SCALE = 1.15;
  const ARENA_POINTS = [
    { x: 74, y: 92 },
    { x: 74, y: 236 },
    { x: 408, y: 236 }
  ];
  const BODY_LINE = '#082632';
  const BODY_LINE_DEEP = '#03141d';
  const BODY_BLUE = '#8fc4cc';
  const BODY_BLUE_HI = '#b9e0dc';
  const BODY_BLUE_SHADE = '#547f89';
  const BODY_BELLY = '#c6e7e2';
  const BODY_RED = '#a73736';
  const BODY_RED_DARK = '#511719';
  const BODY_RED_HI = '#ce5b50';

  function drawNewBody(b) {
    const pts = b.spine;
    if (!pts || pts.length < 3) return;
    const hit = b.flash > 0;
    const blue = hit ? '#d7b3ad' : BODY_BLUE;
    const blueHi = hit ? '#ffe0d1' : BODY_BLUE_HI;
    const blueShade = hit ? '#a07478' : BODY_BLUE_SHADE;
    const belly = hit ? '#f0ddd1' : BODY_BELLY;
    const red = hit ? '#ff735f' : BODY_RED;
    const redDark = hit ? '#a32f2e' : BODY_RED_DARK;
    const redHi = hit ? '#ffb39b' : BODY_RED_HI;
    const top = [], bot = [], bodyTop = [], bodyBot = [], bellyTop = [], bellyBot = [];
    const ridgeTop = [], ridgeBot = [], rimTop = [], rimBot = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = p.angle;
      const nx = -Math.sin(a), ny = Math.cos(a);
      const r = p.r;
      top.push([p.x + nx * (r + 4), p.y + ny * (r + 4)]);
      bot.push([p.x - nx * (r + 4), p.y - ny * (r + 4)]);
      bodyTop.push([p.x + nx * r, p.y + ny * r]);
      bodyBot.push([p.x - nx * r, p.y - ny * r]);
      bellyTop.push([p.x + nx * (r * .12), p.y + ny * (r * .12)]);
      bellyBot.push([p.x + nx * (r * .78), p.y + ny * (r * .78)]);
      ridgeTop.push([p.x - nx * (r * .92), p.y - ny * (r * .92)]);
      ridgeBot.push([p.x - nx * (r * .48), p.y - ny * (r * .48)]);
      rimTop.push([p.x + nx * (r * .42), p.y + ny * (r * .42)]);
      rimBot.push([p.x + nx * (r * .92), p.y + ny * (r * .92)]);
    }
    // 尾鳍：最后一段向后方展开
    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    const ta = Math.atan2(last.y - prev.y, last.x - prev.x);
    const tx = Math.cos(ta), ty = Math.sin(ta);
    const nx = -ty, ny = tx;
    const lx = last.x, ly = last.y;
    fillPoly(ctx, [
      [lx, ly], [lx + tx * 28 + nx * 22, ly + ty * 28 + ny * 22],
      [lx + tx * 17, ly + ty * 17], [lx + tx * 33 - nx * 24, ly + ty * 33 - ny * 24]
    ], BODY_LINE_DEEP);
    fillPoly(ctx, [
      [lx, ly], [lx + tx * 23 + nx * 17, ly + ty * 23 + ny * 17],
      [lx + tx * 15, ly + ty * 15], [lx + tx * 27 - nx * 18, ly + ty * 27 - ny * 18]
    ], redDark);
    // 外轮廓只在接触水的一侧
    fillPoly(ctx, top.concat(bot.slice().reverse()), BODY_LINE_DEEP);
    fillPoly(ctx, bodyTop.concat(bodyBot.slice().reverse()), blue);
    // 背脊红色
    fillPoly(ctx, ridgeTop.concat(ridgeBot.slice().reverse()), redDark);
    fillPoly(ctx, ridgeTop.map((p, i) => i % 2 ? [p[0], p[1]] : [p[0] + 1, p[1] + 1]).concat(ridgeBot.slice().reverse()), red);
    // 腹部浅蓝
    fillPoly(ctx, bellyTop.concat(bellyBot.slice().reverse()), belly);
    // 蓝色暗面
    const shadeTop = [], shadeBot = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], a = p.angle;
      const nx2 = -Math.sin(a), ny2 = Math.cos(a);
      shadeTop.push([p.x + nx2 * (p.r * .22), p.y + ny2 * (p.r * .22)]);
      shadeBot.push([p.x - nx2 * (p.r * .46), p.y - ny2 * (p.r * .46)]);
    }
    fillPoly(ctx, shadeTop.concat(shadeBot.slice().reverse()), blueShade);
    // 红色腹缘
    fillPoly(ctx, rimTop.concat(rimBot.slice().reverse()), redDark);
    // 连续背鳍膜
    const finTop = [], finTip = [];
    for (let i = 2; i < pts.length - 2; i++) {
      const p = pts[i], a = p.angle;
      const nx2 = -Math.sin(a), ny2 = Math.cos(a);
      const peak = i === 4 ? 34 : i === 5 ? 20 : 7 + (i % 3) * 5;
      finTop.push([p.x - nx2 * (p.r + 2), p.y - ny2 * (p.r + 2)]);
      finTip.push([p.x - nx2 * (p.r + peak), p.y - ny2 * (p.r + peak)]);
    }
    if (finTop.length > 2) {
      fillPoly(ctx, finTop.concat(finTip.slice().reverse()), BODY_LINE_DEEP);
      for (let i = 0; i < finTip.length - 1; i += 2) {
        fillPoly(ctx, [finTop[i], finTip[i], finTop[i + 1]], redDark);
        fillPoly(ctx, [finTop[i], [ (finTip[i][0] + finTip[i + 1][0]) / 2, (finTip[i][1] + finTip[i + 1][1]) / 2 ], finTop[i + 1]], red);
        pxLine(ctx, finTip[i][0], finTip[i][1], finTip[i + 1][0], finTip[i + 1][1], redHi, 1);
      }
    }
    // 背棘
    for (let i = 3; i < pts.length - 2; i += 4) {
      const p = pts[i], a = p.angle;
      const nx2 = -Math.sin(a), ny2 = Math.cos(a);
      const sx = p.x - nx2 * (p.r + 2), sy = p.y - ny2 * (p.r + 2);
      fillPoly(ctx, [[sx - 3, sy], [sx + 1, sy - 10], [sx + 5, sy]], red);
    }
    // 侧鳍
    for (let i = 4; i < pts.length - 3; i += 5) {
      const p = pts[i], a = p.angle;
      const nx2 = -Math.sin(a), ny2 = Math.cos(a);
      const tx2 = Math.cos(a), ty2 = Math.sin(a);
      const f1 = [p.x + nx2 * p.r * .35, p.y + ny2 * p.r * .35];
      const f2 = [p.x - nx2 * p.r * 1.55 - tx2 * 5, p.y - ny2 * p.r * 1.55 - ty2 * 5];
      const f3 = [p.x - nx2 * p.r * .7 + tx2 * 7, p.y - ny2 * p.r * .7 + ty2 * 7];
      fillPoly(ctx, [f1, f2, f3], BODY_LINE_DEEP);
      fillPoly(ctx, [f1, f2, f3], redDark);
      pxLine(ctx, f1[0], f1[1], f2[0], f2[1], BODY_BELLY, 1);
    }
    // 鳞光
    for (let i = 2; i < pts.length - 2; i += 3) {
      const p = pts[i], a = p.angle;
      const nx2 = -Math.sin(a), ny2 = Math.cos(a);
      pxLine(ctx, p.x + nx2 * p.r * .3, p.y + ny2 * p.r * .3,
        p.x + nx2 * p.r * .7, p.y + ny2 * p.r * .7, blueHi, 1);
    }
  }

  function ensureHeadFlashCanvas() {
    if (headFlashCanvas || typeof document === 'undefined') return;
    headFlashCanvas = document.createElement('canvas');
    headFlashCanvas.width = 128;
    headFlashCanvas.height = 89;
    headFlashCtx = headFlashCanvas.getContext('2d');
  }

  function drawNewHead(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.imageSmoothingEnabled = false;
    const flash = b.flash > 0 ? clamp(b.flash / .16, 0, 1) : 0;
    const punch = 1 + flash * .035;
    ctx.scale(punch, punch);
    const w = 128 * HEAD_SCALE, h = 89 * HEAD_SCALE;
    if (headReady) {
      if (flash > 0) {
        ensureHeadFlashCanvas();
        if (headFlashCtx) {
          headFlashCtx.clearRect(0, 0, 128, 89);
          headFlashCtx.drawImage(headImg, 0, 0, 128, 89);
          headFlashCtx.globalCompositeOperation = 'source-atop';
          headFlashCtx.globalAlpha = .35 + flash * .55;
          headFlashCtx.fillStyle = '#ffb49c';
          headFlashCtx.fillRect(0, 0, 128, 89);
          headFlashCtx.globalAlpha = 1;
          headFlashCtx.globalCompositeOperation = 'source-over';
          ctx.drawImage(headFlashCanvas, -64 * HEAD_SCALE, -45 * HEAD_SCALE, w, h);
        } else {
          ctx.drawImage(headImg, -64 * HEAD_SCALE, -45 * HEAD_SCALE, w, h);
        }
      } else {
        ctx.drawImage(headImg, -64 * HEAD_SCALE, -45 * HEAD_SCALE, w, h);
      }
    } else {
      // 图片未加载时的应急轮廓，不参与正常画面
      fillPoly(ctx, [[-58, -8], [-35, -36], [12, -43], [55, -25], [70, 2], [49, 27], [5, 35], [-41, 21]], BODY_LINE_DEEP);
      fillPoly(ctx, [[-52, -6], [-32, -29], [11, -35], [47, -20], [60, 2], [42, 21], [4, 28], [-36, 16]], BODY_BLUE);
    }
    ctx.restore();
  }

  function drawRoar(b) {
    if (!b.roarT || b.roarT <= 0) return;
    const age = 1.25 - b.roarT;
    ctx.save();
    for (let ring = 0; ring < 4; ring++) {
      const r = 20 + ((age * 150 + ring * 32) % 150);
      ctx.globalAlpha = Math.max(0, .48 - age * .25) * (1 - ring * .12);
      for (let i = 0; i < 30; i++) {
        const a0 = i / 30 * TAU;
        const a1 = (i + 1) / 30 * TAU;
        pxLine(ctx, b.x + Math.cos(a0) * r, b.y + Math.sin(a0) * r,
          b.x + Math.cos(a1) * r, b.y + Math.sin(a1) * r, '#bff5ff', 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBoss(b) {
    if (!b || b.reveal <= 0) return;
    if (!b.spine || b.spine.length < 2) initBossSpine(b);
    ctx.save();
    ctx.globalAlpha = clamp(b.reveal, 0, 1);
    drawNewBody(b);
    // 头部贴图
    drawNewHead(b);
    drawRoar(b);
    for (let i = 0; i < 7; i++) {
      const a = now() * .7 + i * 1.7;
      const d = 34 + (i % 3) * 9;
      ctx.globalAlpha = .18 + (i % 3) * .06;
      ctx.fillStyle = '#bfe9ef';
      ctx.fillRect(Math.round(b.x + Math.cos(a) * d), Math.round(b.y + Math.sin(a) * d), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  const SPEED_H = 16;
  const SPEED_V = 9;

  // 水平速度 : 竖直速度 = 16 : 9；斜向按方向折算，右下角不再垂直猛扑
  function axisSpeed(angle, base) {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    const denom = Math.hypot(c / SPEED_H, s / SPEED_V);
    return base * ((1 / SPEED_H) / Math.max(1e-6, denom));
  }

  function fishAngle(b) {
    return Math.atan2(BOSS_FISH.y - b.y, BOSS_FISH.x - b.x);
  }

  function startRecoil(b, away) {
    b.state = 'recoil';
    b.stateT = .7;
    b.recoilAngle = away;
    b.chargeSpeed = 0;
    b.moveSpeed = 0;
    b.x += Math.cos(away) * 4;
    b.y += Math.sin(away) * 4;
  }

  function startSkill(b) {
    if (!b || b.hp <= 0) return;
    b.state = 'roar';
    b.roarT = 1.25;
    b.roarAge = 0;
    b.pendingSkill = false;
    b.knockCount = 0;
    b.moveSpeed = 0;
    b.chargeSpeed = 0;
    // 第一次移动避开上一次到达的角落；后续每次只能在另外两个点中选择
    const pool = ARENA_POINTS.filter(p => !b.lastPoint || p.x !== b.lastPoint.x || p.y !== b.lastPoint.y);
    const first = pool[Math.floor(rand(0, pool.length))] || ARENA_POINTS[0];
    const seq = [first];
    if (b.phase === 2) {
      const totalMoves = 3 + Math.floor(rand(0, 3)); // 3 ~ 5 次移动
      let cur = first;
      for (let i = 1; i < totalMoves; i++) {
        const opts = ARENA_POINTS.filter(p => p !== cur);
        cur = opts[Math.floor(rand(0, opts.length))];
        seq.push(cur);
      }
    }
    b.skillQueue = seq;
    if (api.Sound && api.Sound.bossRoar) api.Sound.bossRoar();
    if (api.game) api.game.shake = Math.max(api.game.shake, 10);
  }

  function goToPoint(b, target, dash) {
    b.targetX = target.x;
    b.targetY = target.y;
    b.state = dash ? 'dashPoint' : 'goPoint';
    b.moveSpeed = 0;
    b.moveAccel = dash ? 950 : (b.phase === 2 ? 620 : 340);
    b.maxMoveSpeed = dash ? 430 : (b.phase === 2 ? 220 : 120);
  }

  function startCharge(b) {
    b.state = 'charge';
    b.chargeSpeed = 0;
    b.chargeDir = fishAngle(b);
    b.angle = b.chargeDir;
    b.stateT = 0;
  }

  function update(b, dt) {
    b.mouthT += dt;
    b.mouth = 0.5 + 0.5 * Math.sin(b.mouthT * 2.25);
    b.flash = Math.max(0, b.flash - dt);
    b.hitFlash = Math.max(0, b.hitFlash - dt);

    // 半血进入二阶段；下一拍开始二阶段技能
    if (b.phase === 1 && b.hp <= b.maxHp * .5) {
      b.phase = 2;
      b.knockCount = 0;
      b.pendingSkill = true;
    }

    if (b.state === 'roar') {
      b.roarT -= dt;
      b.roarAge += dt;
      if (api.game) api.game.shake = Math.max(api.game.shake, 1.8 + (1.25 - Math.max(0, b.roarT)) * 5.5);
      if (b.roarT <= 0) {
        b.roarT = 0;
        const target = b.skillQueue.shift();
        if (target) goToPoint(b, target, false);
        else startCharge(b);
      }
      updateBossSpine(b, dt);
      return;
    }

    if (b.state === 'goPoint' || b.state === 'dashPoint') {
      const dx = b.targetX - b.x, dy = b.targetY - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.angle = angleLerp(b.angle, Math.atan2(dy, dx), 1 - Math.exp(-dt * 8));
      b.moveSpeed = Math.min(b.maxMoveSpeed, b.moveSpeed + b.moveAccel * dt);
      const step = axisSpeed(b.angle, b.moveSpeed) * dt;
      if (d <= Math.max(7, step)) {
        b.x = b.targetX;
        b.y = b.targetY;
        b.angle = fishAngle(b);
        b.lastPoint = { x: b.targetX, y: b.targetY };
        b.state = 'facePoint';
        b.stateT = .28;
        b.moveSpeed = 0;
      } else {
        b.x += Math.cos(b.angle) * step;
        b.y += Math.sin(b.angle) * step;
      }
    } else if (b.state === 'facePoint') {
      b.angle = angleLerp(b.angle, fishAngle(b), 1 - Math.exp(-dt * 12));
      b.stateT -= dt;
      if (b.stateT <= 0) {
        if (b.skillQueue.length) {
          const next = b.skillQueue.shift();
          goToPoint(b, next, true);
        } else {
          startCharge(b);
        }
      }
    } else if (b.state === 'charge') {
      b.stateT += dt;
      const accel = b.phase === 2 ? 620 : 360;
      const maxSpeed = b.phase === 2 ? 680 : 500;
      b.chargeSpeed = Math.min(maxSpeed, b.chargeSpeed + accel * dt);
      b.angle = b.chargeDir;
      const chargeStep = axisSpeed(b.chargeDir, b.chargeSpeed) * dt;
      b.x += Math.cos(b.chargeDir) * chargeStep;
      b.y += Math.sin(b.chargeDir) * chargeStep;
      if (Math.hypot(b.x - BOSS_FISH.x, b.y - BOSS_FISH.y) < BOSS_CONTACT) {
        if (api.damageMarlin) api.damageMarlin(.49);
        if (api.game) api.game.shake = Math.max(api.game.shake, 15);
        b.state = 'after';
        b.stateT = 1.15;
        b.chargeSpeed = 0;
        b.moveSpeed = 0;
      } else if (b.stateT > 5) {
        b.state = 'after';
        b.stateT = .8;
        b.chargeSpeed = 0;
      }
    } else if (b.state === 'recoil') {
      b.stateT -= dt;
      b.angle = b.recoilAngle;
      const recoilStep = axisSpeed(b.recoilAngle, b.phase === 2 ? 150 : 120) * dt;
      b.x += Math.cos(b.recoilAngle) * recoilStep;
      b.y += Math.sin(b.recoilAngle) * recoilStep;
      if (b.stateT <= 0) {
        if (b.pendingSkill) startSkill(b);
        else b.state = 'approach';
      }
    } else if (b.state === 'after') {
      b.stateT -= dt;
      if (b.stateT <= 0) {
        if (b.phase === 2 || b.pendingSkill) startSkill(b);
        else {
          b.state = 'approach';
          b.knockCount = 0;
        }
      }
    } else {
      // 一阶段正常巡游；不主动撞鱼
      if (b.pendingSkill) {
        startSkill(b);
      } else {
        // 不放技能时，像老版本一样慢慢游向玩家；被摸到就一口闷
        const ax = BOSS_FISH.x - b.x, ay = BOSS_FISH.y - b.y;
        const d = Math.hypot(ax, ay) || 1;
        b.angle = angleLerp(b.angle, Math.atan2(ay, ax), 1 - Math.exp(-dt * 1.35));
        const normalStep = axisSpeed(b.angle, 17) * dt;
        b.x += Math.cos(b.angle) * normalStep;
        b.y += Math.sin(b.angle) * normalStep;
        if (d < BOSS_CONTACT) {
          if (api.endBoss) api.endBoss(false);
          b.state = 'after';
          b.stateT = 2;
        }
      }
    }

    b.x = clamp(b.x, 58, W - 28);
    b.y = clamp(b.y, 76, H - 20);
    updateBossSpine(b, dt);
    if (Math.random() < dt * 2.8) {
      addParticle(b.x + rand(-20, 20), b.y + rand(-14, 14), rand(-6, 6), rand(-18, -3),
        rand(0.4, 1.1), choice(['#8fd8ef', '#b9e8f0', '#5b8f9c']), 1, -8, 0.98);
    }
  }

  function updateEnding(b, dt, outcome) {
    b.deathT += dt;
    if (outcome === 'win') {
      b.y += dt * 18;
      b.angle += dt * 0.2;
      b.reveal = Math.max(0, 1 - b.deathT / 2.6);
      if (Math.random() < dt * 18) {
        addParticle(b.x + rand(-30, 30), b.y + rand(-20, 20), rand(-20, 20), rand(-30, 10),
          rand(0.4, 1.2), choice(['#b43628', '#6b1718', '#8f8f85']), 2, 10, 0.96);
      }
    } else {
      b.mouth = 1;
      b.x += Math.cos(b.angle) * 6 * dt;
      b.y += Math.sin(b.angle) * 6 * dt;
      if (Math.random() < dt * 12) {
        addParticle(b.x + rand(-20, 20), b.y + rand(-14, 14), rand(-20, 20), rand(-30, 10),
          rand(0.3, 1.0), choice(['#ffd27a', '#a52b22', '#8f8f85']), 2, 10, 0.96);
      }
    }
    updateBossSpine(b, dt);
  }

  function onHit(b, kind, info) {
    if (!b || b.hp <= 0 || kind !== 'sniper' || !info || !info.head) return;
    if (b.state === 'charge') {
      // 只有冲向玩家的冲刺阶段，爆头狙击才能把它打调头
      b.pendingSkill = b.phase === 2;
      startRecoil(b, b.chargeDir + Math.PI);
      if (api.game) api.game.shake = Math.max(api.game.shake, 7);
      return;
    }
    // 一阶段正常游动时可以爆头击退；两次击退触发一次技能
    if (b.phase === 1 && (b.state === 'approach' || b.state === 'after')) {
      b.knockCount++;
      if (b.knockCount >= 2) b.pendingSkill = true;
      startRecoil(b, Math.atan2(b.y - BOSS_FISH.y, b.x - BOSS_FISH.x));
      if (api.game) api.game.shake = Math.max(api.game.shake, 6);
    }
  }

  return {
    meta,
    create: createBoss,
    initSpine: initBossSpine,
    updateSpine: updateBossSpine,
    update,
    updateEnding,
    draw: drawBoss,
    onHit
  };
}
