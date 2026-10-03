// —— 析声者 · 第四关渲染层：自 ch4.js 绘制段原样迁入（房间/岸边/裂隙/深水/木筏/气泡）——
import { SIDE, drawBenchSide } from '../sideview.js';
import { PAL, drawCross } from '../art.js';

export function currentGround(w) {
  return w.currentRoom === 'crevice' ? w.geo.crevice.groundY : w.currentRoom === 'deep' ? w.geo.deep.groundY : w.geo.bank.groundY;
}

export function drawRoom(w, x) {
  const room = w.currentRoom;
  const ground = currentGround(w);
  const g = x.createLinearGradient(0, 0, 0, SIDE.H);
  g.addColorStop(0, room === 'deep' ? '#142b3a' : room === 'crevice' ? '#20242d' : '#1d2834');
  g.addColorStop(1, '#090c12');
  x.fillStyle = g;
  x.fillRect(0, 0, SIDE.W, SIDE.H);
  x.fillStyle = room === 'deep' ? '#17445c' : '#3c4650';
  x.fillRect(0, ground, SIDE.W, SIDE.H - ground);
  x.fillStyle = 'rgba(255,255,255,.09)';
  x.fillRect(0, ground, SIDE.W, 3);
  x.strokeStyle = 'rgba(255,255,255,.08)';
  x.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const px = (i * 97 + 31) % SIDE.W;
    x.beginPath(); x.moveTo(px, 70 + (i % 5) * 72); x.lineTo(px + 40, 86 + (i % 5) * 72); x.stroke();
  }
  if (room === 'bank') {
    x.fillStyle = '#27343c'; x.fillRect(760, ground - 2, SIDE.W - 760, SIDE.H - ground + 2);
    x.strokeStyle = 'rgba(130,220,240,.45)';
    for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(770, ground + 28 + i * 24); x.quadraticCurveTo(930, ground + 12 + i * 24, 1120, ground + 30 + i * 24); x.stroke(); }
  }
}

export function drawBankObjects(w, x) {
  const geo = w.geo.bank;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = '#67727d'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  x.beginPath(); x.roundRect ? x.roundRect(565, geo.groundY - 100, 150, 90, 12) : x.rect(565, geo.groundY - 100, 150, 90); x.fill(); x.stroke();
  x.fillStyle = '#b28a58'; x.fillRect(590, geo.groundY - 70, 100, 12);
  x.fillStyle = '#6b7078';
  x.beginPath(); x.moveTo(geo.doorX - 55, geo.groundY); x.lineTo(geo.doorX - 35, geo.groundY - 130); x.lineTo(geo.doorX + 35, geo.groundY - 130); x.lineTo(geo.doorX + 55, geo.groundY); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#10151b';
  x.beginPath(); x.moveTo(geo.doorX - 24, geo.groundY); x.lineTo(geo.doorX - 18, geo.groundY - 110); x.lineTo(geo.doorX + 18, geo.groundY - 110); x.lineTo(geo.doorX + 24, geo.groundY); x.closePath(); x.fill();
  if (w.game.logPlaced) drawLog(x, geo.waterX - 25, geo.groundY - 16);
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
  x.fillStyle = '#2d3941'; x.fillRect(geo.waterX - 4, geo.groundY - 4, 8, 8);
}

export function drawCreviceObjects(w, x) {
  const geo = w.geo.crevice;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = '#10151c'; x.strokeStyle = '#75808b'; x.lineWidth = 8;
  x.beginPath(); x.moveTo(500, 0); x.lineTo(560, 160); x.lineTo(520, 310); x.lineTo(610, 455); x.lineTo(560, geo.groundY); x.lineTo(820, geo.groundY); x.lineTo(760, 430); x.lineTo(820, 280); x.lineTo(750, 120); x.lineTo(790, 0); x.closePath(); x.fill(); x.stroke();
  drawLog(x, geo.logX, geo.groundY - 16);
  x.strokeStyle = '#c1a76b'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(810, 180); x.lineTo(900, 240); x.lineTo(980, 180); x.lineTo(1040, 250); x.stroke();
  x.beginPath(); x.moveTo(830, 180); x.lineTo(850, 300); x.moveTo(940, 210); x.lineTo(940, 320); x.stroke();
  x.fillStyle = '#c1a76b'; x.font = '18px system-ui'; x.fillText('◼  ◼  ◼', 820, 365);
}

export function drawDeepObjects(w, x) {
  const geo = w.geo.deep;
  if (w.game.stalled) drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = 'rgba(120,205,230,.10)'; x.fillRect(0, geo.groundY - 80, SIDE.W, 80);
  x.strokeStyle = '#c1a76b'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(geo.muralX - 120, 190); x.lineTo(geo.muralX, 100); x.lineTo(geo.muralX + 110, 190); x.stroke();
  x.beginPath(); x.moveTo(geo.muralX - 65, 150); x.lineTo(geo.muralX - 20, 270); x.lineTo(geo.muralX + 30, 150); x.stroke();
  x.beginPath(); x.moveTo(geo.muralX - 80, 230); x.lineTo(geo.muralX + 85, 230); x.stroke();
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
  x.fillStyle = 'rgba(255,221,140,.5)'; x.font = '18px system-ui'; x.fillText('石壁上的撑篙图', geo.muralX - 88, 310);
}

function drawLog(x, cx, cy) {
  x.save(); x.translate(cx, cy); x.rotate(-0.08);
  x.fillStyle = '#9a6536'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  x.beginPath(); x.roundRect ? x.roundRect(-78, -18, 156, 36, 16) : x.rect(-78, -18, 156, 36); x.fill(); x.stroke();
  x.fillStyle = '#d0a064'; x.beginPath(); x.ellipse(-78, 0, 16, 18, 0, 0, 7); x.fill(); x.stroke();
  x.strokeStyle = '#6f4327'; x.lineWidth = 3; x.beginPath(); x.ellipse(-78, 0, 8, 11, 0, 0, 7); x.stroke();
  x.restore();
}

function drawRaft(x, cx, cy, t) {
  const bob = Math.sin(t * 2.2) * 4;
  x.save(); x.translate(cx, cy + bob);
  x.fillStyle = '#8e5e33'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  for (let i = -2; i <= 2; i++) { x.beginPath(); x.roundRect ? x.roundRect(i * 28 - 72, -14, 144, 22, 8) : x.rect(i * 28 - 72, -14, 144, 22); x.fill(); x.stroke(); }
  x.strokeStyle = '#d5b56b'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(-68, -20); x.lineTo(68, 10); x.moveTo(-68, 10); x.lineTo(68, -20); x.stroke();
  x.restore();
}

export function drawBubble(x, p, t) {
  const a = Math.min(1, t / 0.4);
  const bx = p.x + 12, by = p.y - 110;
  x.save(); x.globalAlpha = a; x.fillStyle = 'rgba(247,244,234,.96)'; x.strokeStyle = PAL.ink; x.lineWidth = 3;
  x.beginPath(); x.roundRect ? x.roundRect(bx - 52, by - 32, 104, 58, 14) : x.rect(bx - 52, by - 32, 104, 58); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(bx - 8, by + 26); x.lineTo(bx + 2, by + 40); x.lineTo(bx + 12, by + 26); x.closePath(); x.fill(); x.stroke();
  drawCross(x, bx + 12, by - 2, 26);
  x.restore();
}
