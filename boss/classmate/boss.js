// 死神利维坦 · BOSS 模块
// 这个文件只负责利维坦自己的状态、移动、受击反应和绘制。
// 公共流程（武器、血条、入场、结算、音乐）在 index.html/game.js 的 BOSS Runner 里。

export const meta = {
  id: 'classmate',
  name: '同学利维坦',
  maxHp: 2600,
  music: './boss/classmate/boss-theme.ogg',
  interfaceVersion: 1,
  face: true,
  desc: '被同学头像覆盖的死神利维坦。',
  winToast: '同学利维坦沉入深渊',
  loseToast: '同学利维坦吞没了马林鱼……'
};

export function createBossModule(api) {
  const {
    ctx, W, H, clamp, lerp, rand, choice, TAU,
    fillPoly, pxLine, fillCircle, angleLerp, addParticle,
    BOSS_FISH, BOSS_GUN, BOSS_CONTACT, endBoss, now
  } = api;

  function createBoss() {
    const angle = Math.atan2(BOSS_FISH.y - 246, BOSS_FISH.x - 82);
    return {
      x: 82, y: 246, angle,
      hp: 2600, maxHp: 2600,
      state: 'approach', stateT: 0, recoilAngle: angle,
      mouthT: rand(0, TAU), mouth: 0,
      flash: 0, hitFlash: 0, deathT: 0,
      spine: [], reveal: 0
    };
  }

  function initBossSpine(b) {
    b.spine = [];
    const n = 17;
    const step = 12.5;
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
        r: i === 0 ? 30 : 21 * (1 - k * 0.82) + 2
      });
    }
  }

  function updateBossSpine(b, dt) {
    if (!b.spine || b.spine.length < 2) { initBossSpine(b); return; }
    const n = b.spine.length;
    const step = 12.5;
    const head = b.spine[0];
    head.x = b.x;
    head.y = b.y;
    head.angle = b.angle;
    head.r = 30;
    for (let i = 1; i < n; i++) {
      const prev = b.spine[i - 1];
      const s = b.spine[i];
      const targetAngle = Math.atan2(prev.y - s.y, prev.x - s.x);
      s.angle = angleLerp(s.angle, targetAngle, 1 - Math.exp(-dt * 10.5));
      // 每一节都有独立的肌肉摆动，越靠尾摆幅越大
      const sway = Math.sin(now() * 2.05 - i * 0.62) * Math.min(1.7, i * 0.13);
      const nx = -Math.sin(prev.angle), ny = Math.cos(prev.angle);
      const tx = prev.x - Math.cos(prev.angle) * step + nx * sway;
      const ty = prev.y - Math.sin(prev.angle) * step + ny * sway;
      const follow = 1 - Math.exp(-dt * 9.5);
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
      s.r = 2 + 21 * (1 - (i / (n - 1)) * 0.82);
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

  function drawBossTendril(pts, b) {
    const hit = b.flash > 0;
    for (let i = 0; i < pts.length - 1; i++) {
      pxLine(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#1a0709', 9);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      pxLine(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hit ? '#ff8f70' : '#a91926', 6);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      pxLine(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hit ? '#ffd0b4' : '#d93637', 2);
    }
    // 苍白的筋与尖端
    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const a = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
    fillPoly(ctx, [
      [tip[0] - Math.cos(a) * 4, tip[1] - Math.sin(a) * 4],
      [tip[0] + Math.cos(a) * 8, tip[1] + Math.sin(a) * 8],
      [tip[0] - Math.sin(a) * 4, tip[1] + Math.cos(a) * 4]
    ], hit ? '#fff0d8' : '#e8e2d3');
    pxLine(ctx, prev[0], prev[1], tip[0], tip[1], '#eadfc9', 1);
  }

  function drawBossHead(b) {
    const hit = b.flash > 0;
    const red = hit ? '#ff886a' : '#a61924';
    const redHi = hit ? '#ffc0a0' : '#d63837';
    const redDark = hit ? '#8a2c2b' : '#520c13';
    const bone = hit ? '#fff3df' : '#e6dfcf';
    const boneShade = hit ? '#ffe0c6' : '#c9c0ad';
    const gum = '#4e1014';
    const open = 4 + b.mouth * 18;
    const upperY = -open * 0.14;
    const lowerY = open;

    // 一堆红色触须先把“脸”遮住
    const tendrils = [
      [[-16, -14], [6, -33], [33, -41], [59, -30 - open * .45]],
      [[-23, -6], [1, -25], [29, -31], [56, -19 - open * .35]],
      [[-23, 7], [1, 26], [29, 32], [56, 20 + open * .35]],
      [[-15, 16], [7, 35], [34, 41], [60, 30 + open * .45]],
      [[-30, -1], [-4, -14], [18, -15], [39, -6]],
      [[-30, 1], [-4, 15], [18, 15], [39, 7]]
    ];
    for (const t of tendrils) drawBossTendril(t, b);

    // 不规则、模糊的头部暗影：不再是白色椭圆脸
    fillPoly(ctx, [
      [-37, -6], [-30, -21], [-15, -30], [4, -33], [24, -29],
      [43, -20], [54, -8], [58, 3], [50, 15], [33, 25],
      [11, 29], [-13, 24], [-31, 15], [-38, 4]
    ], '#120407');
    fillPoly(ctx, [
      [-33, -4], [-26, -17], [-13, -25], [4, -28], [22, -24],
      [39, -16], [49, -6], [52, 3], [45, 12], [30, 21],
      [10, 25], [-11, 20], [-27, 12], [-33, 3]
    ], redDark);
    fillPoly(ctx, [
      [-27, -2], [-21, -12], [-9, -19], [4, -22], [19, -18],
      [33, -11], [41, -3], [39, 5], [27, 12], [9, 16], [-9, 12], [-22, 7]
    ], red);

    // 红色头冠棘
    const crest = [
      [[-31, -9], [-25, -28], [-14, -12]],
      [[-19, -16], [-10, -34], [1, -16]],
      [[-4, -20], [7, -38], [16, -20]],
      [[14, -18], [27, -32], [30, -15]]
    ];
    for (const c of crest) {
      fillPoly(ctx, c, redDark);
      fillPoly(ctx, [
        [c[0][0] + 2, c[0][1] + 2],
        [c[1][0], c[1][1] + 2],
        [c[2][0] - 1, c[2][1] - 1]
      ], redHi);
    }

    // 口腔：上下颚之间巨大的黑洞
    fillPoly(ctx, [
      [-2, 0 + upperY], [20, 1 + upperY], [42, 1 + upperY], [55, 4 + upperY],
      [57, 7 + lowerY * .25], [48, 10 + lowerY], [30, 12 + lowerY],
      [9, 10 + lowerY], [-4, 6 + lowerY]
    ], '#0b0305');
    fillPoly(ctx, [
      [4, 2 + upperY], [25, 3 + upperY], [44, 3 + upperY], [51, 6 + upperY],
      [48, 8 + lowerY * .8], [29, 10 + lowerY * .9], [10, 9 + lowerY * .85], [2, 5 + lowerY * .7]
    ], gum);

    // 上颚：细长的骨甲边缘，不再是一整块头骨
    const upperJaw = [
      [0, -9 + upperY], [12, -13 + upperY], [28, -13 + upperY], [44, -10 + upperY],
      [55, -4 + upperY], [50, 1 + upperY], [33, 1 + upperY], [14, 3 + upperY], [1, -2 + upperY]
    ];
    fillPoly(ctx, upperJaw, '#140507');
    fillPoly(ctx, [
      [2, -7 + upperY], [13, -10 + upperY], [28, -10 + upperY], [42, -7 + upperY],
      [50, -3 + upperY], [45, -1 + upperY], [31, -1 + upperY], [14, 1 + upperY], [3, -3 + upperY]
    ], bone);
    fillPoly(ctx, [[6, -4 + upperY], [17, -6 + upperY], [31, -6 + upperY], [43, -3 + upperY], [38, -1 + upperY], [18, 0 + upperY], [7, -1 + upperY]], boneShade);

    // 下颚：独立向下移动
    const lowerJaw = [
      [-3, 5 + lowerY], [10, 7 + lowerY], [28, 8 + lowerY], [46, 5 + lowerY],
      [56, 9 + lowerY], [48, 18 + lowerY], [30, 22 + lowerY], [10, 20 + lowerY], [-5, 13 + lowerY]
    ];
    fillPoly(ctx, lowerJaw, '#140507');
    fillPoly(ctx, [
      [0, 8 + lowerY], [11, 10 + lowerY], [27, 11 + lowerY], [43, 8 + lowerY],
      [50, 10 + lowerY], [43, 16 + lowerY], [29, 19 + lowerY], [11, 17 + lowerY], [1, 12 + lowerY]
    ], bone);
    fillPoly(ctx, [[4, 11 + lowerY], [15, 12 + lowerY], [29, 13 + lowerY], [40, 11 + lowerY], [29, 16 + lowerY], [12, 15 + lowerY]], boneShade);

    // 长而尖的牙：上排向下、下排向上，随上下颚一起动
    for (let i = 0; i < 12; i++) {
      const x = 5 + i * 4.1;
      const baseY = 1 + upperY;
      const len = 8 + (i % 3) * 2.2;
      fillPoly(ctx, [[x - 1.6, baseY], [x + 1.6, baseY], [x, baseY + len]], '#f8f1e0');
      fillPoly(ctx, [[x - .7, baseY], [x + .7, baseY], [x, baseY + len - 2]], '#d9cdb4');
    }
    for (let i = 0; i < 11; i++) {
      const x = 5 + i * 4.4;
      const baseY = 7 + lowerY;
      const len = 9 + (i % 3) * 2.0;
      fillPoly(ctx, [[x - 1.6, baseY], [x + 1.6, baseY], [x, baseY - len]], '#efe7d5');
      fillPoly(ctx, [[x - .7, baseY], [x + .7, baseY], [x, baseY - len + 2]], '#d4c7ae');
    }

    // 同一侧两颗纯黑眼球：没有高光
    for (const [ex, ey] of [[3, -15], [17, -12]]) {
      fillCircle(ctx, ex, ey, 6.5, '#3d0c12', 1);
      fillCircle(ctx, ex, ey, 4.6, '#000000', 1);
    }
    // 眼眶红色肌肉
    fillPoly(ctx, [[-4, -22], [6, -23], [9, -19], [0, -17]], redDark);
    fillPoly(ctx, [[17, -18], [25, -16], [23, -11], [16, -13]], red);
    // 口腔深处的红光
    ctx.globalAlpha = .12 + b.mouth * .12;
    fillCircle(ctx, 28, 6, 20, '#ff8b5c', .6);
    ctx.globalAlpha = 1;

  }

  function drawBossBodyNode(s, b, i, n) {
    const hit = b.flash > 0;
    const a = s.angle;
    const r = s.r;
    const red = hit ? '#ff8f74' : '#b51f28';
    const redHi = hit ? '#ffc1a4' : '#db3936';
    const redDark = hit ? '#9c3a35' : '#681018';
    // 暗红外轮廓，衔接成一条连续的躯体
    bossEllipse(s.x, s.y, a, r * 1.42 + 2, r + 2, '#3a070d');
    bossEllipse(s.x, s.y, a, r * 1.38, r, red);
    bossEllipse(s.x, s.y, a, r * 1.2, r * .72, redHi, 0, -r * .2);
    bossEllipse(s.x, s.y, a, r * 1.08, r * .3, redDark, 0, -r * .52);
    // 背棘：每一节都有，但高矮不一
    const p1 = bossLocal(s.x, s.y, a, -r * .18, -r * .68);
    const p2 = bossLocal(s.x, s.y, a, r * .28, -r * (1.7 + (i % 4) * .3));
    const p3 = bossLocal(s.x, s.y, a, r * .58, -r * .62);
    fillPoly(ctx, [[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]], '#430810');
    fillPoly(ctx, [[p1.x, p1.y], [p2.x, p2.y], [p3.x - 1, p3.y + 2]], red);
    // 旧伤
    if (i % 3 === 0) {
      const sc = bossLocal(s.x, s.y, a, r * .2, -r * .3);
      pxLine(ctx, sc.x - 2, sc.y, sc.x + 3, sc.y - 2, '#f2e7d2', 1, 2);
      pxLine(ctx, sc.x - 1, sc.y + 1, sc.x + 2, sc.y + 2, '#7e1a20', 1, 2);
    }
  }

  function drawBossBelly(b) {
    const n = b.spine.length;
    if (n < 3) return;
    const inner = [], outer = [];
    for (let i = 1; i < n; i++) {
      const s = b.spine[i];
      const a = s.angle;
      const nx = -Math.sin(a), ny = Math.cos(a);
      inner.push([s.x + nx * s.r * .08, s.y + ny * s.r * .08]);
      outer.push([s.x + nx * s.r * .76, s.y + ny * s.r * .76]);
    }
    const poly = inner.concat(outer.slice().reverse());
    fillPoly(ctx, poly, '#e9e4d6');
    // 红白交界与腹面高光
    for (let i = 1; i < inner.length; i++) {
      pxLine(ctx, inner[i - 1][0], inner[i - 1][1], inner[i][0], inner[i][1], '#8d1c22', 1);
    }
    for (let i = 1; i < outer.length; i++) {
      pxLine(ctx, outer[i - 1][0], outer[i - 1][1], outer[i][0], outer[i][1], '#f5edde', 1, 3);
    }
    // 零散鳞光，不是一节一节的白色斑块
    for (let i = 2; i < n - 1; i += 2) {
      const s = b.spine[i];
      const a = s.angle;
      const nx = -Math.sin(a), ny = Math.cos(a);
      ctx.globalAlpha = .34;
      ctx.fillStyle = '#c9c0ad';
      ctx.fillRect(Math.round(s.x + nx * s.r * .4), Math.round(s.y + ny * s.r * .4), 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawBossSideFins(b) {
    const n = b.spine.length;
    for (let i = 2; i < n - 2; i++) {
      if (i % 4 !== 1) continue;
      const s = b.spine[i];
      const a = s.angle;
      const r = s.r;
      const f1 = bossLocal(s.x, s.y, a, 0, r * .38);
      const f2 = bossLocal(s.x, s.y, a, -r * .95, r * 1.8);
      const f3 = bossLocal(s.x, s.y, a, r * .65, r * 1.25);
      fillPoly(ctx, [[f1.x, f1.y], [f2.x, f2.y], [f3.x, f3.y]], '#430810');
      fillPoly(ctx, [[f1.x, f1.y], [f2.x, f2.y], [f3.x - 1, f3.y - 2]], b.flash > 0 ? '#ff987a' : '#a81925');
      pxLine(ctx, f1.x, f1.y, f2.x, f2.y, '#efe5d2', 1);
    }
  }

  function drawBossTail(b) {
    const s = b.spine[b.spine.length - 1];
    const prev = b.spine[b.spine.length - 2];
    const a = Math.atan2(s.y - prev.y, s.x - prev.x);
    const red = b.flash > 0 ? '#ff8f74' : '#b51f28';
    const redDark = '#671018';
    const bone = '#e9e4d6';
    const p0 = bossLocal(s.x, s.y, a, 0, 0);
    const p1 = bossLocal(s.x, s.y, a, 10, -25);
    const p2 = bossLocal(s.x, s.y, a, 30, -10);
    const p3 = bossLocal(s.x, s.y, a, 34, 8);
    const p4 = bossLocal(s.x, s.y, a, 12, 25);
    fillPoly(ctx, [[p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]], '#160608');
    fillPoly(ctx, [[p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]], redDark);
    const q1 = bossLocal(s.x, s.y, a, 7, -17);
    const q2 = bossLocal(s.x, s.y, a, 24, -7);
    const q3 = bossLocal(s.x, s.y, a, 25, 6);
    const q4 = bossLocal(s.x, s.y, a, 8, 17);
    fillPoly(ctx, [[p0.x, p0.y], [q1.x, q1.y], [q2.x, q2.y], [q3.x, q3.y], [q4.x, q4.y]], red);
    pxLine(ctx, q1.x, q1.y, q2.x, q2.y, bone, 1);
    pxLine(ctx, q4.x, q4.y, q3.x, q3.y, bone, 1);
  }

  function drawBoss(b) {
    if (!b || b.reveal <= 0) return;
    if (!b.spine || b.spine.length < 2) initBossSpine(b);
    ctx.save();
    ctx.globalAlpha = clamp(b.reveal, 0, 1);
    // 深渊红光
    fillCircle(ctx, b.x, b.y, 94, '#651a18', .08);
    fillCircle(ctx, b.x, b.y, 48, '#d14b35', .05);

    const n = b.spine.length;
    for (let i = n - 1; i >= 1; i--) drawBossBodyNode(b.spine[i], b, i, n);
    drawBossBelly(b);
    drawBossSideFins(b);
    drawBossTail(b);

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    drawBossHead(b);
    ctx.restore();

    for (let i = 0; i < 6; i++) {
      const a = now() * .7 + i * 1.7;
      const d = 34 + (i % 3) * 9;
      ctx.globalAlpha = .18 + (i % 3) * .06;
      ctx.fillStyle = '#bfe9ef';
      ctx.fillRect(Math.round(b.x + Math.cos(a) * d), Math.round(b.y + Math.sin(a) * d), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }


  function update(b, dt) {
    b.mouthT += dt;
    b.mouth = 0.5 + 0.5 * Math.sin(b.mouthT * 2.25);
    b.flash = Math.max(0, b.flash - dt);
    b.hitFlash = Math.max(0, b.hitFlash - dt);

    const recoiling = b.state === 'recoil';
    const desired = recoiling ? b.recoilAngle : Math.atan2(BOSS_FISH.y - b.y, BOSS_FISH.x - b.x);
    const turnRate = recoiling ? 1.7 : 1.25;
    b.angle = angleLerp(b.angle, desired, 1 - Math.exp(-dt * turnRate));
    const speed = recoiling ? 26 : 8.4;
    b.x += Math.cos(b.angle) * speed * dt;
    b.y += Math.sin(b.angle) * speed * dt;
    if (recoiling) {
      b.stateT -= dt;
      if (b.stateT <= 0) b.state = 'approach';
    }
    b.x = clamp(b.x, 60, W - 30);
    b.y = clamp(b.y, 78, H - 20);
    updateBossSpine(b, dt);
    if (Math.random() < dt * 2.8) {
      addParticle(b.x + rand(-20, 20), b.y + rand(-14, 14), rand(-6, 6), rand(-18, -3),
        rand(0.4, 1.1), choice(['#8fd8ef', '#b9e8f0', '#5b8f9c']), 1, -8, 0.98);
    }
    if (Math.hypot(b.x - BOSS_FISH.x, b.y - BOSS_FISH.y) < BOSS_CONTACT) {
      endBoss(false);
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

  function onHit(b, kind) {
    if (kind === 'ak') {
      const dir = Math.atan2(b.y - BOSS_GUN.y, b.x - BOSS_GUN.x);
      b.x += Math.cos(dir) * 0.35;
      b.y += Math.sin(dir) * 0.35;
    } else if (kind === 'sniper') {
      const away = Math.atan2(b.y - BOSS_FISH.y, b.x - BOSS_FISH.x);
      b.state = 'recoil';
      b.stateT = 2.6;
      b.recoilAngle = away;
      b.x += Math.cos(away) * 4;
      b.y += Math.sin(away) * 4;
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
