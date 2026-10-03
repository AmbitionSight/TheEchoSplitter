// 第一间房 kit 的浏览器路径回归：鼠标「走过去自动交互」（tick 内）；合成台共用件见 workbench.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, kit } from '../public/js/main.js';
import { createActors } from '../public/js/actors.js';

const content = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));

function makeW() {
  const game = createGame(content);
  const w = {
    game, content,
    view: { t: 0, lit: 0, doorState: 'closed', doorPulse: 0, doorOpen: 0,
            bloomed: false, hatOn: false, switchOn: false, benchHot: false },
    sc: { lit: 0, dust: [] },
    ritual: { active: false, t: 0, seated: 0 },
    actors: createActors(),
    stones: [],
    keys: new Set(),
    walkTarget: null, pendingInteract: null, lastPX: 0, lastPY: 0, stuckT: 0,
    sfx: { click() {}, glowTick() {}, itemIn() {} },
    ui: { setHint() {} },
    hb: null,
    ran: [], doeGot: null,
    run(ins) { this.ran.push(...ins); },
    doE(t) { this.doeGot = t; this.sfx.click(); kit.onE(this, t); }   // 与 shell.js 的 doE 等价
  };
  return w;
}

test('回归：鼠标点物件，走到后自动触发交互（原 w.doEFor 幽灵调用）', () => {
  const w = makeW();
  const p = w.actors.player;
  p.x = 490; p.y = 430;                                   // 目标 npc(400,430) 旁边
  w.walkTarget = { x: p.x, y: p.y };                      // 立即到达
  w.pendingInteract = { kind: 'obj', id: 'npc' };
  assert.doesNotThrow(() => kit.tick(w, 1 / 60));
  assert.deepEqual(w.doeGot, { kind: 'obj', id: 'npc' });
  assert.equal(w.game.helloDropped, true);                // INTERACT npc 真正执行
  assert.equal(w.pendingInteract, null);
  assert.equal(w.walkTarget, null);
});

test('回归：鼠标点石头，走到后自动拾取', () => {
  const w = makeW();
  const p = w.actors.player;
  p.x = 600; p.y = 600;
  w.stones.push({ ipa: 'h', x: 600, y: 600, state: 'idle', to: null, phase: 0 });
  w.walkTarget = { x: 600, y: 600 };
  w.pendingInteract = { kind: 'stone', ipa: 'h' };
  assert.doesNotThrow(() => kit.tick(w, 1 / 60));
  assert.equal(w.stones.length, 0);
  assert.deepEqual(w.game.hand, { kind: 'stone', ipa: 'h' });
});
