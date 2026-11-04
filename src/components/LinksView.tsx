import { useState } from "react";
import type { Activity, Blocker, BlockerKind, Cadence, MicroTool, Need, Severity, ToolKind, ToolStatus } from "@/types";
import {
  BLOCKER_KINDS, CADENCES, NEEDS, SEVERITIES, TEAMS, TOOL_KINDS, TOOL_STATUSES, TOOL_STATUS_LABEL, captured, eur, fmt,
  isToolLive, sum, teamById, toggleId, uid, uncaptured,
} from "@/lib/calc";
import ConfirmButton from "./ConfirmButton";
import { Term } from "./Term";

interface Props {
  activities: Activity[];
  blockers: Blocker[];
  microTools: MicroTool[];
  hourlyCost: number;
  onChangeBlockers: (next: Blocker[]) => void;
  onChangeTools: (next: MicroTool[]) => void;
}

function Picker({ activities, ids, onToggle }: { activities: Activity[]; ids: string[]; onToggle: (id: string) => void }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-indigo-600">Collega attività ({ids.length})</summary>
      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {TEAMS.map((t) => (
          <div key={t.id}>
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.color }}>{t.name}</div>
            {activities.filter((a) => a.teamId === t.id).map((a) => (
              <label key={a.id} className="flex items-center gap-2 py-0.5 text-xs">
                <input type="checkbox" checked={ids.includes(a.id)} onChange={() => onToggle(a.id)} />
                {a.name}
              </label>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

function Chips({ activities, ids }: { activities: Activity[]; ids: string[] }) {
  const items = activities.filter((a) => ids.includes(a.id));
  if (!items.length) return <div className="mt-2 text-xs text-slate-400">Nessuna attività collegata</div>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((a) => (
        <span key={a.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: teamById(a.teamId).color }} />
          {a.name}
        </span>
      ))}
    </div>
  );
}

const SEV_BADGE: Record<Severity, string> = {
  alta: "bg-rose-100 text-rose-700",
  media: "bg-amber-100 text-amber-700",
  bassa: "bg-slate-100 text-slate-600",
};
const STATUS_BADGE: Record<ToolStatus, string> = {
  adottato: "bg-emerald-100 text-emerald-700",
  in_uso: "bg-sky-100 text-sky-700",
  prototipo: "bg-violet-100 text-violet-700",
  idea: "bg-slate-100 text-slate-600",
};

export default function LinksView({ activities, blockers, microTools, hourlyCost, onChangeBlockers, onChangeTools }: Props) {
  const [filter, setFilter] = useState("");

  const bs = blockers.filter((b) => !filter || b.activityIds.includes(filter));
  const ts = microTools.filter((t) => !filter || t.activityIds.includes(filter));

  const patchB = (id: string, p: Partial<Blocker>) => onChangeBlockers(blockers.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const patchT = (id: string, p: Partial<MicroTool>) => onChangeTools(microTools.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const hoursOf = (ids: string[], f: (a: Activity) => number) =>
    sum(activities.filter((a) => ids.includes(a.id)).map(f));

  /** ore catturate di un'attività divise equamente tra i tool che la toccano */
  const toolValueHours = (t: MicroTool) =>
    sum(
      activities
        .filter((a) => t.activityIds.includes(a.id))
        .map((a) => captured(a) / Math.max(1, microTools.filter((x) => x.activityIds.includes(a.id)).length))
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium" htmlFor="link-filter">Mostra solo ciò che tocca:</label>
        <select id="link-filter" className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tutte le attività</option>
          {activities.map((a) => <option key={a.id} value={a.id}>{teamById(a.teamId).name} · {a.name}</option>)}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Blocker ({bs.length})</h2>
            <button className="btn-primary" onClick={() => onChangeBlockers([...blockers, { id: uid(), name: "Nuovo blocker", kind: "processo", severity: "media", need: "altro", cost: 0, owner: "", activityIds: filter ? [filter] : [] }])}>
              + Blocker
            </button>
          </div>
          {bs.map((b) => {
            const unlock = hoursOf(b.activityIds, uncaptured);
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-start gap-2">
                  <input id={`bn-${b.id}`} className="input font-medium" value={b.name} onChange={(e) => patchB(b.id, { name: e.target.value })} />
                  <ConfirmButton className="btn !px-2 text-rose-600" onConfirm={() => onChangeBlockers(blockers.filter((x) => x.id !== b.id))}>×</ConfirmButton>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <select id={`bk-${b.id}`} className="input" value={b.kind} onChange={(e) => patchB(b.id, { kind: e.target.value as BlockerKind })}>
                    {BLOCKER_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                  <select id={`bs-${b.id}`} className="input" value={b.severity} onChange={(e) => patchB(b.id, { severity: e.target.value as Severity })}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>Gravità {s}</option>)}
                  </select>
                  <input id={`bo-${b.id}`} className="input" placeholder="Owner" value={b.owner} onChange={(e) => patchB(b.id, { owner: e.target.value })} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label><span className="label">Cosa serve per sbloccarlo</span>
                    <select id={`bnd-${b.id}`} className="input" value={b.need} onChange={(e) => patchB(b.id, { need: e.target.value as Need })}>
                      {NEEDS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                  </label>
                  <label><span className="label">Costo una tantum €</span>
                    <input id={`bc-${b.id}`} type="number" min={0} className="input" value={b.cost} onChange={(e) => patchB(b.id, { cost: Math.max(0, +e.target.value) })} />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${SEV_BADGE[b.severity]}`}>Gravità {b.severity}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    Rimuoverlo sblocca fino a {fmt(unlock, 1)} h/mese
                  </span>
                </div>
                <Chips activities={activities} ids={b.activityIds} />
                <Picker activities={activities} ids={b.activityIds} onToggle={(id) => patchB(b.id, { activityIds: toggleId(b.activityIds, id) })} />
              </div>
            );
          })}
          {bs.length === 0 && <p className="text-sm text-slate-400">Nessun blocker collegato a questa attività.</p>}
          <p className="text-[11px] text-slate-400">"Fino a": più <Term k="blocker">blocker</Term> possono insistere sulla stessa attività, quindi i valori non vanno sommati.</p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Repository micro-tool ({ts.length})</h2>
            <button className="btn-primary" onClick={() => onChangeTools([...microTools, { id: uid(), name: "Nuovo micro-tool", description: "", status: "idea", kind: "one_shot", schedule: "", cadence: "on_demand", newTask: "", users: 0, monthlyCost: 0, owner: "", activityIds: filter ? [filter] : [] }])}>
              + Micro-tool
            </button>
          </div>
          {ts.map((t) => {
            const hrs = toolValueHours(t);
            const value = hrs * hourlyCost;
            const roi = t.monthlyCost > 0 ? value / t.monthlyCost : null;
            return (
              <div key={t.id} className="card p-4">
                <div className="flex items-start gap-2">
                  <input id={`tn-${t.id}`} className="input font-medium" value={t.name} onChange={(e) => patchT(t.id, { name: e.target.value })} />
                  <ConfirmButton className="btn !px-2 text-rose-600" onConfirm={() => onChangeTools(microTools.filter((x) => x.id !== t.id))}>×</ConfirmButton>
                </div>
                <textarea id={`td-${t.id}`} rows={2} className="input mt-2" placeholder="Cosa fa" value={t.description} onChange={(e) => patchT(t.id, { description: e.target.value })} />
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label><span className="label">Maturità</span>
                    <select id={`ts-${t.id}`} className="input" value={t.status} onChange={(e) => patchT(t.id, { status: e.target.value as ToolStatus })}>
                      {TOOL_STATUSES.map((s) => <option key={s} value={s}>{TOOL_STATUS_LABEL[s]}</option>)}
                    </select>
                  </label>
                  <label><span className="label">Utenti attivi</span>
                    <input id={`tu-${t.id}`} type="number" min={0} className="input" value={t.users} onChange={(e) => patchT(t.id, { users: Math.max(0, +e.target.value) })} />
                  </label>
                  <label><span className="label">Costo €/mese</span>
                    <input id={`tc-${t.id}`} type="number" min={0} className="input" value={t.monthlyCost} onChange={(e) => patchT(t.id, { monthlyCost: Math.max(0, +e.target.value) })} />
                  </label>
                  <label><span className="label">Owner</span>
                    <input id={`to-${t.id}`} className="input" value={t.owner} onChange={(e) => patchT(t.id, { owner: e.target.value })} />
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label><span className="label">Tipo</span>
                    <select id={`tk-${t.id}`} className="input" value={t.kind} onChange={(e) => patchT(t.id, { kind: e.target.value as ToolKind })}>
                      {TOOL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                  </label>
                  <label><span className="label">Quando gira</span>
                    <input id={`tsch-${t.id}`} className="input" placeholder={t.kind === "one_shot" ? "Solo su richiesta" : "es. ogni mattina alle 7"} disabled={t.kind === "one_shot"} value={t.schedule} onChange={(e) => patchT(t.id, { schedule: e.target.value })} />
                  </label>
                </div>
                {t.kind !== "one_shot" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label><span className="label">Cadenza</span>
                      <select id={`tcd-${t.id}`} className="input" value={t.cadence} onChange={(e) => patchT(t.id, { cadence: e.target.value as Cadence })}>
                        {CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </label>
                    <label className="col-span-2"><span className="label">Cosa fa che prima non facevamo</span>
                      <input id={`tnw-${t.id}`} className="input" placeholder="Vuoto se sostituisce un lavoro che già esisteva" value={t.newTask} onChange={(e) => patchT(t.id, { newTask: e.target.value })} />
                    </label>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[t.status]}`}>{TOOL_STATUS_LABEL[t.status]}</span>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">Tocca {fmt(hrs, 1)} h/mese catturate</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">Valore {eur(value)} contro costo {eur(t.monthlyCost)}</span>
                  {roi !== null && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Ritorno {fmt(roi, 1)}x</span>}
                  {t.kind !== "one_shot" && !isToolLive(t.status) && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">Scenario futuro: {t.kind === "agente" ? "agente" : "automazione ricorrente"}</span>
                  )}
                  {isToolLive(t.status) && t.users === 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">In uso ma senza utenti</span>
                  )}
                  {!isToolLive(t.status) && hrs > 0 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Non ancora in uso: le ore sono potenziale</span>
                  )}
                </div>
                <Chips activities={activities} ids={t.activityIds} />
                <Picker activities={activities} ids={t.activityIds} onToggle={(id) => patchT(t.id, { activityIds: toggleId(t.activityIds, id) })} />
              </div>
            );
          })}
          {ts.length === 0 && <p className="text-sm text-slate-400">Nessun micro-tool collegato a questa attività.</p>}
          <p className="text-[11px] text-slate-400">Il valore divide le ore catturate di ogni attività tra i tool che la toccano, al costo orario ipotizzato ({eur(hourlyCost)}/h).</p>
        </section>
      </div>
    </div>
  );
}
