# Vocabolario Wordwell

Il vocabolario contiene **4.511 parole uniche**, con indizi inglesi e livelli A1–C1,
distribuite in 15 categorie. È una selezione per il gioco, non l'elenco Oxford 5000 completo.

## Fonti e selezione

- Parole e livelli: [Oxford 3000 e Oxford 5000](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000), Oxford University Press. Le liste privilegiano vocaboli utili per chi studia inglese. I livelli indicano il livello minimo riportato per la voce, non una certificazione dell'indizio o di ogni suo significato.
- Indizi: definizioni di **Princeton WordNet 3.0**, con iniziale maiuscola, punteggiatura finale e rimozione di separatori residui delle citazioni. La licenza consente uso, modifica e distribuzione con conservazione dell'avviso. La copia integrale è in `public/wordnet-license.txt`, distribuita anche nella build.
- `vocabulary-overrides.json`: le 20 voci originali e alcuni indizi scritti per Wordwell per significati moderni o più chiari, specialmente in ambito tecnologico. I livelli vengono aggiornati dalla fonte quando disponibili; per le poche voci aggiuntive sono indicativi.

Si importano sostantivi, verbi, aggettivi e avverbi come parole singole in minuscolo
di 2–18 lettere. Si escludono spazi, trattini, nomi propri, acronimi e voci senza
un indizio adatto. Il confronto con WordNet richiede la voce esatta, senza ricavare
automaticamente forme flesse. `vocabulary-exclusions.json` esclude volgarità,
insulti e alcuni arcaismi; vengono scartati anche indizi con etichette di registro
arcaico, obsoleto, volgare, offensivo o slang e indizi che rivelano la soluzione.
L'esclusione è conservativa: alcuni vocaboli vengono rimossi anche se hanno usi innocui.

Le categorie delle nuove voci sono ricavate dal significato selezionato e dalle
classi semantiche WordNet, con correzioni manuali nelle voci override. Non sono
categorie ufficiali Oxford. La selezione automatica non equivale a una revisione
editoriale individuale di tutti gli indizi: gli override consentono di affinare
significati e categorie senza modificare a mano il file generato.

`vocabulary-build.json` registra conteggi, voci omesse per mancanza di definizioni
adatte e SHA-256 degli input. Non si aggiungono termini rari per raggiungere
artificialmente 5.000 voci. Ordine e contenuto influenzano la parola del giorno;
un aggiornamento può resettare una partita giornaliera salvata con la vecchia soluzione.

## Rigenerazione

Gli strumenti Python servono solo per aggiornare il dizionario; il gioco e la build
rimangono completamente locali, senza API o download durante l'esecuzione.

```sh
python3 -m venv /tmp/wordwell-vocabulary-env
/tmp/wordwell-vocabulary-env/bin/pip install nltk==3.9.2 pypdf==6.20.1
/tmp/wordwell-vocabulary-env/bin/python scripts/download-vocabulary-sources.py /tmp/wordwell-vocabulary-sources
/tmp/wordwell-vocabulary-env/bin/python scripts/build-vocabulary.py /tmp/wordwell-vocabulary-sources
npm test
npm run build
```

Conservare gli input per riprodurre esattamente questa selezione: le fonti remote
possono cambiare, mentre `vocabulary-build.json` permette di confrontarne gli hash.

Riferimento WordNet: George A. Miller (1995), *WordNet: A Lexical Database for
English*, Communications of the ACM, 38(11), 39–41.
