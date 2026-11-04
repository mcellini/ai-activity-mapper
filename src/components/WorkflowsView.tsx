import { useState } from "react";
import type { TeamId, Workflow, WorkflowStep } from "@/types";
import { TEAMS, teamById, uid } from "@/lib/calc";
import ConfirmButton from "./ConfirmButton";

interface Props {
  workflows: Workflow[];
  onChange: (next: Workflow[]) => void;
}

export default function WorkflowsView({ workflows, onChange }: Props) {
  const [activeId, setActiveId] = useState(workflows[0]?.id ?? "");
  const wf = workflows.find((w) => w.id === activeId) ?? workflows[0];

  const patchWf = (id: string, patch: Partial<Workflow>) =>
    onChange(workflows.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const patchStep = (stepId: string, patch: Partial<WorkflowStep>) =>
    wf && patchWf(wf.id, { steps: wf.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) });

  const addWorkflow = () => {
    const w: Workflow = { id: uid(), name: "Nuovo workflow", steps: [] };
    onChange([...workflows, w]);
    setActiveId(w.id);
  };

  const removeWorkflow = () => {
    if (!wf) return;
    const rest = workflows.filter((w) => w.id !== wf.id);
    onChange(rest);
    setActiveId(rest[0]?.id ?? "");
  };

  const addStep = () =>
    wf &&
    patchWf(wf.id, {
      steps: [
        ...wf.steps,
        { id: uid(), name: "Nuovo step", teams: [], tools: "", automationNote: "", augmentationNote: "", dependencies: "" },
      ],
    });

  const moveStep = (i: number, dir: -1 | 1) => {
    if (!wf) return;
    const j = i + dir;
    if (j < 0 || j >= wf.steps.length) return;
    const steps = [...wf.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    patchWf(wf.id, { steps });
  };

  const toggleTeam = (s: WorkflowStep, t: TeamId) =>
    patchStep(s.id, { teams: s.teams.includes(t) ? s.teams.filter((x) => x !== t) : [...s.teams, t] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {workflows.map((w) => (
          <button key={w.id} className={wf?.id === w.id ? "btn-primary" : "btn"} onClick={() => setActiveId(w.id)}>
            {w.name}
          </button>
        ))}
        <button className="btn" onClick={addWorkflow}>+ Workflow</button>
      </div>

      {!wf && <p className="text-sm text-slate-500">Nessun workflow. Creane uno per mappare un processo end-to-end.</p>}

      {wf && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input className="input max-w-md text-base font-semibold" value={wf.name} onChange={(e) => patchWf(wf.id, { name: e.target.value })} />
            <ConfirmButton className="btn text-rose-600" confirmLabel="Eliminare?" onConfirm={removeWorkflow}>Elimina</ConfirmButton>
            <div className="flex-1" />
            <button className="btn-primary" onClick={addStep}>+ Step</button>
          </div>

          <ol className="relative space-y-3 border-l-2 border-slate-200 pl-6">
            {wf.steps.map((s, i) => (
              <li key={s.id} className="card relative p-4">
                <span className="absolute -left-[37px] top-4 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <div className="mb-3 flex items-center gap-2">
                  <input className="input font-medium" value={s.name} onChange={(e) => patchStep(s.id, { name: e.target.value })} />
                  <button className="btn !px-2" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn !px-2" onClick={() => moveStep(i, 1)} disabled={i === wf.steps.length - 1}>↓</button>
                  <button className="btn !px-2 text-rose-600" onClick={() => patchWf(wf.id, { steps: wf.steps.filter((x) => x.id !== s.id) })}>×</button>
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {TEAMS.map((t) => {
                    const on = s.teams.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTeam(s, t.id)}
                        className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                        style={on ? { background: teamById(t.id).color, borderColor: t.color, color: "#fff" } : { borderColor: "#cbd5e1", color: "#64748b" }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label><span className="label text-emerald-600">Automazione (velocità/efficienza)</span>
                    <textarea rows={2} className="input" value={s.automationNote} onChange={(e) => patchStep(s.id, { automationNote: e.target.value })} />
                  </label>
                  <label><span className="label text-sky-600">Augmentation (qualità/valore)</span>
                    <textarea rows={2} className="input" value={s.augmentationNote} onChange={(e) => patchStep(s.id, { augmentationNote: e.target.value })} />
                  </label>
                  <label><span className="label">Tool</span>
                    <input className="input" value={s.tools} onChange={(e) => patchStep(s.id, { tools: e.target.value })} />
                  </label>
                  <label><span className="label">Dipendenze / colli di bottiglia</span>
                    <input className="input" value={s.dependencies} onChange={(e) => patchStep(s.id, { dependencies: e.target.value })} />
                  </label>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
