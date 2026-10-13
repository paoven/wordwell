# Wordwell

Gioco di parole in inglese realizzato con React, Vite e Tailwind CSS. Layout responsive, indizi in inglese, 6 tentativi, tastiera fisica e virtuale, parole di lunghezza variabile e 20 voci B1/B2.

## Avvio

Richiede Node.js 20.19+ nella serie 20, oppure 22.12 o superiore.

```sh
npm install
npm run dev
```

Nell'ambiente di sviluppo di questa sessione Node non era preinstallato. È stato scaricato e verificato con SHA-256 in una cartella temporanea. Finché il runtime temporaneo è presente, puoi avviare qui il progetto con:

```sh
export PATH="/private/tmp/node-v22.23.3-darwin-arm64/bin:$PATH"
npm run dev
```

Per un uso stabile installa Node sul tuo computer; `.node-version` indica la versione usata per le verifiche.

## Docker: sviluppo isolato

Richiede Docker Engine con Compose v2, oppure Docker Desktop avviato. Node e npm sul computer non sono necessari.

Su macOS, se Docker Desktop è installato ma il comando `docker` non è nel PATH della shell, usa `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"`.

```sh
docker compose up --build app
```

Apri `http://localhost:5173`. Le modifiche ai file del progetto sul computer vengono rilevate tramite polling e applicate con Hot Reloading. `host: true` rende Vite raggiungibile attraverso la porta Docker; `strictPort: true` evita che scelga una porta diversa da quella mappata.

Il servizio usa lo stadio `development` basato su `node:20-alpine`, con utente non root `node`. Il sorgente è montato in sola lettura dal punto di vista del container: continua a modificarlo dal tuo editor sul computer. I volumi nominativi `node_modules` e `npm_cache` contengono rispettivamente le dipendenze Linux e la cache npm. Un volume anonimo per `/app/dist` isola anche eventuali build eseguite nel container. Le cartelle vengono predisposte con proprietà `node:node` nell'immagine. La cartella `node_modules` locale, se presente, non viene usata dal container né inclusa nel contesto della build.

Ogni avvio esegue `npm ci` dal lockfile, usando la cache persistente. Dopo modifiche a `package.json` e `package-lock.json`, riavvia il servizio:

```sh
docker compose restart app
```

Per eseguire test e build senza scrivere sul computer:

```sh
docker compose exec app npm test
docker compose exec app npm run build
docker compose ps
```

Per fermare i servizi usa `docker compose down`. Per rimuovere anche i volumi del progetto e ricominciare con dipendenze pulite, usa `docker compose down --volumes`. La rimozione dei volumi non cancella il sorgente o i progressi salvati nel LocalStorage del browser.

## Docker: produzione

```sh
docker compose --profile production up --build production
```

Apri `http://localhost:8080`. Lo stadio `build` compila il bundle, poi lo stadio `production` basato su `nginx:alpine` riceve solo `dist` e la configurazione Nginx. Non monta sorgenti o dipendenze di sviluppo. Nginx gestisce il fallback alla pagina iniziale e la cache degli asset con hash; la pagina HTML viene rivalidata. Entrambi i servizi includono un healthcheck.

Per usare la sola immagine di produzione:

```sh
docker build --target production -t wordwell:production .
docker run --rm -p 8080:80 wordwell:production
```

Riferimenti: [volumi Docker](https://docs.docker.com/engine/storage/volumes/) e [opzioni server Vite](https://vite.dev/config/server-options).

Verifiche eseguite con Docker Desktop: build e avvio di entrambi i servizi con healthcheck superati, 9 test unitari e build nel container Node 20.20.2 Alpine, test browser sulla produzione Nginx e Hot Reloading CSS attraverso il bind mount senza ricaricare la pagina. Verificati UID 1000 (`node`), proprietà e scrittura dei volumi, sorgente in sola lettura ed esclusione di un file di prova presente solo nei `node_modules` del computer. La build nel container non modifica lockfile, dipendenze o `dist` locali. La produzione non monta volumi di sviluppo e non contiene Node; verificati anche configurazione Nginx, risposte HTML/JS/CSS, cache, fallback e risposta 404 per asset inesistenti.

## Verifica

```sh
npm test
npm run build
npm run preview
```

I test unitari coprono colori e lettere ripetute, priorità della tastiera, selezione delle parole, date, vittoria/sconfitta e ripristino sicuro del salvataggio. Il test opzionale `tests/browser.mjs` usa Playwright per controllare entrambe le modalità, refresh, tastiera, quattro viewport, dialogo di aiuto, storage bloccato e cambio a mezzanotte. Per eseguirlo con il server già avviato:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/browser.mjs
node tests/hot-reload.mjs
```

In alternativa imposta `CHROME_PATH` al percorso di un Chrome già installato. `PLAYWRIGHT_MODULE` permette di usare un'installazione di Playwright esterna al progetto. Gli screenshot dei test vengono salvati nella cartella temporanea. Il test Hot Reloading modifica temporaneamente il CSS e rimuove la modifica alla fine, verificando che venga applicata senza ricaricare la pagina. Per verificare il mount Docker eseguilo sul computer, con `docker compose up app` in esecuzione, anziché avviarlo dentro il container con sorgente in sola lettura.

## Modalità

- **Parola del giorno**: hash FNV-1a della data locale `YYYY-MM-DD`, stesso dizionario e stessa data producono la stessa parola. Il gioco si aggiorna a mezzanotte locale anche se aperto; ricontrolla la data ogni minuto e al ritorno sulla pagina. Tentativi e testo parziale si salvano nel LocalStorage del browser.
- **Modalità libera**: Food, Travel, Business e Technology. La categoria cambia subito la parola; “Nuova parola” avvia un'altra partita evitando la ripetizione immediata. Il progresso rimane mentre si passa da un tab all'altro, ma non al refresh.
- Sono accettate combinazioni A–Z della lunghezza corretta, senza verifica lessicale dei tentativi. Il dizionario contiene le soluzioni e le relative definizioni, non tutte le parole inglesi possibili.
- Le lettere ripetute rispettano la quantità presente nella soluzione. Il colore migliore di una lettera rimane sulla tastiera.

“Stessa parola per tutti” vale per chi ha la stessa **data locale**. Fusi orari diversi possono avere date e quindi parole diverse nello stesso istante. Un elenco finito di parole può ripetere soluzioni in giornate diverse; mantenere ordine e contenuto del dizionario identici garantisce la selezione condivisa.

## GitHub Pages

La pubblicazione è gestita da [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Nel repository GitHub, apri **Settings → Pages** e imposta **Source → GitHub Actions**. Poi pubblica il workflow con un push su `main`; ogni push successivo esegue nuovamente build e pubblicazione. Puoi avviarlo anche da **Actions → Build and deploy to GitHub Pages → Run workflow**, selezionando `main`.

Il job `build` usa la versione Node indicata in `.node-version`, installa le dipendenze con `npm ci`, esegue `npm test` e compila con `npm run build`. Carica poi l'intera cartella `dist` come artifact `github-pages`, contenente HTML, JavaScript e CSS pronti per essere serviti. Il job `deploy` parte solo dopo il successo della build e pubblica quell'artifact tramite l'ambiente `github-pages`, con i permessi `pages: write` e `id-token: write`. Non serve un token personale: viene usato il token automatico di GitHub Actions. Le pubblicazioni vengono serializzate senza interrompere quella in corso.

Il workflow non esegue `npm run deploy` e non richiede un branch `gh-pages`. `base: './'` mantiene i percorsi degli asset compatibili con il sottopercorso del repository. Per il remote attuale, l'indirizzo previsto è `https://paoven.github.io/wordwell/`; il workflow mostra l'URL effettivo nell'ambiente di deployment. La pubblicazione remota deve ancora essere verificata dopo il push e l'attivazione di Pages.

Riferimento: [workflow personalizzati per GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Tailwind usa il [plugin ufficiale per Vite](https://tailwindcss.com/docs/installation/using-vite). Le soluzioni sono incluse nel bundle client: è un gioco didattico locale, senza server o account.
