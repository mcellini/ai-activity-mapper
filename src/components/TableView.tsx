import { Fragment, useState } from "react";
import type { Activity, TeamId, WorkTask, WorkType } from "@/types";
import { TEAMS, WORK_TYPES, areaLabel, fmt, frequencyLabel, teamById } from "@/lib/calc";
import ActivityDetail from "./ActivityDetail";
import TaskList from "./TaskList";

interface Props {
  activities: Activity[];
  tasks: WorkTask[];
  onChange: (next: Activity[]) => void;
  onTasks: (next: WorkTask[]) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

/** Tabella di inserimento rapido: tutte le attività in una griglia modificabile */
export default function TableView({ activities, tasks, onChange, onTasks }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const patch = (id: string, p: Partial<Activity>) =>
    onChange(activities.map((a) => (a.id === id ? { ...a, ...p } : a)));

  const setManual = (a: Activity, v: number) => {
    const manual = Math.max(0, v);
    const freed = Math.min(a.hoursFreed, manual);
    patch(a.id, { hoursManual: manual, hoursFreed: freed, hoursReinvested: Math.min(a.hoursReinvested, manual - freed) });
  };
  const setFreed = (a: Activity, v: number) => {
    const freed = clamp(v, 0, a.hoursManual);
    patch(a.id, { hoursFreed: freed, hoursReinvested: Math.min(a.hoursReinvested, a.hoursManual - freed) });
  };
  const setReinv = (a: Activity, v: number) =>
    patch(a.id, { hoursReinvested: clamp(v, 0, a.hoursManual - a.hoursFreed) });
  const setAuto = (a: Activity, v: number) => {
    const auto = clamp(v, 0, 100);
    patch(a.id, { pctAutomatable: auto, pctAugmentable: Math.min(a.pctAugmentable, 100 - auto) });
  };
  const setAug = (a: Activity, v: number) => patch(a.id, { pctAugmentable: clamp(v, 0, 100 - a.pctAutomatable) });

  const sorted = [...activities].sort(
    (x, y) => TEAMS.findIndex((t) => t.id === x.teamId) - TEAMS.findIndex((t) => t.id === y.teamId)
  );

  const num = "input !w-20 text-right tabular-nums";

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Tabella rapida</h2>
        <p className="text-sm text-slate-500">
          Modifica tutto in una griglia. I valori restano coerenti: liberate più potenziate non superano le ore manuali, automatizzabile più aumentabile non supera 100%.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[70rem] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="p-2">Team</th><th>Attività</th><th>Tipo lavoro</th><th>Area · frequenza</th>
              <th className="text-right">Ore manuali</th><th className="text-right">Liberate</th><th className="text-right">Potenziate</th>
              <th className="text-right">% autom.</th><th className="text-right">% aument.</th><th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <Fragment key={a.id}>
              <tr className="border-t border-slate-100">
                <td className="p-1.5">
                  <select aria-label={`Team di ${a.name}`} className="input !w-auto" value={a.teamId} onChange={(e) => patch(a.id, { teamId: e.target.value as TeamId })}>
                    {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td className="p-1.5">
                  <input aria-label="Nome attività" className="input min-w-[12rem]" value={a.name} style={{ borderLeft: `3px solid ${teamById(a.teamId).color}` }} onChange={(e) => patch(a.id, { name: e.target.value })} />
                </td>
                <td className="p-1.5">
                  <select aria-label={`Tipo di lavoro di ${a.name}`} className="input !w-auto" value={a.workType} onChange={(e) => patch(a.id, { workType: e.target.value as WorkType })}>
                    {WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                  </select>
                </td>
                <td className="p-1.5 text-xs text-slate-600 whitespace-nowrap">{areaLabel(a.area)} · {frequencyLabel(a.runsPerMonth)}</td>
                <td className="p-1.5 text-right"><input aria-label={`Ore manuali di ${a.name}`} type="number" min={0} className={num} value={a.hoursManual} onChange={(e) => setManual(a, +e.target.value)} /></td>
                <td className="p-1.5 text-right"><input aria-label={`Ore liberate di ${a.name}`} type="number" min={0} className={num} value={a.hoursFreed} onChange={(e) => setFreed(a, +e.target.value)} /></td>
                <td className="p-1.5 text-right"><input aria-label={`Ore potenziate di ${a.name}`} type="number" min={0} className={num} value={a.hoursReinvested} onChange={(e) => setReinv(a, +e.target.value)} /></td>
                <td className="p-1.5 text-right"><input aria-label={`Percentuale automatizzabile di ${a.name}`} type="number" min={0} max={100} className={num} value={a.pctAutomatable} onChange={(e) => setAuto(a, +e.target.value)} /></td>
                <td className="p-1.5 pr-2 text-right"><input aria-label={`Percentuale aumentabile di ${a.name}`} type="number" min={0} max={100} className={num} value={a.pctAugmentable} onChange={(e) => setAug(a, +e.target.value)} /></td>
                <td className="p-1.5 pr-2">
                  <button className="btn !px-2 text-xs" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                    {open === a.id ? "Chiudi" : `Task (${tasks.filter((t) => t.activityId === a.id).length})`}
                  </button>
                </td>
              </tr>
              {open === a.id && (
                <tr><td colSpan={10} className="p-0">
                  <ActivityDetail a={a} onChange={(next) => onChange(activities.map((x) => (x.id === a.id ? next : x)))} />
                  <div className="border-t border-slate-100 p-3">
                    <TaskList
                      activity={a}
                      tasks={tasks.filter((t) => t.activityId === a.id)}
                      onChange={(mine) => onTasks([...tasks.filter((t) => t.activityId !== a.id), ...mine])}
                    />
                  </div>
                </td></tr>
              )}
              </Fragment>
            ))}
            {sorted.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-slate-400">Nessuna attività. Importa un CSV o aggiungile da Teams.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold tabular-nums">
              <td className="p-2" colSpan={4}>Totale ({sorted.length})</td>
              <td className="text-right">{fmt(sorted.reduce((s, a) => s + a.hoursManual, 0), 1)}</td>
              <td className="text-right">{fmt(sorted.reduce((s, a) => s + a.hoursFreed, 0), 1)}</td>
              <td className="text-right">{fmt(sorted.reduce((s, a) => s + a.hoursReinvested, 0), 1)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
