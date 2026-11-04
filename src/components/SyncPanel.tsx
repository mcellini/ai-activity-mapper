import { useState } from "react";
import type { SyncStatus } from "@/types";
import type { GoogleSession } from "@/lib/googleAuth";
import Dialog from "./Dialog";
import GoogleSignInButton from "./GoogleSignInButton";

interface Props {
  url: string;
  status: SyncStatus;
  error: string;
  email: string;
  canUploadExample: boolean;
  onCredential: (session: GoogleSession) => void;
  onSignOut: () => void;
  onSaveUrl: (url: string) => void;
  onPull: () => void;
  onUploadExample: () => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: "Solo locale",
  auth: "Accesso richiesto",
  loading: "Caricamento…",
  idle: "Collegato",
  saving: "Salvataggio…",
  saved: "Salvato",
  error: "Errore",
};

export default function SyncPanel({
  url, status, error, email, canUploadExample, onCredential, onSignOut, onSaveUrl, onPull, onUploadExample, onClose,
}: Props) {
  const [value, setValue] = useState(url);
  return (
    <Dialog title="Sincronizzazione Google Sheets" onClose={onClose}>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Crea il client OAuth e le proprietà dello script come descritto nel README.</li>
        <li>Distribuisci l'app web: esegui come te, accesso «Chiunque». L'accesso vero è l'elenco email.</li>
        <li>Incolla l'URL che termina con <code>/exec</code> e accedi con Google.</li>
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
      <div className="text-sm text-slate-600">
        Stato: {STATUS_LABEL[status]}
        {email && <span> · {email}</span>}
        {error && <span className="text-rose-600"> · {error}</span>}
      </div>
      {email ? (
        <button type="button" className="btn" onClick={onSignOut}>Esci da Google</button>
      ) : (
        <GoogleSignInButton onCredential={onCredential} />
      )}
      <p className="text-xs text-slate-500">
        Senza URL il lavoro resta in questo browser. Un foglio vuoto non riceve i dati di esempio: si parte da zero, e l'esempio si carica solo dal pulsante qui sotto.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {canUploadExample && (
          <button type="button" className="btn" onClick={onUploadExample}>Carica i dati di esempio</button>
        )}
        <button type="button" className="btn" onClick={onPull} disabled={!value.trim() || !email}>Ricarica dal foglio</button>
        <button type="button" className="btn-primary" onClick={() => onSaveUrl(value.trim())}>Salva URL</button>
      </div>
    </Dialog>
  );
}
