# AI Activity Mapper

Mappa delle attività del team per potenziale di automazione e augmentation, con frequenza, micro-task, staffing 2027, AS-IS / TO-BE e agenti.

## Sviluppo

```
npm install
npm run dev
```

## Pubblicare su GitHub Pages

1. Crea un repository e carica questo progetto sul ramo `main`.
2. In Settings > Pages scegli come sorgente **GitHub Actions**.
3. Ad ogni push su `main` il workflow `.github/workflows/deploy.yml` compila e pubblica il sito.

Nota: GitHub Pages per repository privati richiede un piano a pagamento, e un sito Pages è raggiungibile da chiunque conosca l'indirizzo (salvo piani Enterprise con accesso limitato). Non caricare dati riservati nel repository: i dati vivono nel foglio Google, non nel codice.

## Salvare i dati su Google Sheets

1. Crea un Google Sheet, apri Estensioni > Apps Script e incolla `apps-script/Code.gs`.
2. Distribuisci > Nuova distribuzione > App web: esegui come te stesso, accesso a «Chiunque».
3. Copia l'indirizzo dell'app web (finisce con `/exec`).
4. In GitHub: Settings > Secrets and variables > Actions > Variables, crea `VITE_SHEETS_URL` con quell'indirizzo e rilancia il workflow. In alternativa, ognuno lo incolla dal pulsante **Sheets** dell'app.

Come funziona: ogni modifica viene inviata al foglio dopo due secondi. Il foglio `AppData` tiene lo stato completo; gli altri fogli (Attivita, Blocker, MicroTool, Persone, Clienti, Misurato) sono leggibili e usabili per report.

Limiti da conoscere:
- Chi conosce l'indirizzo dell'app web può leggere e scrivere i dati: non c'è un login per persona.
- Il salvataggio sovrascrive l'intero stato: se due persone modificano insieme, vince l'ultima. Conviene che compilino a turno, o ciascuno il proprio team, e che usino il pulsante Sheets > Carica prima di iniziare.
- Il pulsante Storico salva istantanee solo nel browser di chi le crea.
