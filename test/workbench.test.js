// 合成台共用件（workbench.js）：bank 指令统一处理 / craftSlots 同步 —— 全章节同一套工作台操作
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { bankStone, syncCraftSlots } from '../public/js/workbench.js';
import { createGame, startGame, gameEvent } from '../public/js/ch2.js';
import { createInventory } from '../public/js/hotbar.js';

function makeW(slots = [null, null, null, null]) {
  const calls = { sfx: [], refreshed: 0, placed: [] };
  const inv = createInventory();
  return {
    calls, game: { inv },
    view: {},
    sfx: { itemIn() { calls.sfx.push('itemIn'); } },
    hb: {
      getSlots: () => slots,
      refresh() { calls.refreshed++; },
      placeNext(ipa) { calls.placed.push(ipa); }
    }
  };
}

test('bankStone：存石 = 音效 + 刷库存 + 自动进槽（第一/二/三/四关同一条路径）', () => {
  const w = makeW();
  bankStone(w, { t: 'bank', ipa: 'h' });
  assert.deepEqual(w.calls.sfx, ['itemIn']);
  assert.equal(w.calls.refreshed, 1);
  assert.deepEqual(w.calls.placed, ['h']);        // placeNext 交给 hotbar（placeNextIndex 已在 hotbar.test 覆盖）
});

test('bankStone：placeNext 缺失时静默降级（旧物品栏接口不炸）', () => {
  const w = makeW();
  delete w.hb.placeNext;
  assert.doesNotThrow(() => bankStone(w, { t: 'bank', ipa: 'h' }));
  assert.equal(w.calls.refreshed, 1);
});

test('syncCraftSlots：合成槽 → view.craftSlots（台面显示用）', () => {
  const w = makeW(['h', 'ə', null, null]);
  syncCraftSlots(w);
  assert.deepEqual(w.view.craftSlots, ['h', 'ə', null, null]);
});

test('syncCraftSlots：无物品栏时置 null，不抛错', () => {
  const w = { view: {}, game: { inv: createInventory() } };
  syncCraftSlots(w);
  assert.equal(w.view.craftSlots, null);
  const noView = { game: { inv: createInventory() } };
  assert.doesNotThrow(() => syncCraftSlots(noView));
});

// 端到端（事件机层）：第二关 BANK 指令流 → bankStone 后槽位推进，四块齐自动可合成
test('第二关流程：逐块存石 → bankStone 依次进槽（与第一关新操作一致）', async () => {
  const content = JSON.parse(await readFile(new URL('../content/chapter2.json', import.meta.url), 'utf8'));
  const g = createGame(content, { abilities: [], everPicked: [] });
  startGame(g);
  let out = gameEvent(g, 'CHASM');
  const slots = [null, null, null, null];
  const w = {
    game: g, view: {},
    sfx: { itemIn() {} },
    hb: {
      refresh() {},
      placeNext(ipa) {
        const i = slots.indexOf(null);
        if (i >= 0) slots[i] = ipa;
      }
    }
  };
  for (const [ipa] of content.words.jump.phonemes) {
    out = out.concat(gameEvent(g, 'PICKUP', ipa));
    out = out.concat(gameEvent(g, 'BANK'));
  }
  // 按 shell 解释器语义重放 bank 指令（kit.runExtras 覆盖已被标准指令取代）
  for (const ins of out) if (ins.t === 'bank') bankStone(w, ins);
  assert.deepEqual(slots, ['dʒ', 'ʌ', 'm', 'p']);
});
