import { test } from 'node:test';
import assert from 'node:assert';
import { scoreVoice, pickVoices, estimateMs, Speech, Sfx, SpeechQueue } from '../public/js/audio.js';

const VOICES = [
  { name: 'Microsoft David', lang: 'en-US', localService: true },
  { name: 'Microsoft Zira', lang: 'en-US', localService: true },
  { name: 'Google UK English Female', lang: 'en-GB', localService: false },
  { name: 'Microsoft Huihui', lang: 'zh-CN', localService: true }
];

test('音色打分：非英语淘汰；大叔=男声；童声=女声', () => {
  assert.ok(scoreVoice(VOICES[3], 'uncle') < 0);
  assert.ok(scoreVoice(VOICES[0], 'uncle') > scoreVoice(VOICES[1], 'uncle'));
  assert.ok(scoreVoice(VOICES[1], 'child') > scoreVoice(VOICES[0], 'child'));
  const picked = pickVoices(VOICES);
  assert.equal(picked.uncle.name, 'Microsoft David');
  assert.equal(['Microsoft Zira', 'Google UK English Female'].includes(picked.child.name), true);
  assert.ok(picked.door);
});

test('estimateMs：词数×380/rate，下限 650', () => {
  assert.equal(estimateMs('Hello!', 1), 650);       // 1 词 380 → 下限 650
  assert.equal(estimateMs('Open… open… open the door!', 1), 5 * 380);
  assert.equal(estimateMs('Open the door', 0.5), 3 * 380 / 0.5);
});

test('无 speechSynthesis：立即 resolves，流程不卡死', async () => {
  const s = new Speech(null, null);
  let started = false;
  const t0 = Date.now();
  await s.speak('Hello! Yes, you!', { onStart: () => { started = true; } });
  assert.ok(started);
  assert.ok(Date.now() - t0 < 500);
});

test('有 synth 且触发 onend：按 onend 收束', async () => {
  const synth = { speak(u) { setTimeout(() => u.onend && u.onend(), 30); } };
  const s = new Speech(synth, t => ({ text: t }));
  await s.speak('Light.', {});
  assert.ok(true);
});

test('有 synth 但永不 onend：估时兜底收束', async () => {
  const synth = { speak() {} };
  const s = new Speech(synth, t => ({ text: t }));
  const t0 = Date.now();
  await s.speak('Open.', { rate: 1 });   // 1 词 → 650 + 400 缓冲
  const dt = Date.now() - t0;
  assert.ok(dt >= 500 && dt < 2000, `耗时异常: ${dt}`);
});

test('有 synth 但永不 onstart（移动端哑火）：1.2s 看门狗取消放行，不堵队列（回归）', async () => {
  const synth = { speak() {}, cancel() {} };
  const s = new Speech(synth, t => ({ text: t }));
  const t0 = Date.now();
  await s.speak('Open the door!', { rate: 1 });   // 长句：旧实现要等满 5×380+400≈2.3s
  const dt = Date.now() - t0;
  assert.ok(dt >= 1000 && dt < 2200, `看门狗耗时异常: ${dt}`);
});

test('warmup：静音预热不抛错、有 synth 即触发 speak', async () => {
  let spoke = 0;
  const synth = { speak(u) { spoke++; if (u.onend) setTimeout(() => u.onend(), 10); } };
  const s = new Speech(synth, t => ({ text: t, volume: 1 }));
  s.warmup();
  assert.equal(spoke, 1);
  const s2 = new Speech(null, null);
  s2.warmup();                                     // 无 synth：静默通过
  assert.ok(true);
});

test('Sfx：假 AudioContext 上创建振荡器并排包络', () => {
  const made = [];
  const node = () => {
    const n = { connects: 0, started: 0, stopped: 0 };
    return new Proxy(n, {
      get(t, k) {
        if (k === 'connect') return () => { t.connects++; };
        if (k === 'start') return () => { t.started++; };
        if (k === 'stop') return () => { t.stopped++; };
        if (k === 'frequency' || k === 'gain') return { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
        if (k === 'type' || k === 'buffer' || k === 'value' || k === 'currentTime' || k === 'destination' || k === 'sampleRate') return t[k];
        return t[k];
      },
      set(t, k, v) { t[k] = v; return true; }
    });
  };
  const ctx = new Proxy({ currentTime: 0, sampleRate: 8000, destination: {} }, {
    get(t, k) {
      if (k === 'createOscillator' || k === 'createGain' || k === 'createBufferSource') return () => { const n = node(); made.push(n); return n; };
      if (k === 'createBuffer') return () => ({ getChannelData: () => new Float32Array(64) });
      if (k === 'createBiquadFilter') return () => node();
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  const sfx = new Sfx(ctx);
  sfx.chime();      // 3 音琶音
  const osc = made.filter(n => n.type !== undefined);
  assert.ok(made.length >= 3);
  assert.ok(osc.every(o => o.started === 1));
});

test('女声名含 male 子串不得获得大叔加分（回归）', () => {
  const genderless = { name: 'Google US English', lang: 'en-US', localService: false };
  const femaleUk = { name: 'Google UK English Female', lang: 'en-GB', localService: false };
  assert.ok(scoreVoice(femaleUk, 'uncle') < scoreVoice(genderless, 'uncle'));
  assert.ok(scoreVoice(femaleUk, 'child') > scoreVoice(genderless, 'child'));
});

test('speak 对非字符串输入也 resolve（resolve-only 契约）', async () => {
  const s = new Speech(null, null);
  await s.speak(undefined, {});
  await s.speak(null, {});
  assert.ok(true);
});

// —— SpeechQueue：台词串行、点读音素最新优先（回归：连续快速点读排长队，停手后音素声还响很久）——
// 假语音：speak 记一句、挂起等放行；cancel 立即放行当前句（对齐真实现 onerror/兜底收束）
function makeFakeSpeech() {
  const state = { played: [], cancels: 0, pend: null };
  return {
    state,
    cancel() { state.cancels++; if (state.pend) state.pend(); },
    speak(text) { state.played.push(text); return new Promise(r => { state.pend = r; }); }
  };
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('SpeechQueue：连续点读 = 掐断口中的、只播到最新一块（不排长队）', async () => {
  const { state, ...speech } = makeFakeSpeech();
  const q = new SpeechQueue(speech);
  q.carrier('h'); await tick();            // h 开播
  q.carrier('ə'); await tick();            // 掐断 h → ə 接播
  q.carrier('l'); await tick();            // 掐断 ə → l 接播
  assert.deepEqual(state.played, ['h', 'ə', 'l']);
  assert.equal(state.cancels, 2);          // 每次新点读只掐上一块
  state.pend(); await q.chain;             // 收尾
});

test('SpeechQueue：排队未播的旧点读到岗即跳过，只播最新', async () => {
  const { state, ...speech } = makeFakeSpeech();
  const q = new SpeechQueue(speech);
  q.line('台词'); await tick();            // 台词在播
  q.carrier('a'); q.carrier('b'); q.carrier('c');
  state.pend(); await tick(); await tick(); // 放行台词 → a/b 过期跳过 → c 开播
  assert.deepEqual(state.played, ['台词', 'c']);
  state.pend(); await q.chain;
});

test('SpeechQueue：点读不掐台词（教学台词绝不被打断）', async () => {
  const { state, ...speech } = makeFakeSpeech();
  const q = new SpeechQueue(speech);
  q.line('台词'); await tick();
  q.carrier('a'); await tick();
  assert.equal(state.cancels, 0);          // 台词在播：不 cancel
  state.pend(); await tick();
  assert.deepEqual(state.played, ['台词', 'a']);   // 点读等台词说完
  state.pend(); await q.chain;
});

test('SpeechQueue：台词之间仍严格串行', async () => {
  const { state, ...speech } = makeFakeSpeech();
  const q = new SpeechQueue(speech);
  q.line('A'); q.line('B'); await tick();
  assert.deepEqual(state.played, ['A']);   // B 等 A
  state.pend(); await tick();
  assert.deepEqual(state.played, ['A', 'B']);
  state.pend(); await q.chain;
});

test('Speech.cancel：透传 synth.cancel 且无 synth 不抛错', () => {
  let n = 0;
  const s = new Speech({ speak() {}, cancel() { n++; } }, t => ({ text: t }));
  s.cancel();
  assert.equal(n, 1);
  new Speech(null, null).cancel();
  assert.ok(true);
});
