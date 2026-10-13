import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyWord, dateHash, gameStatus, keyboardColors, localDate, randomWord, readDaily, scoreGuess, storageKey } from '../src/lib/game.js';
const words = JSON.parse(readFileSync(new URL('../src/data/vocabulary.json', import.meta.url)));

test('dictionary contains thousands of unique modern words with valid clues and CEFR levels', () => {
  const exclusions = JSON.parse(readFileSync(new URL('../src/data/vocabulary-exclusions.json', import.meta.url)));
  assert.ok(words.length >= 4400 && words.length <= 5000);
  assert.equal(new Set(words.map(item => item.word)).size, words.length);
  for (const item of words) {
    assert.match(item.word, /^[a-z]{2,18}$/); assert.ok(item.definition.length > 20);
    assert.ok(['A1', 'A2', 'B1', 'B2', 'C1'].includes(item.difficulty));
    assert.ok(!exclusions.includes(item.word), item.word);
    assert.doesNotMatch(item.definition, /\b(archaic|obsolete|vulgar|offensive|derogatory|slang)\b/i);
    assert.doesNotMatch(item.definition, new RegExp(`\\b${item.word}\\b`, 'i'), item.word);
    assert.doesNotMatch(item.definition, /;\s*;/);
  }
  for (const category of ['Food', 'Travel', 'Business', 'Technology', 'Everyday Life', 'Health', 'Nature']) {
    assert.ok(words.filter(word => word.category === category).length >= 20, category);
  }
});
test('date is local, padded and handles year rollover', () => {
  assert.equal(localDate(new Date(2026, 0, 2)), '2026-01-02');
  assert.equal(localDate(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
  assert.equal(localDate(new Date(2027, 0, 1)), '2027-01-01');
});
test('daily hash is deterministic with a fixed known value', () => {
  assert.equal(dateHash('2026-10-13'), 1266631974);
  assert.deepEqual(dailyWord(words, '2026-10-13'), dailyWord([...words], '2026-10-13'));
  assert.notEqual(dailyWord(words, '2026-10-13').word, dailyWord(words, '2026-10-14').word);
});
test('Wordle scores exact, misplaced and absent letters', () => {
  assert.deepEqual(scoreGuess('screen', 'screen'), Array(6).fill('correct'));
  assert.deepEqual(scoreGuess('cccccc', 'recipe'), ['absent', 'absent', 'correct', 'absent', 'absent', 'absent']);
  assert.deepEqual(scoreGuess('eeeeee', 'recipe'), ['absent', 'correct', 'absent', 'absent', 'absent', 'correct']);
  assert.deepEqual(scoreGuess('peeeee', 'recipe'), ['present', 'correct', 'absent', 'absent', 'absent', 'correct']);
  assert.deepEqual(scoreGuess('aaaaaa', 'recipe'), Array(6).fill('absent'));
});
test('keyboard retains its strongest color across guesses and duplicate letters', () => {
  assert.equal(keyboardColors(['eeeeee'], 'recipe').e, 'correct');
  assert.equal(keyboardColors(['peeeee', 'aaaaap'], 'recipe').p, 'present');
  assert.equal(keyboardColors(['recipe', 'aaaaaa'], 'recipe').a, 'absent');
});
test('win, sixth-guess win and loss are distinct', () => {
  assert.equal(gameStatus([], 'recipe'), 'playing');
  assert.equal(gameStatus(['recipe'], 'recipe'), 'won');
  assert.equal(gameStatus([...Array(5).fill('aaaaaa'), 'recipe'], 'recipe'), 'won');
  assert.equal(gameStatus(Array(6).fill('aaaaaa'), 'recipe'), 'lost');
});
test('free word stays in category and avoids immediate repetitions', () => {
  for (const category of new Set(words.map(word => word.category))) {
    const first = randomWord(words, category, undefined, () => 0);
    const next = randomWord(words, category, first.word, () => 0);
    assert.equal(next.category, category); assert.notEqual(first.word, next.word);
  }
});
test('daily persistence restores guesses and partial input, isolating dates', () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) || null };
  data.set(storageKey('2026-10-13'), JSON.stringify({ word: 'recipe', guesses: ['aaaaaa'], input: 'rec' }));
  assert.deepEqual(readDaily(storage, '2026-10-13', 'recipe'), { guesses: ['aaaaaa'], input: 'rec' });
  assert.deepEqual(readDaily(storage, '2026-10-14', 'recipe'), { guesses: [], input: '' });
});
test('corrupt, mismatched or unavailable storage fails safely', () => {
  for (const value of ['broken', 'null', '{"word":"recipe","guesses":[42]}', '{"word":"recipe","guesses":["recipe","aaaaaa"]}', '{"word":"other","guesses":[]}']) {
    assert.deepEqual(readDaily({ getItem: () => value }, '2026-10-13', 'recipe'), { guesses: [], input: '' });
  }
  assert.deepEqual(readDaily({ getItem: () => { throw Error('blocked'); } }, '2026-10-13', 'recipe'), { guesses: [], input: '' });
});
