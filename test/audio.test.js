import { test } from 'node:test';
import assert from 'node:assert';
import { scoreVoice, pickVoices, estimateMs, Speech, Sfx } from '../public/js/audio.js';

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
