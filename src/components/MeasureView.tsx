import { useState } from "react";
import type { Activity, AppState } from "@/types";
import { currentMonth, fmt, sum, teamById } from "@/lib/calc";
import { Term } from "./Term";

interface Props {
  state: AppState;
  onActuals: (next: AppState["actuals"]) => void;
  onActivities: (next: Activity[]) => void;
}

export default function MeasureView({ state, onActuals, onActivities }: Props) {
  const [month, setMonth] = useState(currentMonth());

  const get = (id: string): number | undefined => state.actuals[id]?.[month];

  const setActual = (id: string, raw: string) => {
    const next = { ...state.actuals, [id]: { ...(state.actuals[id] ?? {}) } };
    if (raw === "") delete next[id][month];
    else next[id][month] = Math.max(0, +raw);
    onActuals(next);
  };

  const markMeasured = (id: string) =>
    onActivities(state.activities.map((a) => (a.id === id ? { ...a, confidence: "misurato" } : a)));

  const rows = state.activities.map((a) => {
    const actual = get(a.id);
    const expected = Math.max(0, a.hoursManual - a.hoursFreed);
    return { a, actual, expected, delta: actual === undefined ? undefined : actual - expected };
  });

  const measured = rows.filter((r) => r.actual !== undefined);
  const expectedFreed = sum(measured.map((r) => r.a.hoursFreed));
  const realFreed = sum(measured.map((r) => r.a.hoursManual - (r.actual as number)));
  const rate = expectedFreed > 0 ? (realFreed / expectedFreed) * 100 : 0;

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Misurazione contro baseline</h2>
            <p className="text-sm text-slate-500">
              Inserisci le ore reali del mese per ogni attività. Lo <Term k="scarto">scarto</Term> mostra se il risparmio stimato si sta realizzando.
            </p>
          </div>
          <label htmlFor="month" className="text-sm">
            <span className="label">Mese</span>
            <input id="month" type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xl font-semibold tabular-nums">{measured.length}/{rows.length}</div>
            <div className="text-[11px] text-slate-500">attività misurate</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xl font-semibold tabular-nums">{fmt(realFreed)} / {fmt(expectedFreed)}</div>
            <div className="text-[11px] text-slate-500">ore liberate reali / attese</div>
          </div>
          <div className={`rounded-lg p-3 ${measured.length === 0 ? "bg-slate-50" : rate >= 90 ? "bg-emerald-50" : rate >= 60 ? "bg-amber-50" : "bg-rose-50"}`}>
            <div className="text-xl font-semibold tabular-nums">{measured.length ? `${fmt(rate)}%` : "n.d."}</div>
            <div className="text-[11px] text-slate-500">realizzazione del risparmio</div>
          </div>
        </div>
      </section>

      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2">Attività</th>
              <th className="text-right"><Term k="baseline">Baseline</Term></th>
              <th className="text-right">Atteso con AI</th>
              <th className="text-right">Reale ({month})</th>
              <th className="text-right"><Term k="scarto">Scarto</Term></th>
              <th className="pl-3"><Term k="confidenza">Confidenza</Term></th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(({ a, actual, expected, delta }) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: teamById(a.teamId).color }} />
                  {a.name}
                </td>
                <td className="text-right">{fmt(a.hoursManual)}</td>
                <td className="text-right">{fmt(expected)}</td>
                <td className="text-right">
                  <input id={`ac-${a.id}`} type="number" min={0} className="input !w-20 text-right" value={actual ?? ""} onChange={(e) => setActual(a.id, e.target.value)} />
                </td>
                <td className={`text-right font-medium ${delta === undefined ? "text-slate-300" : delta <= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {delta === undefined ? "n.d." : `${delta > 0 ? "+" : ""}${fmt(delta)}`}
                </td>
                <td className="pl-3 text-xs">
                  {a.confidence === "stima" && actual !== undefined ? (
                    <button className="rounded-full border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-cyan-800" onClick={() => markMeasured(a.id)}>Segna come misurato</button>
                  ) : (
                    <span className="text-slate-500">{a.confidence}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-slate-400">Scarto negativo: l'attività sta richiedendo meno ore di quelle attese con l'AI. Positivo: il risparmio non si sta ancora realizzando.</p>
      </section>
    </div>
  );
}
