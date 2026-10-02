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

test('流程与物件：hello/open 掉落坐标、开关/合成台位置齐备；氛围物只有音效', () => {
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
  }
  assert.equal(data.words.hello.use.target, 'npc');
  assert.equal(data.words.open.use.target, 'door');
});

test('content 中不含 emoji（铁律）', () => {
  const raw = JSON.stringify(data);
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(raw), '发现 emoji');
});
