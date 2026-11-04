import { useState } from "react";
import type { SyncStatus } from "@/types";

interface Props {
  url: string;
  status: SyncStatus;
  error: string;
  onSaveUrl: (url: string) => void;
  onPull: () => void;
  onClose: () => void;
}

export default function SyncPanel({ url, status, error, onSaveUrl, onPull, onClose }: Props) {
  const [value, setValue] = useState(url);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Sincronizzazione Google Sheets</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Crea un Google Sheet, poi Estensioni › Apps Script.</li>
          <li>Incolla il contenuto di <code>apps-script/Code.gs</code>.</li>
          <li>Deploy › Nuova distribuzione › App web (accesso: chiunque).</li>
          <li>Incolla qui sotto l'URL che termina con <code>/exec</code>.</li>
        </ol>
        <input className="input" placeholder="https://script.google.com/macros/s/.../exec" value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="text-xs text-slate-500">
          Stato: {status}{error && <span className="text-rose-600"> · {error}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onPull} disabled={!value}>Carica dal foglio</button>
          <button className="btn-primary" onClick={() => { onSaveUrl(value.trim()); onClose(); }}>Salva</button>
        </div>
      </div>
    </div>
  );
}
