import { test } from 'node:test';
import assert from 'node:assert';
import { createDoor, doorEvent } from '../public/js/door.js';

test('门：5 词集齐才从沉睡进入脉动', () => {
  const d = createDoor();
  assert.equal(doorEvent(d, 'CLICK'), null);                       // 沉睡中点门无反应
  assert.equal(doorEvent(d, 'WORDS_COMPLETE', 4), null);
  const r = doorEvent(d, 'WORDS_COMPLETE', 5);
  assert.equal(d.state, 'pulsing'); assert.ok(r.entered);
});

test('门：脉动时点击 → 低语 + 只掉一次 open 石', () => {
  const d = createDoor();
  doorEvent(d, 'WORDS_COMPLETE', 5);
  const r1 = doorEvent(d, 'CLICK');
  assert.equal(d.state, 'whispered');
  assert.ok(r1.whisper && r1.dropOpenStones);
  const r2 = doorEvent(d, 'CLICK');
  assert.ok(r2.whisper); assert.equal(r2.dropOpenStones, undefined); // 可反复听，不再掉
});

test('门：拖错词具 → 咕哝不解锁；拖 open → 仪式 → 开启', () => {
  const d = createDoor();
  doorEvent(d, 'WORDS_COMPLETE', 5);
  doorEvent(d, 'CLICK');
  assert.deepEqual(doorEvent(d, 'OFFER', 'water'), { mutter: true });
  assert.equal(d.state, 'whispered');
  const r = doorEvent(d, 'OFFER', 'open');
  assert.equal(d.state, 'ritual'); assert.ok(r.ritual);
  doorEvent(d, 'RITUAL_DONE');
  assert.equal(d.state, 'opening');
  doorEvent(d, 'OPEN_DONE');
  assert.equal(d.state, 'opened');
  assert.deepEqual(doorEvent(d, 'OFFER', 'open'), { mutter: true }); // 开过不再响应
});
