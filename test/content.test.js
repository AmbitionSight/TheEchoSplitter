import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));

test('48 音标：groups 展开共 48 项、无重复，runes 全覆盖且字形唯一', () => {
  const items = data.phonemeBook.groups.flatMap(g => g.items);
  assert.equal(items.length, 48);
  assert.equal(new Set(items).size, 48);
  assert.equal(data.phonemeBook.total, 48);
  for (const ipa of items) assert.ok(data.phonemeBook.runes[ipa], `缺卢文: ${ipa}`);
  const glyphs = items.map(i => data.phonemeBook.runes[i]);
  assert.equal(new Set(glyphs).size, 48, '卢文字形必须互不相同');
});

test('v2 双词：hello/open 音素都有载词与卢文；door.ipa 与 open 一致', () => {
  assert.deepEqual(Object.keys(data.words).sort(), ['hello', 'open']);
  for (const [w, def] of Object.entries(data.words)) {
    for (const [ipa] of def.phonemes) {
      assert.ok(data.carriers[ipa], `${w}.${ipa} 缺载词`);
      assert.ok(data.phonemeBook.runes[ipa], `${w}.${ipa} 缺卢文`);
    }
  }
  assert.deepEqual(data.door.ipa, data.words.open.phonemes.map(p => p[0]));
});

test('流程与物件：掉落坐标与物件齐备；氛围物=音效+回声（不掉词，回声音有载词与卢文）', () => {
  for (const w of ['hello', 'open']) {
    const f = data.flows[w];
    assert.ok(f, `缺 flows.${w}`);
    assert.ok(Array.isArray(f.drop) && f.drop.length === 2);
  }
  assert.ok(Array.isArray(data.switch.pos) && data.switch.pos.length === 2);
  assert.ok(Array.isArray(data.switch.litDrop) && data.switch.litDrop.length === 2);
  assert.ok(Array.isArray(data.bench.pos) && data.bench.pos.length === 2);
  for (const [id, a] of Object.entries(data.ambience)) {
    assert.ok(a.sfx, `${id} 缺 sfx`);
    assert.ok(!a.word && !a.drop, `${id} v2 氛围物不得掉词`);
    if (a.echo) assert.ok(a.say, `${id} 回声缺所念的词`);
    for (const ipa of a.echo || []) {          // 回声物件：每个音都要有载词（章表或 48 音通用表）与卢文
      assert.ok(data.carriers[ipa] || data.phonemeBook.carriers[ipa], `${id}.${ipa} 缺载词`);
      assert.ok(data.phonemeBook.runes[ipa], `${id}.${ipa} 缺卢文`);
    }
  }
  assert.equal(data.words.hello.use.target, 'npc');
  assert.equal(data.words.open.use.target, 'door');
});

test('content 中不含 emoji（铁律）', () => {
  const raw = JSON.stringify(data);
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(raw), '发现 emoji');
});

test('跨关词库 lexicon：旧章词在后续章可展示（icon+音素时长齐备，不与本章词重复）', async () => {
  for (const n of [2, '2b', 3]) {
    const c = JSON.parse(await readFile(new URL(`../content/chapter${n}.json`, import.meta.url), 'utf8'));
    for (const [w, def] of Object.entries(c.lexicon || {})) {
      assert.ok(def.icon, `ch${n}.${w} 缺 icon`);
      assert.ok(Array.isArray(def.phonemes) && def.phonemes.length, `ch${n}.${w} 缺音素`);
      for (const ph of def.phonemes) assert.ok(Array.isArray(ph) && typeof ph[1] === 'number', `ch${n}.${w}.${ph[0]} 缺时长`);
      assert.ok(!c.words[w], `ch${n}.${w} 不应与本章可拼词重复`);
    }
  }
});
