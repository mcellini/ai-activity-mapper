import { useState } from "react";
import type { SyncStatus } from "@/types";
import Dialog from "./Dialog";

interface Props {
  url: string;
  status: SyncStatus;
  error: string;
  password: string;
  remember: boolean;
  canUploadExample: boolean;
  onPassword: (password: string, remember: boolean) => void;
  onSignOut: () => void;
  onSaveUrl: (url: string) => void;
  onPull: () => void;
  onUploadExample: () => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: "Solo locale",
  auth: "Password richiesta",
  loading: "Caricamento…",
  idle: "Collegato",
  saving: "Salvataggio…",
  saved: "Salvato",
  error: "Errore",
};

export function PasswordFields({
  password, remember, onSubmit,
}: {
  password: string;
  remember: boolean;
  onSubmit: (password: string, remember: boolean) => void;
}) {
  const [draft, setDraft] = useState(password);
  const [keep, setKeep] = useState(remember);
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit(draft, keep); }}>
      <label className="block text-sm" htmlFor="gate-password">
        Password condivisa
        <input id="gate-password" type="password" autoComplete="current-password" className="input mt-1" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm" htmlFor="gate-remember">
        <input id="gate-remember" type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        Ricordami su questo dispositivo
      </label>
      <button type="submit" className="btn-primary" disabled={!draft}>Entra</button>
    </form>
  );
}

export default function SyncPanel({
  url, status, error, password, remember, canUploadExample, onPassword, onSignOut, onSaveUrl, onPull, onUploadExample, onClose,
}: Props) {
  const [value, setValue] = useState(url);
  const [draft, setDraft] = useState(password);
  const [keep, setKeep] = useState(remember);
  return (
    <Dialog title="Sincronizzazione Google Sheets" onClose={onClose}>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Nello script imposta la proprietà <code>APP_PASSWORD</code>.</li>
        <li>Distribuisci l'app web: esegui come te, accesso «Chiunque».</li>
        <li>Incolla l'URL che termina con <code>/exec</code> e la password condivisa.</li>
      </ol>
      <label className="block text-sm" htmlFor="sheets-url">
        URL dell'app web
        <input
          id="sheets-url"
          className="input mt-1"
          placeholder="https://script.google.com/macros/s/.../exec"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <label className="block text-sm" htmlFor="sheets-password">
        Password condivisa
        <input
          id="sheets-password"
          type="password"
          autoComplete="current-password"
          className="input mt-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm" htmlFor="sheets-remember">
        <input id="sheets-remember" type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        Ricordami su questo dispositivo
      </label>
      <div className="text-sm text-slate-600" role="status">
        Stato: {STATUS_LABEL[status]}
        {error && <span className="text-rose-700"> · {error}</span>}
      </div>
      <p className="text-xs text-slate-500">
        Senza URL il lavoro resta in questo browser. Un foglio vuoto non riceve i dati di esempio.
        Chi ha la password e l'indirizzo può leggere e scrivere.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {password && <button type="button" className="btn" onClick={onSignOut}>Esci</button>}
        {canUploadExample && (
          <button type="button" className="btn" onClick={onUploadExample}>Carica i dati di esempio</button>
        )}
        <button type="button" className="btn" onClick={onPull} disabled={!value.trim() || !draft}>Ricarica dal foglio</button>
        <button type="button" className="btn-primary" onClick={() => { onPassword(draft, keep); onSaveUrl(value.trim()); }}>Salva</button>
      </div>
    </Dialog>
  );
}
