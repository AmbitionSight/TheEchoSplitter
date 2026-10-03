import { test } from 'node:test';
import assert from 'node:assert';
import { createDoor, doorEvent } from '../public/js/door.js';

test('门：吃 open 词具才进仪式；其他一律咕哝', () => {
  const d = createDoor();
  assert.deepEqual(doorEvent(d, 'OFFER', 'hello'), { mutter: true });
  assert.equal(d.state, 'closed');
  const r = doorEvent(d, 'OFFER', 'open');
  assert.equal(d.state, 'ritual'); assert.ok(r.ritual);
});

test('门：仪式 → 开门动画 → 开启；开过再喂 mutter', () => {
  const d = createDoor();
  doorEvent(d, 'OFFER', 'open');
  doorEvent(d, 'RITUAL_DONE');
  assert.equal(d.state, 'opening');
  doorEvent(d, 'OPEN_DONE');
  assert.equal(d.state, 'opened');
  assert.deepEqual(doorEvent(d, 'OFFER', 'open'), { mutter: true });
});

test('仪式座位数据：4 座绕拱，可截取', async () => {
  const { ritualSeats, RITUAL_STEP } = await import('../public/js/door.js');
  assert.equal(RITUAL_STEP, 0.55);
  assert.equal(ritualSeats().length, 4);
  assert.deepEqual(ritualSeats(2), [[1054, 314], [1084, 186]]);
});
