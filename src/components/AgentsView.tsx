import type { AppState } from "@/types";
import { CADENCES, TOOL_STATUSES, TOOL_STATUS_LABEL, fmt, isToolLive, teamById, toolKindLabel, uncaptured, sum } from "@/lib/calc";

const STATUS_STYLE = {
  adottato: "border-emerald-300 bg-emerald-50",
  in_uso: "border-sky-300 bg-sky-50",
  prototipo: "border-dashed border-violet-300 bg-violet-50",
  idea: "border-dashed border-slate-300 bg-white",
} as const;

/** Routine e agenti: cosa gira già da solo, cosa faremmo che prima non facevamo */
export default function AgentsView({ state, onGo }: { state: AppState; onGo: (tab: string) => void }) {
  const routines = state.microTools.filter((t) => t.kind !== "one_shot");
  const live = routines.filter((t) => isToolLive(t.status));
  const future = routines.filter((t) => !isToolLive(t.status));
  const withNew = routines.filter((t) => t.newTask.trim());
  const newSub = (state.tasks ?? [])
    .filter((s) => s.treatment === "nuovo")
    .flatMap((s) => {
      const a = state.activities.find((x) => x.id === s.activityId);
      return a ? [{ a, s }] : [];
    });
  const newHours = sum(newSub.map((x) => x.s.hours));
  const potential = (ids: string[]) => sum(state.activities.filter((a) => a.area !== "rnd" && ids.includes(a.id)).map(uncaptured));

  const lanes = CADENCES.filter((c) => c.id !== "on_demand").map((c) => ({
    ...c,
    items: routines.filter((t) => t.cadence === c.id),
  }));
  const onDemand = routines.filter((t) => t.cadence === "on_demand");
  const teamOf = (ids: string[]) => {
    const a = state.activities.find((x) => ids.includes(x.id));
    return a ? teamById(a.teamId) : null;
  };

  const pipeline = TOOL_STATUSES.map((s) => ({ s, n: routines.filter((t) => t.status === s).length }));

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="label">Agenti e routine</div>
        <p className="max-w-3xl text-xl font-semibold leading-snug">
          {routines.length === 0
            ? "Nessun agente o routine censito."
            : <>{live.length} {live.length === 1 ? "routine gira" : "routine girano"} già da sole, {future.length} {future.length === 1 ? "è" : "sono"} scenario futuro.
              {withNew.length > 0 && <> {withNew.length} {withNew.length === 1 ? "fa" : "fanno"} cose che prima non facevamo.</>}</>}
        </p>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Un agente non serve solo a fare prima: permette lavori che oggi nessuno ha tempo di fare, come ascoltare ogni mattina un canale o avvisare quando cambia un dato.
          Gli agenti non ancora in uso sono potenziale da mappare, non risparmio.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {pipeline.map((p) => (
            <div key={p.s} className={`rounded-lg border px-3 py-2 text-center ${STATUS_STYLE[p.s]}`}>
              <div className="text-lg font-semibold tabular-nums">{p.n}</div>
              <div className="text-[11px] text-slate-600">{TOOL_STATUS_LABEL[p.s]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Cosa gira, e quando</h2>
        <p className="mb-3 text-sm text-slate-500">Tratto pieno: già attivo. Tratteggiato: prototipo o idea. La stella segna ciò che prima non facevamo.</p>
        {routines.length === 0 ? (
          <p className="text-sm text-slate-400">Imposta il tipo «ricorrente» o «agente» su un micro-tool dalla scheda Collegamenti.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {lanes.map((l) => (
              <div key={l.id} className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">{l.label}</h3>
                  <span className="text-xs text-slate-500">{l.items.length}</span>
                </div>
                <div className="space-y-2">
                  {l.items.map((t) => {
                    const team = teamOf(t.activityIds);
                    return (
                      <div key={t.id} className={`rounded-lg border p-3 text-sm ${STATUS_STYLE[t.status]}`}>
                        <div className="flex items-start gap-2">
                          {team && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: team.color }} title={team.name} />}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{t.name}{t.newTask.trim() && <span title="Prima non lo facevamo" className="ml-1 text-amber-500">★</span>}</div>
                            <div className="text-xs text-slate-500">{toolKindLabel(t.kind)} · {TOOL_STATUS_LABEL[t.status].toLowerCase()}{t.schedule && ` · ${t.schedule}`}</div>
                          </div>
                        </div>
                        {t.newTask.trim() && <p className="mt-2 text-xs text-slate-700">{t.newTask}</p>}
                        {t.activityIds.length > 0 && <p className="mt-1 text-[11px] text-slate-400">Tocca fino a {fmt(potential(t.activityIds), 1)} h/mese di potenziale</p>}
                      </div>
                    );
                  })}
                  {l.items.length === 0 && <p className="py-2 text-center text-xs text-slate-400">Nessuna</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {onDemand.length > 0 && <p className="mt-3 text-xs text-slate-500">Su richiesta: {onDemand.map((t) => t.name).join(", ")}.</p>}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Lavoro che prima non esisteva</h2>
        <p className="mb-3 text-sm text-slate-500">Cose che il team non faceva per mancanza di tempo e che l'AI rende possibili. Non entrano nel risparmio: sono valore aggiunto.</p>
        {withNew.length === 0 && newSub.length === 0 ? (
          <p className="text-sm text-slate-400">Niente ancora. Indica «cosa fa che prima non facevamo» su un agente, oppure aggiungi micro-task «nuovi» in una attività.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {withNew.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{isToolLive(t.status) ? "Attivo" : "Scenario"}</span>
                <span className="font-medium">{t.name}</span>
                <span className="text-slate-600">{t.newTask}</span>
              </li>
            ))}
            {newSub.map(({ a, s }) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">Micro-task nuovo</span>
                <span className="font-medium">{s.name}</span>
                <span className="text-slate-500">dentro «{a.name}», {fmt(s.hours, 1)} h/mese</span>
              </li>
            ))}
          </ul>
        )}
        {newHours > 0 && <p className="mt-3 text-sm text-slate-600">Dai micro-task: <b>{fmt(newHours, 1)} h/mese</b> di lavoro nuovo.</p>}
        <p className="mt-3 text-xs text-slate-400">
          Per modificare cadenza, stato e descrizione vai in <button className="font-medium text-indigo-600" onClick={() => onGo("Collegamenti")}>Collegamenti</button>.
        </p>
      </section>
    </div>
  );
}
