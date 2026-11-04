# AI Activity Mapper

Mappa delle attività del team per potenziale di automazione e augmentation, con frequenza, micro-task, staffing 2027, AS-IS / TO-BE e agenti.

Senza un foglio collegato l'app lavora solo in questo browser, dati di esempio compresi. Il foglio è facoltativo.

## Sviluppo

```
npm install
npm run dev
```

Per provare l'accesso Google in locale, crea `.env.local` (non va committato):

```
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_SHEETS_URL=https://script.google.com/macros/s/....../exec
```

`VITE_SHEETS_URL` si può anche incollare dal pulsante **Sheets**. Il client ID no: serve in compilazione, perché è quello con cui la pagina chiede il token a Google.

## Pubblicare su GitHub Pages

1. In Settings > Pages scegli come sorgente **GitHub Actions**.
2. Ad ogni push su `main` il workflow `.github/workflows/deploy.yml` compila e pubblica il sito.
3. L'indirizzo è `https://<utente>.github.io/ai-activity-mapper/`.

Il sito Pages è raggiungibile da chiunque conosca l'indirizzo. Non mettere dati riservati nel repository: i dati del team stanno nel foglio e sul Drive, non nel codice. Il client ID OAuth è pubblico per natura e non è una password.

## Collegare Google Sheets

L'app web di Apps Script resta esposta in rete (il browser deve poterla chiamare), ma `doGet` e `doPost` accettano solo un ID token Google di un'email autorizzata. Non c'è un segreto nel JavaScript.

### 1. Client OAuth in Google Cloud

1. Apri [Google Cloud Console](https://console.cloud.google.com/), crea un progetto o usane uno esistente.
2. **API e servizi > Schermata di consenso OAuth**. Se il team è su Google Workspace, scegli **Interno**: potranno accedere solo gli account del dominio. Altrimenti **Esterno**, e aggiungi gli account di prova finché l'app non è pubblicata. Gli ambiti richiesti sono quelli predefiniti (`openid`, `email`, `profile`): non aggiungere altro.
3. **API e servizi > Credenziali > Crea credenziali > ID client OAuth**. Tipo applicazione: **Applicazione web**.
4. **Origini JavaScript autorizzate**:
   - `https://<utente>.github.io`
   - `http://localhost:5173` se sviluppi in locale
5. Il flusso del pulsante Google non usa un redirect. Se la console obbliga a inserire un URI di reindirizzamento, metti `https://<utente>.github.io/ai-activity-mapper/`.
6. Copia il **client ID** (finisce con `.apps.googleusercontent.com`). Non serve il client secret.

### 2. Apps Script

1. Crea un Google Sheet. Non condividerlo con «chiunque abbia il link»: ci finiscono nomi, clienti e costi. Il foglio resta tuo; ci scrive lo script.
2. Estensioni > Apps Script, incolla `apps-script/Code.gs` al posto del file vuoto e salva. Lo script deve restare collegato a questo foglio.
3. Impostazioni progetto (ingranaggio) > **Proprietà dello script**:
   - `OAUTH_CLIENT_ID` = il client ID del punto 1
   - `ALLOWED_EMAILS` = le email autorizzate, separate da virgola (es. `anna@studio.it, leo@studio.it`)
4. Distribuisci > Nuova distribuzione > **App web**:
   - Esegui come: **me**
   - Accesso: **Chiunque**
5. Autorizza gli ambiti (foglio, Drive, richieste esterne). La richiesta esterna serve a verificare il token su `oauth2.googleapis.com`.
6. Copia l'URL dell'app web, quello che finisce con `/exec`. Ogni nuova distribuzione cambia l'URL: se lo rigeneri, aggiorna la variabile o il valore incollato nell'app.

«Chiunque» non apre i dati. Senza un token valido di un'email in `ALLOWED_EMAILS` lo script risponde con un errore e non legge né scrive.

### 3. Variabili di GitHub Actions

In Settings > Secrets and variables > Actions > **Variables** (non Secrets: il client ID finisce comunque nel JavaScript pubblico):

- `VITE_GOOGLE_CLIENT_ID` = il client ID
- `VITE_SHEETS_URL` = l'URL `/exec` (facoltativa: ognuno può incollarla dal pulsante Sheets)

Poi rilancia il workflow. Senza `VITE_GOOGLE_CLIENT_ID` il sito pubblicato non può mostrare il pulsante di accesso.

## Come si salvano i dati

Ogni modifica, con foglio collegato e accesso fatto, parte dopo due secondi.

- La sorgente è il foglio `Entita`: una riga per attività, blocker, persona, cliente, workflow, micro-tool e per le ore reali. Non c'è più un unico JSON nella cella A1, che si fermava a 50.000 caratteri. Un singolo elemento molto lungo può ancora superare il limite di una cella: in quel caso il salvataggio fallisce con un messaggio esplicito.
- Il salvataggio porta un numero di revisione e usa il lock di Apps Script. Se due persone hanno modificato elementi diversi, le modifiche si uniscono. Se hanno modificato lo stesso elemento, compare la scelta «Carica le sue» / «Sovrascrivi con le mie». Sovrascrivere crea una revisione nuova.
- I fogli `Attivita`, `Blocker`, `MicroTool`, `Persone`, `Clienti` e `Misurato` sono report. Si aggiornano al massimo una volta al minuto, e subito quando salvi un'istantanea o ripristini.
- Un foglio vuoto non riceve i dati di esempio. Si parte da zero. L'esempio si carica solo con **Sheets > Carica i dati di esempio**, e solo se il foglio non ha ancora revisioni.
- Finché il primo caricamento non è finito, i campi non si possono modificare.
- Prima di un import, di una sostituzione dal foglio o di «Sovrascrivi con le mie» viene tenuta una copia in questo browser.

## Storico

**Salva istantanea** scrive un file JSON nella cartella Drive `AI Activity Mapper/Storico` (orario del server, email, etichetta, revisione, stato). Restano le ultime 30. Il ripristino passa dallo stesso lock e crea una revisione nuova, con un `updatedAt` nuovo: non riusa la data della copia.

La stessa azione tiene anche una copia in questo browser. Serve quando il foglio non è collegato o il Drive non risponde. Quelle copie non si vedono sugli altri computer.

## Dati di esempio

All'apertura, se in questo browser non c'è ancora nulla, vedi un banner **Dati di esempio**. «Parti da zero» svuota. «Questi sono i miei dati» toglie il banner e tratta i numeri come tuoi.
