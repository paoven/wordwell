import { useCallback, useEffect, useRef, useState } from 'react';
import vocabulary from './data/vocabulary.json';
import { dailyWord, gameStatus, keyboardColors, localDate, MAX_GUESSES, randomWord, readDaily, scoreGuess, storageKey } from './lib/game.js';

const categories = [...new Set(vocabulary.map(item => item.category))];
const stateNames = { correct: 'posizione corretta', present: 'presente in altra posizione', absent: 'assente' };
const blank = () => ({ guesses: [], input: '' });
function load(date) {
  try { return readDaily(window.localStorage, date, dailyWord(vocabulary, date).word); }
  catch { return blank(); }
}

export default function App() {
  const [mode, setMode] = useState('daily');
  const [date, setDate] = useState(localDate);
  const [daily, setDaily] = useState(() => load(localDate()));
  const [category, setCategory] = useState('Food');
  const [freeWord, setFreeWord] = useState(() => randomWord(vocabulary, 'Food'));
  const [free, setFree] = useState(blank);
  const [message, setMessage] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [help, setHelp] = useState(false);
  const helpRef = useRef(null);
  const word = mode === 'daily' ? dailyWord(vocabulary, date) : freeWord;
  const game = mode === 'daily' ? daily : free;
  const status = gameStatus(game.guesses, word.word);
  const colors = keyboardColors(game.guesses, word.word);

  useEffect(() => {
    let timer;
    const check = () => {
      const today = localDate();
      if (today !== date) {
        setDate(today); setDaily(load(today)); setMessage('Un nuovo giorno, una nuova parola!');
      }
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      clearTimeout(timer);
      timer = setTimeout(check, Math.min(midnight - now + 50, 60000));
    };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [date]);

  useEffect(() => {
    if (date !== localDate()) return;
    try {
      localStorage.setItem(storageKey(date), JSON.stringify({ word: dailyWord(vocabulary, date).word, ...daily }));
      setStorageWarning(false);
    } catch { setStorageWarning(true); }
  }, [daily, date]);

  const onKey = useCallback(key => {
    if (help || status !== 'playing') return;
    if (mode === 'daily' && localDate() !== date) {
      const today = localDate(); setDate(today); setDaily(load(today)); return;
    }
    const update = mode === 'daily' ? setDaily : setFree;
    if (key === 'ENTER') {
      if (game.input.length !== word.word.length) { setMessage(`Inserisci ${word.word.length} lettere prima di inviare.`); return; }
      update(current => {
        if (gameStatus(current.guesses, word.word) !== 'playing' || current.input.length !== word.word.length) return current;
        return { guesses: [...current.guesses, current.input], input: '' };
      });
      setMessage('');
    } else if (key === 'BACKSPACE') {
      update(current => ({ ...current, input: current.input.slice(0, -1) })); setMessage('');
    } else if (/^[A-Z]$/.test(key)) {
      update(current => current.input.length < word.word.length ? { ...current, input: current.input + key.toLowerCase() } : current);
      setMessage('');
    }
  }, [help, status, mode, date, game.input, word.word]);

  useEffect(() => {
    const handler = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button')) return;
      const key = event.key.toUpperCase();
      if (key === 'ENTER' || key === 'BACKSPACE' || /^[A-Z]$/.test(key)) { event.preventDefault(); onKey(key); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKey]);

  useEffect(() => {
    if (help && !helpRef.current.open) helpRef.current.showModal();
    if (!help && helpRef.current.open) helpRef.current.close();
  }, [help]);

  function newWord(nextCategory = category) {
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    setFreeWord(randomWord(vocabulary, nextCategory, freeWord.word)); setFree(blank()); setMessage('');
  }
  function changeMode(next) {
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    setMode(next); setMessage('');
  }
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  return <div className="min-h-dvh flex flex-col">
    <header className="border-b border-stone-200/80">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
        <a className="brand flex items-center gap-2.5" href="./" aria-label="Wordwell, home"><span className="brand-icon">w.</span>wordwell<span className="brand-dot">.</span></a>
        <div className="flex items-center gap-5"><span className="hidden sm:block text-xs text-stone-500">A little English, every day.</span><button className="help-button" onClick={() => setHelp(true)} aria-label="Come si gioca">?</button></div>
      </div>
    </header>
    <main className="w-full max-w-6xl mx-auto px-3 sm:px-8 flex-1">
      <div className="intro text-center pt-7 sm:pt-10 pb-6"><p className="eyebrow">PICCOLE SFIDE. NUOVE PAROLE.</p><h1 className="text-4xl sm:text-5xl mt-2">Trova la parola.<br className="sm:hidden" /> Allena il tuo inglese.</h1><p className="mt-3 text-sm text-stone-500">Una definizione, sei tentativi, qualcosa di nuovo da imparare.</p></div>
      <div className="mode-tabs mx-auto flex" role="group" aria-label="Modalità di gioco">
        <button aria-pressed={mode === 'daily'} className={mode === 'daily' ? 'active' : ''} onClick={() => changeMode('daily')}><span aria-hidden="true">◷</span> Parola del giorno</button>
        <button aria-pressed={mode === 'free'} className={mode === 'free' ? 'active' : ''} onClick={() => changeMode('free')}><span aria-hidden="true">∞</span> Modalità libera</button>
      </div>
      <div className="play-layout grid lg:grid-cols-[260px_minmax(0,1fr)_220px] gap-7 lg:gap-10 mt-7 items-start">
        <aside className="clue-card rounded-2xl p-5 lg:mt-4">
          <div className="flex items-center justify-between gap-2"><span className="eyebrow">IL TUO INDIZIO</span><span className="level-badge">{word.difficulty}</span></div>
          <div className="mt-5 text-2xl text-emerald-800" aria-hidden="true">“</div>
          <p className="definition text-lg leading-relaxed" lang="en">{word.definition}</p>
          <div className="flex flex-wrap gap-2 mt-5"><span className="meta-pill">{word.word.length} lettere</span><span className="meta-pill">{word.category}</span></div>
          <div className="mt-5 pt-4 border-t border-emerald-900/10">
            {mode === 'daily' ? <><p className="text-xs font-medium text-emerald-900">{dateLabel}</p><p className="text-xs text-stone-500 mt-1.5">Una nuova parola a mezzanotte.</p></> : <><label className="text-xs font-medium block mb-2" htmlFor="category">Scegli una categoria</label><select id="category" value={category} onChange={event => { setCategory(event.target.value); newWord(event.target.value); }}>{categories.map(item => <option key={item}>{item}</option>)}</select><button onClick={() => newWord()} className="new-word mt-3 w-full">Nuova parola <span aria-hidden="true">↗</span></button></>}
          </div>
        </aside>
        <section className="game-panel min-w-0" aria-label="Griglia di gioco">
          <div className="flex justify-between items-center max-w-[380px] mx-auto mb-4 px-1"><span className="eyebrow">{mode === 'daily' ? 'LA SFIDA DI OGGI' : 'LA TUA PAUSA DI INGLESE'}</span><span className="text-xs text-stone-500">{game.guesses.length} / 6 tentativi</span></div>
          <div className="board" style={{ '--letters': word.word.length }} role="group" aria-label={`${word.word.length} lettere, ${MAX_GUESSES} tentativi`}>
            {Array.from({ length: MAX_GUESSES }, (_, row) => {
              const guess = game.guesses[row];
              const letters = guess || (row === game.guesses.length ? game.input : '');
              const scores = guess ? scoreGuess(guess, word.word) : [];
              return <div className="board-row" key={row} aria-label={`Tentativo ${row + 1}`}>
                {Array.from({ length: word.word.length }, (_, col) => <div key={col} className={`tile ${scores[col] || (letters[col] ? 'filled' : '')}`} aria-label={letters[col] ? `${letters[col].toUpperCase()}${scores[col] ? `: ${stateNames[scores[col]]}` : ''}` : 'casella vuota'}><span>{letters[col]}</span></div>)}
              </div>;
            })}
          </div>
          <div className={`game-message ${status !== 'playing' ? 'finished' : ''}`} role="status" aria-live="polite">
            {status === 'won' ? <><strong>Ben fatto! La parola è {word.word.toUpperCase()}.</strong><span>Hai trovato la soluzione in {game.guesses.length} {game.guesses.length === 1 ? 'tentativo' : 'tentativi'}.</span></> : status === 'lost' ? <><strong>La parola era {word.word.toUpperCase()}.</strong><span>Ogni parola è un piccolo passo avanti.</span></> : message || <span className="text-stone-400">Segui l’indizio e scrivi il tuo primo tentativo.</span>}
            {status !== 'playing' && mode === 'free' && <button className="new-word mt-3" onClick={() => newWord()}>Gioca ancora ↗</button>}
          </div>
          <div className="keyboard" aria-label="Tastiera virtuale">
            {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, index) => <div className="keyboard-row" key={row}>
              {index === 2 && <button className="key key-wide" disabled={status !== 'playing'} onClick={event => { onKey('ENTER'); event.currentTarget.blur(); }}>ENTER</button>}
              {[...row].map(letter => <button key={letter} disabled={status !== 'playing'} className={`key ${colors[letter.toLowerCase()] || ''}`} aria-label={`${letter}${colors[letter.toLowerCase()] ? `, ${stateNames[colors[letter.toLowerCase()]]}` : ''}`} onClick={event => { onKey(letter); event.currentTarget.blur(); }}>{letter}</button>)}
              {index === 2 && <button className="key key-wide" disabled={status !== 'playing'} aria-label="Backspace, cancella ultima lettera" onClick={event => { onKey('BACKSPACE'); event.currentTarget.blur(); }}>⌫</button>}
            </div>)}
          </div>
          {storageWarning && <p role="status" className="text-xs text-center mt-3 text-amber-800">Il browser non consente il salvataggio: i progressi si perderanno al refresh.</p>}
        </section>
        <aside className="guide hidden lg:block mt-4"><p className="eyebrow mb-5">OGNI COLORE, UN INDIZIO</p><Legend /><div className="mt-8 border-t border-stone-200 pt-5"><span className="text-xl" aria-hidden="true">✧</span><p className="text-sm leading-relaxed text-stone-500 mt-2">Non serve sapere tutto.<br />Basta una parola in più di ieri.</p></div></aside>
      </div>
      <div className="lg:hidden legend-mobile flex flex-wrap justify-center gap-x-4 gap-y-2 mt-5 mb-4 text-xs"><span><i className="swatch correct" />Corretta</span><span><i className="swatch present" />Altra posizione</span><span><i className="swatch absent" />Assente</span></div>
    </main>
    <footer className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-6 mt-5 flex justify-between border-t border-stone-200/70 text-xs text-stone-400"><span>Un piccolo rituale, un grande vocabolario.</span><span className="hidden sm:inline">Made for curious minds.</span></footer>
    <dialog ref={helpRef} onCancel={() => setHelp(false)} onClose={() => setHelp(false)} className="help-dialog"><div className="flex justify-between items-center"><h2 className="text-3xl">Come si gioca</h2><button className="help-button" onClick={() => setHelp(false)} aria-label="Chiudi">×</button></div><p className="my-5 text-sm leading-relaxed">Leggi la definizione in inglese e trova la parola in sei tentativi. Ogni tentativo deve avere il numero di lettere indicato. Puoi provare qualsiasi combinazione di lettere A–Z.</p><Legend /><p className="my-5 text-sm leading-relaxed">Usa la tastiera o i tasti sullo schermo. ENTER invia il tentativo e BACKSPACE cancella una lettera. Le lettere ripetute sono colorate in base al numero di volte in cui compaiono nella soluzione.</p><p className="text-sm leading-relaxed">La sfida giornaliera si salva su questo browser e cambia a mezzanotte locale. In modalità libera scegli una categoria e gioca tutte le volte che vuoi.</p><button className="new-word w-full mt-6" onClick={() => setHelp(false)}>Ho capito, giochiamo!</button></dialog>
  </div>;
}

function Legend() {
  return <div className="space-y-4"><div className="legend-item"><span className="example-tile correct">A</span><div><strong>Al posto giusto</strong><p>Lettera e posizione corrette.</p></div></div><div className="legend-item"><span className="example-tile present">B</span><div><strong>Quasi!</strong><p>La lettera c’è, ma va spostata.</p></div></div><div className="legend-item"><span className="example-tile absent">C</span><div><strong>Riprova</strong><p>La lettera non è nella parola.</p></div></div></div>;
}
