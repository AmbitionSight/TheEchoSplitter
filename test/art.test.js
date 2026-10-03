import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { PAL, RUNE_STROKES, ICON_TYPES, drawIcon, drawRune, drawBulb, drawCross } from '../public/js/art.js';

const data = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));

function makeCtx() { // 记录型 canvas 桩
  const calls = { moveTo: 0, lineTo: 0, arc: 0, fill: 0, stroke: 0 };
  const grad = { addColorStop() {} };
  return new Proxy({ __calls: calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      return () => { if (k in calls) calls[k]++; };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

test('48 个卢文字形都有折线数据（0..1 归一，线段合法）', () => {
  const glyphs = Object.values(data.phonemeBook.runes);
  assert.equal(new Set(glyphs).size, 48);
  for (const g of glyphs) {
    const segs = RUNE_STROKES[g];
    assert.ok(Array.isArray(segs) && segs.length >= 1, `${g} 缺折线`);
    for (const [x1, y1, x2, y2] of segs) {
      for (const n of [x1, y1, x2, y2]) assert.ok(Number.isFinite(n) && n >= 0 && n <= 1, `${g} 坐标越界`);
    }
  }
});

test('PAL 与 ICON_TYPES 齐备', () => {
  for (const k of ['ink','vowel','cons','glowRune','gold','uiBlue']) assert.ok(PAL[k]);
  assert.deepEqual([...ICON_TYPES].sort(), ['fire','gem','hat','hello','jump','light','log','open','pole','raft','rope','switch','water']);
});

test('drawIcon / drawRune 在桩 ctx 上可执行且确实作画', () => {
  const ctx = makeCtx();
  for (const t of ICON_TYPES) drawIcon(ctx, t, 100, 100, 64);
  drawBulb(ctx, 100, 100);
  drawCross(ctx, 100, 100);
  assert.ok(ctx.__calls.moveTo + ctx.__calls.arc > 10);
  const r = makeCtx();
  drawRune(r, data.phonemeBook.runes['ə'], 50, 50, 40, '#fff');
  assert.ok(r.__calls.moveTo >= 1 && r.__calls.lineTo >= 1);
});
