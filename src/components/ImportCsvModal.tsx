import { useRef, useState } from "react";
import type { Activity } from "@/types";
import { parseCsv, rowsToActivities, type CsvResult } from "@/lib/csv";
import { fmt, teamById } from "@/lib/calc";
import Dialog from "./Dialog";

interface Props {
  existing: number;
  onImport: (activities: Activity[], mode: "append" | "replace") => void;
  onClose: () => void;
}

export default function ImportCsvModal({ existing, onImport, onClose }: Props) {
  const [res, setRes] = useState<CsvResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const load = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setArmed(false);
    setRes(rowsToActivities(parseCsv(await f.text())));
  };

  const ok = res && res.activities.length > 0;

  return (
    <Dialog title="Importa attività da CSV" onClose={onClose} wide>
        <div>
          <p className="text-sm text-slate-500">
            Salva il foglio Excel come CSV. Servono le colonne Team, Attività e Ore manuali (o Ore/mese). Facoltative: Area (delivery, gare, R&D), Esecuzioni/mese, Tipo lavoro, Ore con AI, Ore liberate, Ore potenziate, Automatizzabile, Aumentabile, Complessità, Tool, Note.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary" onClick={() => ref.current?.click()}>Scegli file CSV</button>
          <span className="text-sm text-slate-500">{fileName || "Nessun file scelto"}</span>
          <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => load(e.target.files?.[0])} />
        </div>

        {res && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-semibold">{res.activities.length} attività valide</span>
              {res.errors.length > 0 && <span className="text-rose-600">, {res.errors.length} righe scartate</span>}
              {res.recognized.length > 0 && <div className="text-xs text-slate-500">Colonne riconosciute: {res.recognized.join(", ")}</div>}
            </div>
            {res.errors.length > 0 && (
              <ul className="max-h-28 space-y-0.5 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                {res.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}
                {res.errors.length > 20 && <li>… e altre {res.errors.length - 20}</li>}
              </ul>
            )}
            {ok && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[34rem] text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                      <th className="p-2">Team</th><th>Attività</th><th className="text-right">Ore</th><th className="text-right">Liberate</th><th className="pr-2 text-right">Potenziate</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {res.activities.slice(0, 6).map((a) => (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="p-2">{teamById(a.teamId).name}</td>
                        <td className="max-w-[16rem] truncate">{a.name}</td>
                        <td className="text-right">{fmt(a.hoursManual, 1)}</td>
                        <td className="text-right">{fmt(a.hoursFreed, 1)}</td>
                        <td className="pr-2 text-right">{fmt(a.hoursReinvested, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {res.activities.length > 6 && <div className="border-t border-slate-100 p-2 text-xs text-slate-500">… e altre {res.activities.length - 6}</div>}
              </div>
            )}
            {ok && (
              <fieldset className="space-y-1">
                <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === "append"} onChange={() => { setMode("append"); setArmed(false); }} /> Aggiungi alle {existing} attività esistenti</label>
                <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === "replace"} onChange={() => { setMode("replace"); setArmed(false); }} /> Sostituisci le {existing} attività esistenti</label>
                {mode === "replace" && <p className="text-xs text-amber-700">Sostituire rimuove anche i collegamenti di blocker e micro-tool alle attività attuali.</p>}
              </fieldset>
            )}
            <p className="text-xs text-slate-500">Dove mancano, destinazione, confidenza e rischio partono come «da classificare», «stima» e «da valutare». Le percentuali mancanti usano il valore tipico del tipo di lavoro.</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Chiudi</button>
          {ok && (
            <button
              type="button"
              className={mode === "replace" && !armed ? "btn !border-rose-300 !text-rose-700" : "btn-primary"}
              onClick={() => {
                if (mode === "replace" && !armed) { setArmed(true); return; }
                onImport(res.activities, mode);
              }}
            >
              {mode === "replace" ? (armed ? "Conferma: sostituisci tutto" : "Sostituisci…") : `Aggiungi ${res.activities.length} attività`}
            </button>
          )}
        </div>
    </Dialog>
  );
}
