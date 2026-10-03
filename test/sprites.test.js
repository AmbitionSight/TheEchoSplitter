// 精灵表回归：矩形越界、源码引用名缺失、角色格越界、blit/tile 基本行为（假 ctx，无 DOM）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPR, ATLASES, CHAR_BLOCK, charRect, blit, tile, drawChar } from '../public/js/sprites.js';

const JS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js');

function fakeCtx() {
  const calls = [];
  return {
    calls, globalAlpha: 1,
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(x, y) { calls.push(['translate', x, y]); },
    scale(x, y) { calls.push(['scale', x, y]); },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { calls.push(['drawImage', sx, sy, sw, sh, dx, dy, dw, dh]); }
  };
}
const fakeImg = { tag: 'img' };

test('所有精灵矩形都在对应图集范围内', () => {
  for (const [name, s] of Object.entries(SPR)) {
    const at = ATLASES[s.a];
    assert.ok(at, `${name}: 未知图集 ${s.a}`);
    assert.ok(s.x >= 0 && s.y >= 0 && s.w > 0 && s.h > 0, `${name}: 非法矩形`);
    assert.ok(s.x + s.w <= at.w && s.y + s.h <= at.h, `${name}: 超出图集 ${s.a}（${s.x}+${s.w} > ${at.w} 或 ${s.y}+${s.h} > ${at.h}）`);
  }
});

test('源码里 blit/tile 引用的精灵名都存在于 SPR（防漏表/拼错）', () => {
  const files = readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  const used = new Set();
  for (const f of files) {
    const src = readFileSync(join(JS_DIR, f), 'utf8');
    for (const m of src.matchAll(/\b(?:blit|tile)\([^,]+,[^,]+,\s*'([a-z_]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 5, `解析到的精灵名过少（${used.size}），正则可能失效`);   // 第二关改程序化砌石/石板后不再引用 wall_base/floor_brick
  for (const n of used) assert.ok(SPR[n], `源码引用了不存在的精灵名: ${n}`);
});

test('角色格（charRect）都在 chars.png 内，且 3 帧 x 4 向', () => {
  for (const who of Object.keys(CHAR_BLOCK)) {
    for (const dir of ['down', 'left', 'right', 'up']) {
      for (let f = 0; f < 3; f++) {
        const r = charRect(who, dir, f);
        assert.equal(r.w, 48); assert.equal(r.h, 96);
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= ATLASES.ch.w && r.y + r.h <= ATLASES.ch.h, `${who}/${dir}/${f} 越界`);
      }
    }
  }
});

test('blit 按 1:1 绘制（无缩放时 dw=sw），支持 flip/alpha', () => {
  const ctx = fakeCtx();
  blit(ctx, { mi: fakeImg }, 'rug', 100, 200);
  const d = ctx.calls.find(c => c[0] === 'drawImage');
  assert.ok(d, '应调用 drawImage');
  assert.deepEqual(d.slice(1, 5), [SPR.rug.x, SPR.rug.y, SPR.rug.w, SPR.rug.h]);
  assert.deepEqual(d.slice(5), [100, 200, SPR.rug.w, SPR.rug.h]);

  const ctx2 = fakeCtx();
  blit(ctx2, { mi: fakeImg }, 'rug', 0, 0, { flip: true, alpha: 0.5, scale: 2 });
  assert.ok(ctx2.calls.some(c => c[0] === 'scale' && c[1] === -1));
  const d2 = ctx2.calls.find(c => c[0] === 'drawImage');
  assert.equal(d2[7], SPR.rug.w * 2);                     // dw 随 scale

  const ctx3 = fakeCtx();
  blit(ctx3, null, 'rug', 0, 0);                          // 图集缺失不抛
  assert.equal(ctx3.calls.length, 0);
});

test('tile 铺满矩形且不越界绘制', () => {
  const ctx = fakeCtx();
  tile(ctx, { rb: fakeImg }, 'floor', 0, 300, 100, 70);
  const draws = ctx.calls.filter(c => c[0] === 'drawImage');
  assert.equal(draws.length, Math.ceil(100 / 32) * Math.ceil(70 / 32));   // 4x3
  for (const d of draws) {
    assert.ok(d[7] <= 32 && d[8] <= 32);                  // 边缘块裁剪
    assert.ok(d[5] >= 0 && d[5] < 100 && d[6] >= 300 && d[6] < 370);
  }
});

test('第二章新增 SPR 条目在 mi 图集内', () => {
  for (const n of ['crate_big', 'crate_sm', 'jars2', 'tree']) {
    const s = SPR[n]; assert.ok(s, `缺 ${n}`);
    assert.ok(s.x + s.w <= ATLASES[s.a].w && s.y + s.h <= ATLASES[s.a].h, `${n} 越界`);
  }
});

test('绳与窗改矢量：ch2b.js 不再引用、sprites.js 不再导出四条照片 SPR（Task 14）', () => {
  const ch2b = readFileSync(join(JS_DIR, 'ch2b.js'), 'utf8');
  const sprSrc = readFileSync(join(JS_DIR, 'sprites.js'), 'utf8');
  for (const n of ['rope_broken', 'rope_fixed', 'window_closed', 'window_open']) {
    assert.ok(!ch2b.includes(n), `ch2b.js 仍引用 ${n}`);
    assert.ok(!sprSrc.includes(n), `sprites.js 仍含 ${n}`);
    assert.ok(!SPR[n], `SPR 仍导出 ${n}`);
  }
  // §11 矢量绳三色（芯/暗边/高光）+ 生长前沿青光（84,224,200 = PAL.glowRune）
  for (const c of ['#b98d55', '#6e4526', '#d9b878']) assert.ok(ch2b.includes(c), `绳缺 ${c}`);
  assert.ok(ch2b.includes('84,224,200'), '绳端青光缺失（应改青 PAL.glowRune）');
  assert.ok(!ch2b.includes('123,216,143'), '绳端仍是旧绿光 #7bd88f');
});

test('drawChar 以脚底为锚（y - 95*scale），flip 时镜像', () => {
  const ctx = fakeCtx();
  drawChar(ctx, { ch: fakeImg }, 'kid', 'down', 1, 500, 600);
  const d = ctx.calls.find(c => c[0] === 'drawImage');
  assert.equal(d[6], 600 - 95);                           // dy = y - 95
  assert.equal(d[5], 500 - 24);                           // dx = x - w/2
  const ctx2 = fakeCtx();
  drawChar(ctx2, { ch: fakeImg }, 'uncle', 'left', 0, 10, 20, { flip: true, scale: 2 });
  assert.ok(ctx2.calls.some(c => c[0] === 'scale' && c[1] === -1));
  const d2 = ctx2.calls.find(c => c[0] === 'drawImage');
  assert.equal(d2[7], 96);                                // 48*2
  assert.equal(d2[8], 192);                               // 96*2
});
