import { useState } from "react";
import type { AppState, Snapshot } from "@/types";
import { fmt } from "@/lib/calc";
import { metrics } from "@/lib/metrics";
import ConfirmButton from "./ConfirmButton";

interface Props {
  state: AppState;
  snapshots: Snapshot[];
  onSave: (label: string) => void;
  onRestore: (s: Snapshot) => void;
  onDelete: (id: string) => void;
}

const ROWS: { key: string; label: string; get: (s: AppState) => number; good: 1 | -1 | 0 }[] = [
  { key: "n", label: "Attività mappate", get: (s) => metrics(s).n, good: 0 },
  { key: "freed", label: "Ore liberate", get: (s) => metrics(s).freed, good: 1 },
  { key: "reinv", label: "Ore potenziate", get: (s) => metrics(s).reinv, good: 1 },
  { key: "unalloc", label: "Ore liberate non allocate", get: (s) => metrics(s).unalloc, good: -1 },
  { key: "residual", label: "Potenziale residuo (h)", get: (s) => metrics(s).residual, good: 0 },
  { key: "solid", label: "Ore liberate misurate o validate (%)", get: (s) => metrics(s).solidShare, good: 1 },
  { key: "blockers", label: "Blocker aperti", get: (s) => metrics(s).blockers, good: -1 },
  { key: "tools", label: "Micro-tool in uso o adottati", get: (s) => metrics(s).toolsLive, good: 1 },
  { key: "users", label: "Utenti attivi sui micro-tool", get: (s) => metrics(s).toolUsers, good: 1 },
];

export default function HistoryView({ state, snapshots, onSave, onRestore, onDelete }: Props) {
  const [label, setLabel] = useState("");
  const [sel, setSel] = useState<string>("");
  const snap = snapshots.find((s) => s.id === sel) ?? snapshots[0];

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Storico</h2>
        <p className="mb-3 text-sm text-slate-500">
          Salva una fotografia dello stato (per esempio a fine mese) per vedere cosa è cambiato. Gli snapshot restano in questo browser e non vanno su Google Sheets.
        </p>
        <div className="flex flex-wrap gap-2">
          <input id="snap-label" className="input max-w-xs" placeholder="Nome, es. Fine novembre" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn-primary" onClick={() => { onSave(label.trim() || new Date().toLocaleDateString("it-IT")); setLabel(""); }}>Salva snapshot</button>
        </div>
      </section>

      {snapshots.length === 0 ? (
        <p className="text-sm text-slate-400">Nessuno snapshot salvato.</p>
      ) : (
        <>
          <section className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium" htmlFor="snap-sel">Confronta lo stato attuale con</label>
              <select id="snap-sel" className="input !w-auto" value={snap?.id} onChange={(e) => setSel(e.target.value)}>
                {snapshots.map((s) => <option key={s.id} value={s.id}>{s.label} ({new Date(s.date).toLocaleDateString("it-IT")})</option>)}
              </select>
            </div>
            {snap && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2">Indicatore</th><th className="text-right">Snapshot</th><th className="text-right">Oggi</th><th className="text-right">Variazione</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {ROWS.map((r) => {
                    const a = r.get(snap.state), b = r.get(state), d = b - a;
                    const tone = d === 0 || r.good === 0 ? "text-slate-600" : d * r.good > 0 ? "text-emerald-700" : "text-rose-600";
                    return (
                      <tr key={r.key} className="border-b border-slate-100">
                        <td className="py-1.5">{r.label}</td>
                        <td className="text-right">{fmt(a, r.key === "solid" ? 0 : 1)}</td>
                        <td className="text-right">{fmt(b, r.key === "solid" ? 0 : 1)}</td>
                        <td className={`text-right font-medium ${tone}`}>{d > 0 ? "+" : ""}{fmt(d, 1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-5">
            <h3 className="mb-2 font-semibold">Snapshot salvati</h3>
            <ul className="space-y-2 text-sm">
              {snapshots.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">{s.label} <span className="text-slate-400">· {new Date(s.date).toLocaleString("it-IT")}</span></span>
                  <ConfirmButton onConfirm={() => onRestore(s)} confirmLabel="Ripristinare?">Ripristina</ConfirmButton>
                  <ConfirmButton className="btn text-rose-600" onConfirm={() => onDelete(s.id)}>Elimina</ConfirmButton>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
