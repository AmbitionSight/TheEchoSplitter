import { PAL } from './art.js';

function thick(x, w = 4.5) { x.lineWidth = w; x.strokeStyle = PAL.ink; x.lineJoin = 'round'; x.lineCap = 'round'; }
function shadow(x, cx, cy, rx) {
  x.fillStyle = 'rgba(0,0,0,.28)';
  x.beginPath(); x.ellipse(cx, cy, rx, rx * 0.34, 0, 0, 7); x.fill();
}

export function createActors() {
  return {
    player: { x: 560, y: 600, facing: 1, walkT: 0, moving: false, hatOn: false },
    npc: { x: 400, y: 430, facing: 1, mouth: 0, gesture: 'idle', gestureT: 0, gestureDur: 0 },
    cat: { x: 560, y: 560, earT: 0, meowT: 0 }
  };
}

export function setGesture(npc, name, dur = 1.6) {
  npc.gesture = name; npc.gestureT = 0; npc.gestureDur = dur;
}

export function updateActors(a, dt) {
  a.npc.gestureT += dt;
  if (a.npc.gestureT > a.npc.gestureDur) a.npc.gesture = 'idle';
  a.npc.mouth = Math.max(0, a.npc.mouth - dt * 3.2);
  a.cat.earT = Math.max(0, a.cat.earT - dt);
  a.cat.meowT = Math.max(0, a.cat.meowT - dt);
}

// —— 小孩：蓝兜帽，Q 版大头，腿部交替 ——
export function drawPlayer(x, p, t) {
  const bob = p.moving ? Math.abs(Math.sin(p.walkT * 9)) * 3 : Math.sin(t * 2) * 1.2;
  shadow(x, p.x, p.y + 2, 20);
  x.save();
  x.translate(p.x, p.y - bob);
  x.scale(p.facing, 1);
  // 腿
  thick(x, 5, PAL.ink);
  x.strokeStyle = PAL.ink; x.fillStyle = '#3a4a6b';
  const step = p.moving ? Math.sin(p.walkT * 9) * 7 : 0;
  x.fillRect(-9 + step * 0.4, -10, 7, 12);
  x.fillRect(2 - step * 0.4, -10, 7, 12);
  // 身体
  x.fillStyle = '#4a7bd4';
  x.beginPath();
  x.moveTo(-13, -8); x.quadraticCurveTo(-15, -34, 0, -36); x.quadraticCurveTo(15, -34, 13, -8); x.closePath();
  x.fill(); thick(x); x.stroke();
  // 兜帽（先画：蓝环+下颌垂布，框住脸）+ 头
  x.fillStyle = '#4a7bd4';
  x.beginPath();
  x.arc(0, -50, 21, Math.PI * 0.85, Math.PI * 2.15);
  x.quadraticCurveTo(0, -24, -18.71, -40.47);   // 从弧终点经下颌垂布回到弧起点（精确闭合）
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#f2c99b';
  x.beginPath(); x.arc(0, -48, 15, 0, 7); x.fill(); x.stroke();
  // 脸
  x.fillStyle = PAL.ink;
  x.beginPath(); x.arc(4, -48, 1.9, 0, 7); x.fill();
  x.beginPath(); x.arc(11, -48, 1.9, 0, 7); x.fill();
  x.beginPath(); x.arc(6, -43, 3.2, 0.15, Math.PI - 0.15); x.stroke();
  // 草帽（hatOn 时戴上，规格 §4）
  if (p.hatOn) {
    x.fillStyle = PAL.hat;
    x.beginPath(); x.ellipse(5, -62, 22, 7, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-7, -61); x.quadraticCurveTo(5, -82, 17, -61); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = PAL.hatD; x.fillRect(-5, -67, 24, 4);
  }
  x.restore();
}

// —— 大叔：棕袍大胡子，手势系统 ——
export function drawNpc(x, n, t) {
  const g = n.gesture, gt = n.gestureT;
  const bounce = g === 'laugh' ? Math.abs(Math.sin(gt * 10)) * 4 : Math.sin(t * 1.6) * 1.2;
  const tilt = g === 'tilt' ? Math.sin(gt * 2) * 0.12 : g === 'nod' ? Math.max(0, Math.sin(gt * 6)) * 0.2 : 0;
  shadow(x, n.x, n.y + 2, 26);
  x.save();
  x.translate(n.x, n.y - bounce);
  x.scale(n.facing, 1);
  x.rotate(tilt);
  // 腿脚
  x.fillStyle = '#4a3a2c';
  x.fillRect(-12, -8, 9, 10); x.fillRect(3, -8, 9, 10);
  // 袍身
  x.fillStyle = '#8a6a4a';
  x.beginPath();
  x.moveTo(-18, 0); x.quadraticCurveTo(-22, -40, 0, -44); x.quadraticCurveTo(22, -40, 18, 0); x.closePath();
  x.fill(); thick(x, 5); x.stroke();
  // 手臂（手势驱动）
  thick(x, 5);
  x.strokeStyle = PAL.ink; x.fillStyle = '#8a6a4a';
  const arm = (side, ang) => {
    x.save();
    x.translate(side * 15, -34);
    x.rotate(ang);
    x.beginPath(); x.roundRect ? x.roundRect(-4, 0, 8, 22, 4) : x.rect(-4, 0, 8, 22);
    x.fill(); x.stroke();
    x.fillStyle = '#f2c99b';
    x.beginPath(); x.arc(0, 24, 5, 0, 7); x.fill(); x.stroke();
    x.restore();
  };
  let la = 0.5, ra = -0.5;                                    // 下垂
  if (g === 'wave') ra = -2.2 + Math.sin(gt * 8) * 0.5;
  if (g === 'point') { ra = -1.35; la = 0.7; }
  if (g === 'laugh') { ra = -2.4 + Math.sin(gt * 10) * 0.25; la = 2.4 - Math.sin(gt * 10) * 0.25; }
  arm(-1, la); arm(1, ra);
  // 头（秃顶+侧发）
  x.fillStyle = '#e8bd8f';
  x.beginPath(); x.arc(0, -58, 16, 0, 7); x.fill(); thick(x, 5); x.stroke();
  x.fillStyle = '#b8b2a8';
  x.beginPath(); x.arc(-14, -56, 5, 0, 7); x.fill();
  x.beginPath(); x.arc(14, -56, 5, 0, 7); x.fill();
  // 大胡子 + 口型（mouth 0..1）
  x.fillStyle = '#cfc8bb';
  x.beginPath();
  x.moveTo(-13, -52); x.quadraticCurveTo(0, -30, 13, -52); x.quadraticCurveTo(0, -44, -13, -52);
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = PAL.ink;
  x.beginPath(); x.ellipse(4, -50, 2.6 + n.mouth * 2, 1.6 + n.mouth * 4, 0, 0, 7); x.fill();
  x.beginPath(); x.arc(-2, -60, 2, 0, 7); x.fill();
  x.beginPath(); x.arc(9, -60, 2, 0, 7); x.fill();
  x.restore();
}

// —— 橘猫：坐姿，竖耳+尾巴+喵 ——
export function drawCat(x, c, t) {
  shadow(x, c.x, c.y + 2, 18);
  x.save();
  x.translate(c.x, c.y);
  const ear = c.earT > 0 ? 1.25 : 1;
  // 尾巴
  thick(x, 5);
  x.strokeStyle = PAL.ink; x.fillStyle = '#e8913f';
  x.beginPath();
  x.moveTo(-14, -6);
  x.quadraticCurveTo(-30, -14 + Math.sin(t * 2.2) * 4, -26, -30 + Math.sin(t * 2.2) * 3);
  x.stroke();
  // 坐姿身体
  x.beginPath();
  x.ellipse(0, -12, 15, 13, 0, 0, 7); x.fill(); thick(x); x.stroke();
  // 头 + 耳
  x.beginPath(); x.arc(0, -30, 11, 0, 7); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(-9, -37); x.lineTo(-4, -37 - 9 * ear); x.lineTo(-1, -37); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(1, -37); x.lineTo(4, -37 - 9 * ear); x.lineTo(9, -37); x.closePath(); x.fill(); x.stroke();
  // 脸
  x.fillStyle = PAL.ink;
  x.beginPath(); x.arc(-4, -31, 1.6, 0, 7); x.fill();
  x.beginPath(); x.arc(4, -31, 1.6, 0, 7); x.fill();
  if (c.meowT > 0) { x.beginPath(); x.ellipse(0, -26, 2.4, 3, 0, 0, 7); x.fill(); }
  else { x.beginPath(); x.moveTo(-2, -26); x.lineTo(2, -26); x.stroke(); }
  // 条纹
  x.strokeStyle = '#c4762c'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(-6, -20); x.lineTo(-6, -14); x.moveTo(0, -21); x.lineTo(0, -14); x.moveTo(6, -20); x.lineTo(6, -14); x.stroke();
  x.restore();
}
