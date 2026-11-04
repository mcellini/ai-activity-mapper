import { useState } from "react";
import type {
  Activity, Blocker, Complexity, Confidence, Destination, MicroTool, RiskLevel, TeamId, WorkTask, WorkType,
} from "@/types";
import {
  CONFIDENCE, COMPLEXITY_LABEL, DESTINATIONS, RISK_LABEL, TEAMS, WORK_TYPES, confLabel, fmt,
  areaLabel, frequencyLabel, pctHuman, teamById, toggleId, workTypeLabel,
} from "@/lib/calc";
import ConfirmButton from "./ConfirmButton";
import Wizard from "./Wizard";
import ActivityDetail from "./ActivityDetail";
import TaskList from "./TaskList";

interface Props {
  activities: Activity[];
  tasks: WorkTask[];
  blockers: Blocker[];
  microTools: MicroTool[];
  onChange: (next: Activity[]) => void;
  onTasks: (next: WorkTask[]) => void;
  onAdd: (activity: Activity) => void;
  onChangeBlockers: (next: Blocker[]) => void;
  onChangeTools: (next: MicroTool[]) => void;
}

function SegBar({ a }: { a: Activity }) {
  const h = pctHuman(a);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div style={{ width: `${a.pctAutomatable}%` }} className="bg-emerald-500" />
        <div style={{ width: `${a.pctAugmentable}%` }} className="bg-sky-500" />
        <div style={{ width: `${h}%` }} className="bg-slate-300" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>Automatizzabile {a.pctAutomatable}%</span>
        <span>Aumentabile {a.pctAugmentable}%</span>
        <span>Umano {h}%</span>
      </div>
    </div>
  );
}

const SEV_STYLE = {
  alta: "bg-rose-50 text-rose-700 border-rose-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  bassa: "bg-slate-50 text-slate-600 border-slate-200",
};
const CONF_STYLE: Record<Confidence, string> = {
  stima: "bg-slate-100 text-slate-600",
  misurato: "bg-cyan-100 text-cyan-800",
  validato: "bg-emerald-100 text-emerald-800",
};
const RISK_STYLE: Record<RiskLevel, string> = {
  nd: "bg-slate-100 text-slate-500",
  basso: "bg-emerald-50 text-emerald-700",
  medio: "bg-amber-50 text-amber-700",
  alto: "bg-rose-100 text-rose-700",
};

export default function TeamsView({
  activities, tasks, blockers, microTools, onChange, onTasks, onAdd, onChangeBlockers, onChangeTools,
}: Props) {
  const [team, setTeam] = useState<TeamId | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);

  const visible = activities.filter((a) => team === "all" || a.teamId === team);

  const update = (id: string, patch: Partial<Activity>) =>
    onChange(activities.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const setPct = (a: Activity, key: "pctAutomatable" | "pctAugmentable", v: number) => {
    const other = key === "pctAutomatable" ? a.pctAugmentable : a.pctAutomatable;
    update(a.id, { [key]: Math.max(0, Math.min(v, 100 - other)) } as Partial<Activity>);
  };

  const setManual = (a: Activity, v: number) => {
    const manual = Math.max(0, v);
    const freed = Math.min(a.hoursFreed, manual);
    update(a.id, { hoursManual: manual, hoursFreed: freed, hoursReinvested: Math.min(a.hoursReinvested, manual - freed) });
  };

  const setHours = (a: Activity, key: "hoursFreed" | "hoursReinvested", v: number) => {
    const other = key === "hoursFreed" ? a.hoursReinvested : a.hoursFreed;
    update(a.id, { [key]: Math.max(0, Math.min(v, a.hoursManual - other)) } as Partial<Activity>);
  };

  const remove = (id: string) => {
    onChange(activities.filter((a) => a.id !== id).map((a) => ({ ...a, dependsOn: a.dependsOn.filter((x) => x !== id) })));
    onChangeBlockers(blockers.map((b) => ({ ...b, activityIds: b.activityIds.filter((x) => x !== id) })));
    onChangeTools(microTools.map((t) => ({ ...t, activityIds: t.activityIds.filter((x) => x !== id) })));
  };

  const replaceTasks = (activityId: string, mine: WorkTask[]) =>
    onTasks([...tasks.filter((t) => t.activityId !== activityId), ...mine]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={team === "all" ? "btn-primary" : "btn"} onClick={() => setTeam("all")}>
          Tutti ({activities.length})
        </button>
        {TEAMS.map((t) => (
          <button key={t.id} className={team === t.id ? "btn-primary" : "btn"} onClick={() => setTeam(t.id)}>
            <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
            {t.name} ({activities.filter((a) => a.teamId === t.id).length})
          </button>
        ))}
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => setWizard(true)}>+ Attività</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((a) => {
          const t = teamById(a.teamId);
          const open = editing === a.id;
          const myBlockers = blockers.filter((b) => b.activityIds.includes(a.id));
          const myTools = microTools.filter((m) => m.activityIds.includes(a.id));
          const after = activities.filter((x) => a.dependsOn.includes(x.id));
          const remaining = Math.max(0, a.hoursManual - a.hoursFreed);
          return (
            <div key={a.id} className="card p-4" style={{ borderTop: `3px solid ${t.color}` }}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.color }}>
                    {t.name} · {workTypeLabel(a.workType)}{a.area !== "delivery" && <> · {areaLabel(a.area)}</>}
                  </div>
                  {open ? (
                    <input id={`nm-${a.id}`} className="input mt-1" value={a.name} onChange={(e) => update(a.id, { name: e.target.value })} />
                  ) : (
                    <h3 className="font-semibold leading-tight">{a.name}</h3>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn !px-2 !py-1" onClick={() => setEditing(open ? null : a.id)}>
                    {open ? "Chiudi" : "Modifica"}
                  </button>
                  <ConfirmButton className="btn !px-2 !py-1 text-rose-600" confirmLabel="Elimina?" onConfirm={() => remove(a.id)}>×</ConfirmButton>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-semibold">{fmt(a.hoursManual)}</div>
                  <div className="text-[11px] text-slate-500">ore/mese oggi</div>
                </div>
                <button
                  className={`rounded-lg p-2 ${a.runsPerMonth > 0 ? "bg-slate-50" : "border border-dashed border-amber-300 bg-amber-50"}`}
                  onClick={() => setEditing(a.id)}
                  title="Apri la scheda per indicare la frequenza"
                >
                  <div className={`text-sm font-semibold leading-7 ${a.runsPerMonth > 0 ? "" : "text-amber-700"}`}>
                    {a.runsPerMonth > 0 ? frequencyLabel(a.runsPerMonth) : "Da indicare"}
                  </div>
                  <div className="text-[11px] text-slate-500">frequenza</div>
                </button>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <div className="text-lg font-semibold text-emerald-700">−{fmt(a.hoursFreed)}</div>
                  <div className="text-[11px] text-emerald-700">liberate</div>
                </div>
                <div className="rounded-lg bg-sky-50 p-2">
                  <div className="text-lg font-semibold text-sky-700">{fmt(a.hoursReinvested)}</div>
                  <div className="text-[11px] text-sky-700">potenziate</div>
                </div>
              </div>

              <div className="mb-3 text-[11px] text-slate-500">
                Dopo l'AI restano {fmt(remaining)} h sull'attività.{" "}
                {a.hoursFreed > 0 && (a.destination === "non_allocata" ? (
                  <span className="font-semibold text-amber-600">Le {fmt(a.hoursFreed)} h liberate sono da classificare: dove le abbiamo reinvestite?</span>
                ) : (
                  <>Le {fmt(a.hoursFreed)} h liberate sono reinvestite in <span className="font-medium text-slate-700">{DESTINATIONS.find((d) => d.id === a.destination)?.label.toLowerCase()}</span>.</>
                ))}
              </div>

              <SegBar a={a} />

              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 ${CONF_STYLE[a.confidence]}`}>{confLabel(a.confidence)}</span>
                <span className={`rounded-full px-2 py-0.5 ${RISK_STYLE[a.riskLevel]}`}>Rischio {RISK_LABEL[a.riskLevel].toLowerCase()}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">Complessità {COMPLEXITY_LABEL[a.complexity]}</span>
                {a.tools && <span className="rounded-full bg-slate-100 px-2 py-0.5">{a.tools}</span>}
                {after.map((x) => (
                  <span key={x.id} className="rounded-full border border-slate-300 px-2 py-0.5 text-slate-600">dopo: {x.name}</span>
                ))}
                {myTools.map((m) => (
                  <span key={m.id} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700" title={m.description}>
                    ⚙ {m.name}
                  </span>
                ))}
                {myBlockers.map((b) => (
                  <span key={b.id} className={`rounded-full border px-2 py-0.5 ${SEV_STYLE[b.severity]}`}>
                    ⛔ {b.name}
                  </span>
                ))}
              </div>
              {a.humanControl && (
                <div className="mt-2 text-[11px] text-slate-500">Controllo umano: {a.humanControl}</div>
              )}

              <div className="mt-3 border-t border-slate-100 pt-3">
                <TaskList
                  activity={a}
                  tasks={tasks.filter((t) => t.activityId === a.id)}
                  onChange={(mine) => replaceTasks(a.id, mine)}
                />
              </div>

              {open && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <label><span className="label">Team</span>
                    <select id={`team-${a.id}`} className="input" value={a.teamId} onChange={(e) => update(a.id, { teamId: e.target.value as TeamId })}>
                      {TEAMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>
                  <label><span className="label">Tipo di lavoro</span>
                    <select id={`wt-${a.id}`} className="input" value={a.workType} onChange={(e) => update(a.id, { workType: e.target.value as WorkType })}>
                      {WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                    </select>
                  </label>
                  <label><span className="label">Ore/mese oggi (baseline)</span>
                    <input id={`hm-${a.id}`} type="number" min={0} className="input" value={a.hoursManual} onChange={(e) => setManual(a, +e.target.value)} />
                  </label>
                  <label><span className="label">Complessità</span>
                    <select id={`cx-${a.id}`} className="input" value={a.complexity} onChange={(e) => update(a.id, { complexity: e.target.value as Complexity })}>
                      {(["low", "medium", "high"] as Complexity[]).map((c) => <option key={c} value={c}>{COMPLEXITY_LABEL[c]}</option>)}
                    </select>
                  </label>
                  <div className="col-span-2 overflow-hidden rounded-lg border border-slate-200">
                    <ActivityDetail a={a} onChange={(next) => onChange(activities.map((x) => (x.id === a.id ? next : x)))} />
                  </div>
                  <label><span className="label text-emerald-600">Ore liberate (automation)</span>
                    <input id={`hf-${a.id}`} type="number" min={0} className="input" value={a.hoursFreed} onChange={(e) => setHours(a, "hoursFreed", +e.target.value)} />
                  </label>
                  <label><span className="label text-sky-600">Ore potenziate (augmentation)</span>
                    <input id={`hr-${a.id}`} type="number" min={0} className="input" value={a.hoursReinvested} onChange={(e) => setHours(a, "hoursReinvested", +e.target.value)} />
                  </label>
                  <label><span className="label">Dove vengono reinvestite le ore liberate</span>
                    <select id={`dest-${a.id}`} className="input" value={a.destination} onChange={(e) => update(a.id, { destination: e.target.value as Destination })}>
                      {DESTINATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </label>
                  <label><span className="label">Confidenza dei numeri</span>
                    <select id={`conf-${a.id}`} className="input" value={a.confidence} onChange={(e) => update(a.id, { confidence: e.target.value as Confidence })}>
                      {CONFIDENCE.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <label><span className="label">% automatizzabile ({a.pctAutomatable})</span>
                    <input type="range" min={0} max={100} step={5} className="w-full" value={a.pctAutomatable} onChange={(e) => setPct(a, "pctAutomatable", +e.target.value)} />
                  </label>
                  <label><span className="label">% aumentabile ({a.pctAugmentable})</span>
                    <input type="range" min={0} max={100} step={5} className="w-full" value={a.pctAugmentable} onChange={(e) => setPct(a, "pctAugmentable", +e.target.value)} />
                  </label>
                  <label><span className="label">Rischio con l'AI</span>
                    <select id={`risk-${a.id}`} className="input" value={a.riskLevel} onChange={(e) => update(a.id, { riskLevel: e.target.value as RiskLevel })}>
                      {(Object.keys(RISK_LABEL) as RiskLevel[]).map((k) => <option key={k} value={k}>{RISK_LABEL[k]}</option>)}
                    </select>
                  </label>
                  <label><span className="label">Controllo umano richiesto</span>
                    <input id={`ctl-${a.id}`} className="input" value={a.humanControl} onChange={(e) => update(a.id, { humanControl: e.target.value })} />
                  </label>
                  <label className="col-span-2"><span className="label">Tool di terze parti</span>
                    <input id={`tl-${a.id}`} className="input" value={a.tools} onChange={(e) => update(a.id, { tools: e.target.value })} />
                  </label>

                  <div className="col-span-2">
                    <span className="label">Da sistemare prima (dipendenze tra attività)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activities.filter((x) => x.id !== a.id).map((x) => {
                        const on = a.dependsOn.includes(x.id);
                        return (
                          <button key={x.id} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 text-slate-500"}`}
                            onClick={() => update(a.id, { dependsOn: toggleId(a.dependsOn, x.id) })}>
                            {on ? "✓ " : ""}{x.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="label">Blocker collegati</span>
                    <div className="flex flex-wrap gap-1.5">
                      {blockers.length === 0 && <span className="text-xs text-slate-400">Nessun blocker definito (tab Collegamenti)</span>}
                      {blockers.map((b) => {
                        const on = b.activityIds.includes(a.id);
                        return (
                          <button key={b.id} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-rose-300 bg-rose-100 text-rose-800" : "border-slate-300 text-slate-500"}`}
                            onClick={() => onChangeBlockers(blockers.map((x) => (x.id === b.id ? { ...x, activityIds: toggleId(x.activityIds, a.id) } : x)))}>
                            {on ? "✓ " : ""}{b.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="label">Micro-tool collegati</span>
                    <div className="flex flex-wrap gap-1.5">
                      {microTools.length === 0 && <span className="text-xs text-slate-400">Nessun micro-tool definito (tab Collegamenti)</span>}
                      {microTools.map((m) => {
                        const on = m.activityIds.includes(a.id);
                        return (
                          <button key={m.id} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-indigo-300 bg-indigo-100 text-indigo-800" : "border-slate-300 text-slate-500"}`}
                            onClick={() => onChangeTools(microTools.map((x) => (x.id === m.id ? { ...x, activityIds: toggleId(x.activityIds, a.id) } : x)))}>
                            {on ? "✓ " : ""}{m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="col-span-2"><span className="label">Note sulle dipendenze</span>
                    <input id={`dp-${a.id}`} className="input" value={a.dependencies} onChange={(e) => update(a.id, { dependencies: e.target.value })} />
                  </label>
                  <label className="col-span-2"><span className="label">Note</span>
                    <textarea id={`nt-${a.id}`} rows={2} className="input" value={a.notes} onChange={(e) => update(a.id, { notes: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {wizard && (
        <Wizard
          defaultTeam={team === "all" ? "seo" : team}
          onClose={() => setWizard(false)}
          onCreate={(a) => {
            onAdd(a);
            setWizard(false);
            setEditing(a.id);
          }}
        />
      )}
    </div>
  );
}
