import type { Activity, TeamId, Treatment, WorkTask } from "@/types";
import { TEAMS, TREATMENTS } from "@/lib/calc";
import { defaultSaved, newTask } from "@/lib/subtasks";
import ConfirmButton from "./ConfirmButton";

interface Props {
  activity: Activity;
  tasks: WorkTask[];
  onChange: (next: WorkTask[]) => void;
}

/** Elenco modificabile dei task di un'attività. Ogni task ha un id stabile. */
export default function TaskList({ activity, tasks, onChange }: Props) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "it"));

  const patch = (id: string, partial: Partial<WorkTask>) =>
    onChange(sorted.map((t) => (t.id === id ? { ...t, ...partial } : t)));

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= sorted.length) return;
    const copy = sorted.map((t, i) => ({ ...t, order: i }));
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy.map((t, i) => ({ ...t, order: i })));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Task ({sorted.length})</h3>
        <button
          type="button"
          className="btn !px-2 !py-1"
          onClick={() => onChange([...sorted, newTask(activity, sorted.length)])}
        >
          + Task
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">Nessun task. Aggiungine uno: nome, ore, trattamento e tool restano modificabili qui.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((task, index) => (
            <li key={task.id} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs sm:col-span-2">
                  <span className="label">Nome</span>
                  <input aria-label={`Nome del task ${index + 1}`} className="input" value={task.name} onChange={(e) => patch(task.id, { name: e.target.value })} />
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="label">Descrizione</span>
                  <input aria-label={`Descrizione del task ${task.name}`} className="input" value={task.notes} onChange={(e) => patch(task.id, { notes: e.target.value })} />
                </label>
                <label className="block text-xs">
                  <span className="label">Team</span>
                  <select aria-label={`Team di ${task.name}`} className="input" value={task.teamId} onChange={(e) => patch(task.id, { teamId: e.target.value as TeamId })}>
                    {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="label">Uso dell'AI</span>
                  <select aria-label={`Trattamento di ${task.name}`} className="input" value={task.treatment} onChange={(e) => {
                    const treatment = e.target.value as Treatment;
                    patch(task.id, { treatment, pctSaved: defaultSaved(treatment) });
                  }}>
                    {TREATMENTS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="label">Ore/mese</span>
                  <input aria-label={`Ore di ${task.name}`} type="number" min={0} step={0.5} className="input" value={task.hours} onChange={(e) => patch(task.id, { hours: Math.max(0, +e.target.value || 0) })} />
                </label>
                <label className="block text-xs">
                  <span className="label">% risparmiata</span>
                  <input aria-label={`Percentuale risparmiata di ${task.name}`} type="number" min={0} max={100} className="input" disabled={task.treatment === "umano" || task.treatment === "nuovo"} value={task.pctSaved} onChange={(e) => patch(task.id, { pctSaved: Math.max(0, Math.min(100, +e.target.value || 0)) })} />
                </label>
                <label className="block text-xs">
                  <span className="label">Esecuzioni al mese</span>
                  <input aria-label={`Frequenza di ${task.name}`} type="number" min={0} step={0.1} className="input" value={task.runsPerMonth} onChange={(e) => patch(task.id, { runsPerMonth: Math.max(0, +e.target.value || 0) })} />
                </label>
                <label className="block text-xs">
                  <span className="label">Owner</span>
                  <input aria-label={`Owner di ${task.name}`} className="input" value={task.owner} onChange={(e) => patch(task.id, { owner: e.target.value })} />
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="label">Tool</span>
                  <input aria-label={`Tool di ${task.name}`} className="input" value={task.tools} onChange={(e) => patch(task.id, { tools: e.target.value })} />
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" className="btn !px-2 !py-1" aria-label={`Sposta su ${task.name}`} disabled={index === 0} onClick={() => move(index, -1)}>Su</button>
                <button type="button" className="btn !px-2 !py-1" aria-label={`Sposta giù ${task.name}`} disabled={index === sorted.length - 1} onClick={() => move(index, 1)}>Giù</button>
                <ConfirmButton className="btn !px-2 !py-1 text-rose-600" confirmLabel="Eliminare?" onConfirm={() => onChange(sorted.filter((t) => t.id !== task.id).map((t, i) => ({ ...t, order: i })))}>
                  Elimina
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
