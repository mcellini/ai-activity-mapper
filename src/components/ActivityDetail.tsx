import type { Activity, Area, SubTask, Treatment } from "@/types";
import { AREAS, FREQUENCIES, TREATMENTS, fmt, frequencyLabel } from "@/lib/calc";
import { applySubtasks, defaultSaved, newSubtask, subtaskMismatch, subtaskTotals } from "@/lib/subtasks";
import ConfirmButton from "./ConfirmButton";

interface Props {
  a: Activity;
  onChange: (next: Activity) => void;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Pannello di dettaglio: area, frequenza e micro-task di una macro-attività */
export default function ActivityDetail({ a, onChange }: Props) {
  const withHours = (p: Partial<Activity>): Activity => {
    const next = { ...a, ...p };
    // frequenza x ore per esecuzione = ore al mese, se entrambe note
    if (next.runsPerMonth > 0 && next.hoursPerRun > 0) {
      const manual = r1(next.runsPerMonth * next.hoursPerRun);
      const freed = Math.min(next.hoursFreed, manual);
      return { ...next, hoursManual: manual, hoursFreed: freed, hoursReinvested: Math.min(next.hoursReinvested, manual - freed) };
    }
    return next;
  };

  const setRuns = (runs: number) => {
    const r = Math.max(0, runs);
    onChange(withHours({ runsPerMonth: r, hoursPerRun: a.hoursPerRun > 0 ? a.hoursPerRun : r > 0 && a.hoursManual > 0 ? r1(a.hoursManual / r) : 0 }));
  };

  const patchSub = (id: string, p: Partial<SubTask>) =>
    onChange({ ...a, subtasks: a.subtasks.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const setTreatment = (s: SubTask, t: Treatment) => patchSub(s.id, { treatment: t, pctSaved: defaultSaved(t) });

  const t = subtaskTotals(a.subtasks);
  const mismatch = subtaskMismatch(a);

  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <label><span className="label">Area</span>
          <select id={`ar-${a.id}`} className="input" value={a.area} onChange={(e) => onChange({ ...a, area: e.target.value as Area })}>
            {AREAS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <label><span className="label">Frequenza</span>
          <select id={`fq-${a.id}`} className="input" value={FREQUENCIES.find((f) => Math.abs(f.runs - a.runsPerMonth) < 0.01)?.id ?? (a.runsPerMonth ? "custom" : "")} onChange={(e) => {
            const f = FREQUENCIES.find((x) => x.id === e.target.value);
            setRuns(f ? f.runs : 0);
          }}>
            <option value="">Non indicata</option>
            {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            {a.runsPerMonth > 0 && !FREQUENCIES.some((f) => Math.abs(f.runs - a.runsPerMonth) < 0.01) && <option value="custom">{frequencyLabel(a.runsPerMonth)}</option>}
          </select>
        </label>
        <label><span className="label">Esecuzioni al mese</span>
          <input id={`rn-${a.id}`} type="number" min={0} step={0.1} className="input" value={a.runsPerMonth} onChange={(e) => setRuns(+e.target.value)} />
        </label>
        <label><span className="label">Ore per esecuzione</span>
          <input id={`hp-${a.id}`} type="number" min={0} step={0.1} className="input" value={a.hoursPerRun} onChange={(e) => onChange(withHours({ hoursPerRun: Math.max(0, +e.target.value) }))} />
        </label>
      </div>
      {a.runsPerMonth > 0 && a.hoursPerRun > 0 && (
        <p className="text-xs text-slate-500">
          {fmt(a.runsPerMonth, 1)} esecuzioni × {fmt(a.hoursPerRun, 1)} h = {fmt(a.hoursManual, 1)} h/mese. Se cambi uno dei due, le ore manuali si aggiornano.
        </p>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Micro-task ({a.subtasks.length})</h3>
          <button className="btn" onClick={() => onChange({ ...a, subtasks: [...a.subtasks, newSubtask()] })}>+ Micro-task</button>
          {a.subtasks.length > 0 && (
            <button className={mismatch ? "btn-primary" : "btn"} disabled={t.manual <= 0} onClick={() => onChange(applySubtasks(a))}>
              Applica alle ore dell'attività
            </button>
          )}
        </div>
        {a.subtasks.length === 0 ? (
          <p className="text-sm text-slate-500">
            Scomponi l'attività in micro-task (es. keyword research in raccolta, pulizia, clustering…) e indica per ciascuno se resta umano, è automatizzato, aumentato o nasce grazie all'AI.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th>Micro-task</th><th>Trattamento</th><th className="text-right">Ore/mese</th><th className="text-right">% risparmiata</th><th className="text-right">Ore risparmiate</th><th />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {a.subtasks.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200">
                    <td className="py-1 pr-2"><input aria-label="Nome micro-task" className="input min-w-[12rem]" value={s.name} onChange={(e) => patchSub(s.id, { name: e.target.value })} /></td>
                    <td className="pr-2">
                      <select aria-label={`Trattamento di ${s.name}`} className="input" value={s.treatment} onChange={(e) => setTreatment(s, e.target.value as Treatment)}>
                        {TREATMENTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                    </td>
                    <td className="pr-2 text-right"><input aria-label={`Ore di ${s.name}`} type="number" min={0} step={0.5} className="input !w-20 text-right" value={s.hours} onChange={(e) => patchSub(s.id, { hours: Math.max(0, +e.target.value) })} /></td>
                    <td className="pr-2 text-right">
                      <input aria-label={`Percentuale risparmiata di ${s.name}`} type="number" min={0} max={100} className="input !w-20 text-right" disabled={s.treatment === "umano" || s.treatment === "nuovo"} value={s.pctSaved} onChange={(e) => patchSub(s.id, { pctSaved: Math.max(0, Math.min(100, +e.target.value)) })} />
                    </td>
                    <td className="pr-2 text-right">{s.treatment === "nuovo" ? <span className="text-violet-700">+{fmt(s.hours, 1)} nuove</span> : fmt((s.hours * s.pctSaved) / 100, 1)}</td>
                    <td><ConfirmButton className="btn !px-2 text-rose-600" onConfirm={() => onChange({ ...a, subtasks: a.subtasks.filter((x) => x.id !== s.id) })}>×</ConfirmButton></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 font-semibold">
                  <td className="py-1.5" colSpan={2}>Totale dai micro-task</td>
                  <td className="text-right">{fmt(t.manual, 1)}</td>
                  <td />
                  <td className="text-right">
                    <span className="text-emerald-700">−{fmt(t.freed, 1)}</span> / <span className="text-sky-700">{fmt(t.reinv, 1)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {a.subtasks.length > 0 && (
          <p className={`mt-2 text-xs ${mismatch ? "text-amber-700" : "text-slate-500"}`}>
            {mismatch
              ? `I micro-task dicono ${fmt(t.manual, 1)} h, ${fmt(t.freed, 1)} liberate e ${fmt(t.reinv, 1)} potenziate, ma l'attività ne dichiara ${fmt(a.hoursManual, 1)}, ${fmt(a.hoursFreed, 1)} e ${fmt(a.hoursReinvested, 1)}. Usa «Applica» per allinearla.`
              : "L'attività è allineata ai micro-task."}
            {t.newHours > 0 && ` Il lavoro nuovo grazie all'AI vale ${fmt(t.newHours, 1)} h/mese e non entra nel risparmio.`}
          </p>
        )}
      </div>
    </div>
  );
}
