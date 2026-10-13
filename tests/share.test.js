import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, resultEmojiGrid } from '../src/lib/share.js';

test('emoji grid respects repeated letters and only submitted rows', () => {
  assert.equal(resultEmojiGrid(['peeeee', 'recipe'], 'recipe'), '🟨🟩⬛⬛⬛🟩\n🟩🟩🟩🟩🟩🟩');
});

test('winning share uses the exact requested format and never reveals words', () => {
  const text = buildShareText(['peeeee', 'recipe'], 'recipe', '2026-10-14');
  assert.equal(text, 'Wordle English Learning Game - Giorno 2026-10-14\nTentativi: 2/6\n\n🟨🟩⬛⬛⬛🟩\n🟩🟩🟩🟩🟩🟩\n\nGioca anche tu: https://paoven.github.io/wordwell/');
  assert.ok(!text.includes('recipe'));
  assert.ok(!text.includes('peeeee'));
});

test('losing share includes all six attempts, with no answer spoiler', () => {
  assert.equal(buildShareText(Array(6).fill('zzzzzz'), 'recipe', '2026-10-14'), `Wordle English Learning Game - Giorno 2026-10-14\nTentativi: 6/6\n\n${Array(6).fill('⬛⬛⬛⬛⬛⬛').join('\n')}\n\nGioca anche tu: https://paoven.github.io/wordwell/`);
});
