import { PAL, drawIcon } from './art.js';
import { drawChar } from './sprites.js';

function thick(x, w = 4.5) { x.lineWidth = w; x.strokeStyle = PAL.ink; x.lineJoin = 'round'; x.lineCap = 'round'; }
function shadow(x, cx, cy, rx) {
  x.fillStyle = 'rgba(0,0,0,.28)';
  x.beginPath(); x.ellipse(cx, cy, rx, rx * 0.34, 0, 0, 7); x.fill();
}

export function createActors() {
  return {
    player: { x: 560, y: 600, facing: 1, dir: 'down', walkT: 0, moving: false, hatOn: false },
    npc: { x: 400, y: 430, facing: 1, mouth: 0, gesture: 'idle', gestureT: 0, gestureDur: 0 },
    cat: { x: 505, y: 632, earT: 0, meowT: 0 }
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

// —— 小孩：MI 角色（Alex 块；走 3 帧 / 站姿微浮）——
// 帧序 0,1,2,1：中间帧 1 是双脚着地的中立姿，0/2 为左右迈步帧
export function drawPlayer(x, p, t, imgs) {
  const dir = p.dir || 'down';
  const frame = p.moving ? [0, 1, 2, 1][Math.floor(p.walkT * 4.5) % 4] : 1;
  const bob = p.moving ? 0 : Math.sin(t * 2) * 1.2;
  shadow(x, p.x, p.y + 2, 18);
  if (!imgs) {                                                   // 图集未加载的兜底：色块
    x.fillStyle = '#4a7bd4'; x.fillRect(p.x - 9, p.y - 40 + bob, 18, 40);
    x.fillStyle = '#f2c99b'; x.beginPath(); x.arc(p.x, p.y - 48 + bob, 12, 0, 7); x.fill();
    return;
  }
  drawChar(x, imgs, 'kid', dir, frame, p.x, p.y - bob);
  const side = dir === 'left' ? -1 : 1;
  // 草帽（hatOn 时戴上，规格 §4）
  if (p.hatOn) {
    x.save();
    x.translate(p.x, p.y - bob);
    thick(x, 3);
    x.fillStyle = PAL.hat;
    x.beginPath(); x.ellipse(side * 2, -64, 20, 6, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(side * 2 - 11, -63); x.quadraticCurveTo(side * 2, -82, side * 2 + 11, -63); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = PAL.hatD; x.fillRect(side * 2 - 10, -68, 20, 3);
    x.restore();
  }
  // 手持（v2：音素石或词具拿在手上）
  if (p.held) {
    const hx = p.x + side * 15, hy = p.y - bob - 30;
    x.fillStyle = p.heldVowel ? '#ffd166' : '#6fb7ff';
    x.beginPath(); x.arc(hx, hy, 9, 0, 7); x.fill();
    x.lineWidth = 2.5; x.strokeStyle = PAL.ink; x.stroke();
    x.fillStyle = PAL.ink; x.font = 'bold 8px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(p.held, hx, hy);
  } else if (p.heldIcon) {
    drawIcon(x, p.heldIcon, p.x + side * 15, p.y - bob - 32, 30);
  }
}

// —— 大叔：MI 角色（Bob 块）；手势 = 整体动势（说笑弹跳/招手摇晃/点头前倾）——
export function drawNpc(x, n, t, imgs) {
  const g = n.gesture, gt = n.gestureT;
  const bounce = g === 'laugh' ? Math.abs(Math.sin(gt * 10)) * 4 : Math.sin(t * 1.6) * 1.2;
  const tilt = g === 'tilt' ? Math.sin(gt * 2) * 0.12 : g === 'nod' ? Math.max(0, Math.sin(gt * 6)) * 0.2 : 0;
  const rock = g === 'wave' ? Math.sin(gt * 9) * 0.08 : 0;
  const hop = g === 'wave' ? Math.sin(gt * 9) * 3 : 0;
  const frame = n.mouth > 0.15 ? [0, 1][Math.floor(t * 8) % 2] : 1;      // 说话轻踏 / 站姿
  shadow(x, n.x, n.y + 2, 22);
  if (!imgs) {                                                   // 兜底：色块
    x.fillStyle = '#8a6a4a'; x.fillRect(n.x - 14, n.y - 44 - bounce, 28, 44);
    return;
  }
  x.save();
  x.translate(n.x + hop, n.y - bounce);
  x.rotate(tilt + rock);
  drawChar(x, imgs, 'uncle', 'down', frame, 0, 0);
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
