import { test } from 'node:test';
import assert from 'node:assert';
import { shade, paintMasonry, paintSlabs, BAYER, pixelGradientV, pixelGlow } from '../public/js/masonry.js';
import { masonryPlan, slabPlan } from '../public/js/ch1/planners.js';

// 模拟 2D context：任何方法调用皆安全、任何属性可写（只断言"不抛"，不断言像素）
function mockCtx() {
  const grad = { addColorStop() {} };
  const bag = {};
  return new Proxy(bag, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(0, w) * Math.max(0, h) * 4) });
      if (typeof k !== 'string') return undefined;
      return k in t ? t[k] : () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

// pixelGlow 在浏览器里用离屏 canvas（document.createElement）；Node 无 DOM，
// 给最小桩让"不抛错"路径可测（真机渲染路径不变）。
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => mockCtx() }) };

test('shade：按比例提亮/压暗，越界钳到 0..255', () => {
  assert.equal(shade('#808080', 0), 'rgb(128,128,128)');
  assert.equal(shade('#808080', 0.5), 'rgb(192,192,192)');
  assert.equal(shade('#808080', -0.5), 'rgb(64,64,64)');
  assert.equal(shade('#ffffff', 0.5), 'rgb(255,255,255)');   // 不越 255
  assert.equal(shade('#000000', -0.5), 'rgb(0,0,0)');        // 不越 0
});

test('paintMasonry/paintSlabs：照规划器上色不抛错（mock ctx）', () => {
  const x = mockCtx();
  assert.doesNotThrow(() => paintMasonry(x, masonryPlan(23, 1280, 284), 1280, 284));
  assert.doesNotThrow(() => paintSlabs(x, slabPlan(31, 1280, 300, 420), 1280, 300, 420));
  assert.doesNotThrow(() => paintMasonry(x, masonryPlan(23, 0, 284), 0, 284));   // 退化宽度
  assert.doesNotThrow(() => paintSlabs(x, slabPlan(31, 1280, 300, 0), 1280, 300, 0)); // 退化高度
});

test('paintMasonry 覆盖范围随传入 W/faceH（不写死第一关尺寸）', () => {
  const fills = [];
  const x = new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'fillRect') return (a, b, w, h) => fills.push([a, b, w, h]);
      if (k === 'beginPath' || k === 'moveTo' || k === 'lineTo' || k === 'stroke' || k === 'save' || k === 'restore') return () => {};
      return () => undefined;
    },
    set() { return true; }
  });
  paintMasonry(x, [], 640, 200);                 // 空规划：只剩灰浆底 + 顶暗，宽度应为 640
  assert.ok(fills.some(([, , w, h]) => w === 640 && h === 200), '灰浆底应按传入 W/faceH');
  assert.ok(BAYER.length === 2 && BAYER[0].length === 2, '拜耳矩阵 2×2');
});

test('pixelGradientV：色带量化 + 拜耳抖动（mock ctx 不抛错）', () => {
  const x = mockCtx();
  assert.doesNotThrow(() => pixelGradientV(x, 0, 100, 0, 60, [[0, '#000000'], [1, '#ffffff']]));
});
test('pixelGlow：抖动光斑（mock ctx 不抛错）', () => {
  const x = mockCtx();
  assert.doesNotThrow(() => pixelGlow(x, 50, 50, 40, [255, 198, 112], 0.3));
});
