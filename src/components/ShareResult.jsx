import { useEffect, useRef, useState } from 'react';
import { buildShareText } from '../lib/share.js';

export default function ShareResult({ guesses, target, date }) {
  const text = buildShareText(guesses, target, date);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [manual, setManual] = useState(false);
  const textarea = useRef(null);
  const timer = useRef(null);
  const alive = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; clearTimeout(timer.current); };
  }, []);

  async function copyResult() {
    if (pending.current) return;
    pending.current = true;
    setCopying(true);
    setCopied(false);
    clearTimeout(timer.current);
    try {
      // Invoke directly from the user's click: Safari/WebViews may require activation.
      // Do not read clipboard contents or preflight browser-specific permissions.
      if (!window.isSecureContext || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (!alive.current) return;
      setManual(false);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      // Embedded browsers may deny writes even over HTTPS. Preserve a manual path.
      if (alive.current) setManual(true);
    } finally {
      pending.current = false;
      if (alive.current) setCopying(false);
    }
  }

  function selectText() {
    textarea.current.focus();
    textarea.current.select();
    textarea.current.setSelectionRange(0, text.length);
  }

  return <div className="share-result text-center mb-4">
    <button className="new-word" aria-label="Condividi Risultato" disabled={copying} onClick={copyResult}>
      <span lang="en">{copying ? 'Copying…' : 'Share Result'}</span>
    </button>
    <p className="text-xs text-emerald-800 mt-2 min-h-4" role="status" aria-live="polite">{copied ? 'Copiato negli appunti!' : ''}</p>
    {manual && <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4 text-left">
      <p className="text-xs leading-relaxed mb-3" role="status">La copia automatica non è disponibile in questo browser. Seleziona il testo e usa “Copia”, oppure apri la pagina nel browser del telefono.</p>
      <textarea ref={textarea} aria-label="Risultato da copiare manualmente" readOnly value={text} rows={guesses.length + 5} className="block w-full resize-none rounded-md border border-stone-300 bg-stone-50 p-3 text-xs leading-relaxed" />
      <button className="new-word mt-3" onClick={selectText}>Seleziona testo</button>
    </div>}
  </div>;
}
