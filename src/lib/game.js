export const MAX_GUESSES = 6;
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateHash(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
export function dailyWord(words, date) { return words[dateHash(date) % words.length]; }
export function randomWord(words, category, previous, random = Math.random) {
  const pool = words.filter(item => item.category === category && item.word !== previous);
  const candidates = pool.length ? pool : words.filter(item => item.category === category);
  return candidates[Math.floor(random() * candidates.length)];
}
export function scoreGuess(guess, target) {
  const result = Array(guess.length).fill('absent');
  const remaining = {};
  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) result[i] = 'correct';
    else remaining[target[i]] = (remaining[target[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
      result[i] = 'present'; remaining[guess[i]]--;
    }
  }
  return result;
}
export function keyboardColors(guesses, target) {
  const colors = {}, rank = { absent: 1, present: 2, correct: 3 };
  guesses.forEach(guess => scoreGuess(guess, target).forEach((state, index) => {
    if ((rank[colors[guess[index]]] || 0) < rank[state]) colors[guess[index]] = state;
  }));
  return colors;
}
export function gameStatus(guesses, word) {
  return guesses.includes(word) ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
}
export function storageKey(date) { return `wordwell:daily:v1:${date}`; }
export function readDaily(storage, date, word) {
  const fresh = { guesses: [], input: '' };
  try {
    const saved = JSON.parse(storage.getItem(storageKey(date)));
    if (!saved || saved.word !== word || !Array.isArray(saved.guesses) || saved.guesses.length > MAX_GUESSES) return fresh;
    if (!saved.guesses.every(guess => typeof guess === 'string' && new RegExp(`^[a-z]{${word.length}}$`).test(guess))) return fresh;
    const winningIndex = saved.guesses.indexOf(word);
    if (winningIndex >= 0 && winningIndex !== saved.guesses.length - 1) return fresh;
    const input = typeof saved.input === 'string' && /^[a-z]*$/.test(saved.input) && saved.input.length <= word.length ? saved.input : '';
    return { guesses: saved.guesses, input: gameStatus(saved.guesses, word) === 'playing' ? input : '' };
  } catch { return fresh; }
}
