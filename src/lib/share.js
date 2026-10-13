import { MAX_GUESSES, scoreGuess } from './game.js';

const emoji = { correct: '🟩', present: '🟨', absent: '⬛' };

export function resultEmojiGrid(guesses, target) {
  return guesses.map(guess => scoreGuess(guess, target).map(color => emoji[color]).join('')).join('\n');
}

export function buildShareText(guesses, target, date) {
  return `Wordle English Learning Game - Giorno ${date}\nTentativi: ${guesses.length}/${MAX_GUESSES}\n\n${resultEmojiGrid(guesses, target)}\n\nGioca anche tu: https://paoven.github.io/wordwell/`;
}
