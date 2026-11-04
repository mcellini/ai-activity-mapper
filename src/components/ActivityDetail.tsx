import type { Activity, Area } from "@/types";
import { AREAS, FREQUENCIES, fmt, frequencyLabel } from "@/lib/calc";

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

    </div>
  );
}
