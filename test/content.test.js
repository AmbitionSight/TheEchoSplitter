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

test('每个词的音素都有载词与卢文', () => {
  for (const [w, def] of Object.entries(data.words)) {
    for (const [ipa] of def.phonemes) {
      assert.ok(data.carriers[ipa], `${w}.${ipa} 缺载词`);
      assert.ok(data.phonemeBook.runes[ipa], `${w}.${ipa} 缺卢文`);
    }
  }
});

test('自给自足：每个探索物的掉落词存在于 words（含 npc=hello）', () => {
  for (const [id, ex] of Object.entries(data.explorables)) {
    assert.ok(data.words[ex.word], `${id} 指向不存在的词 ${ex.word}`);
    assert.ok(Array.isArray(ex.drop) && ex.drop.length === 2);
  }
  assert.equal(data.explorables.npc.word, 'hello');
  assert.equal(data.explorables.hatstand.requires, 'lit');
  assert.deepEqual(data.door.ipa, data.words.open.phonemes.map(p => p[0]));
});

test('content 中不含 emoji（铁律）', () => {
  const raw = JSON.stringify(data);
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(raw), '发现 emoji');
});
