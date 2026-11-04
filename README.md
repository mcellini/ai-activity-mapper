# AI Activity Mapper

Mappa delle attività del team per potenziale di automazione e augmentation, con frequenza, micro-task, staffing 2027, AS-IS / TO-BE e agenti.

Senza un foglio collegato l'app lavora solo in questo browser, dati di esempio compresi. Il foglio è facoltativo.

## Sviluppo

```
npm install
npm run dev
```

Per provare il foglio in locale, crea `.env.local` (non va committato):

```
VITE_SHEETS_URL=https://script.google.com/macros/s/....../exec
```

L'URL si può anche incollare dal pulsante **Sheets**. La password non sta nel file: la chiedi l'app e la confronti con la proprietà `APP_PASSWORD` dello script.

## Pubblicare su GitHub Pages

1. In Settings > Pages scegli come sorgente **GitHub Actions**.
2. Ad ogni push su `main` il workflow `.github/workflows/deploy.yml` compila e pubblica il sito.
3. L'indirizzo è `https://<utente>.github.io/ai-activity-mapper/`.

Il sito Pages è raggiungibile da chiunque conosca l'indirizzo. Non mettere dati riservati nel repository: i dati del team stanno nel foglio e sul Drive, non nel codice. Non mettere la password nel repository.

## Collegare Google Sheets

La password è condivisa: è più debole di un accesso per persona. Chiunque abbia la password e l'URL `/exec` può leggere e scrivere tutto il foglio. Per cambiarla basta aggiornare la proprietà `APP_PASSWORD` nello script: le sessioni vecchie ricevono «Password non corretta» e devono reinserirla. Non c'è un elenco di email.

### 1. Foglio e script

1. Crea un Google Sheet. Non condividerlo con «chiunque abbia il link»: ci finiscono nomi, clienti e costi.
2. Estensioni > Apps Script, incolla `apps-script/Code.gs` al posto del file vuoto e salva. Lo script resta collegato a questo foglio.
3. Impostazioni progetto (ingranaggio) > **Proprietà dello script**: aggiungi `APP_PASSWORD` con la password del team.
4. Distribuisci > Nuova distribuzione > **App web**:
   - Esegui come: **Me**
   - Accesso: **Chiunque**
5. Autorizza foglio e Drive. Copia l'URL che finisce con `/exec`.

«Chiunque» serve solo perché il browser possa chiamare l'URL. Senza la password nel corpo della richiesta lo script non legge e non scrive. Dopo una decina di password sbagliate si ferma per qualche minuto. La password viaggia in POST `text/plain`, non nell'indirizzo.

### 2. Variabile di GitHub Actions

In Settings > Secrets and variables > Actions > **Variables** crea `VITE_SHEETS_URL` con l'URL `/exec`. Poi rilancia il workflow. Si può anche incollare l'URL dal pulsante **Sheets** senza ricompilare.

All'apertura, se l'URL c'è, l'app chiede la password. «Ricordami su questo dispositivo» la tiene nel browser anche dopo la chiusura; altrimenti dura solo per la scheda. **Esci** la cancella. Senza URL l'app resta solo in questo browser.

## Come si salvano i dati

Ogni modifica, con foglio collegato e password accettata, parte dopo due secondi.

- La sorgente è il foglio `Entita`: una riga per attività, **task**, blocker, persona, cliente, workflow, micro-tool e per le ore reali. I task non stanno più dentro il JSON dell'attività, così due persone che modificano task diversi non si pestano i piedi. Un singolo elemento molto lungo può ancora superare il limite di una cella: in quel caso il salvataggio fallisce con un messaggio esplicito.
- I dati vecchi (versione 5) vengono portati alla versione 6 all'apertura. I micro-task già presenti diventano task con lo stesso id. Un'attività senza micro-task diventa uno o più task che conservano le ore umane, liberate e potenziate, senza sommarle due volte. Le ore dell'attività seguono poi i task.
- Il salvataggio porta un numero di revisione e usa il lock di Apps Script. Se due persone hanno modificato elementi diversi, le modifiche si uniscono. Se hanno modificato lo stesso elemento, compare la scelta «Carica le sue» / «Sovrascrivi con le mie». Sovrascrivere crea una revisione nuova.
- I fogli `Attivita`, `Task`, `Blocker`, `MicroTool`, `Persone`, `Clienti` e `Misurato` sono report. Si aggiornano al massimo una volta al minuto, e subito quando salvi un'istantanea o ripristini. Il foglio `Task` e le ore delle attività escono dai task.
- Un foglio vuoto non riceve i dati di esempio. Si parte da zero. L'esempio si carica solo con **Sheets > Carica i dati di esempio**, e solo se il foglio non ha ancora revisioni.
- Finché il primo caricamento non è finito, i campi non si possono modificare.
- Prima di un import, di una sostituzione dal foglio o di «Sovrascrivi con le mie» viene tenuta una copia in questo browser.

## Storico

**Salva istantanea** scrive un file JSON nella cartella Drive `AI Activity Mapper/Storico` (orario del server, etichetta, revisione, stato). Non c'è un nome persona: l'accesso è la password condivisa. Restano le ultime 30. Il ripristino passa dallo stesso lock e crea una revisione nuova, con un `updatedAt` nuovo: non riusa la data della copia.

La stessa azione tiene anche una copia in questo browser. Serve quando il foglio non è collegato o il Drive non risponde. Quelle copie non si vedono sugli altri computer.

## Dati di esempio

All'apertura, se in questo browser non c'è ancora nulla, vedi un banner **Dati di esempio**. «Parti da zero» svuota. «Questi sono i miei dati» toglie il banner e tratta i numeri come tuoi.

In Teams ogni attività mostra i suoi task: si aggiungono, si modificano (nome, descrizione, team, uso dell'AI, ore, frequenza, tool, owner) e si eliminano con conferma. Le frecce Su e Giù cambiano l'ordine.
