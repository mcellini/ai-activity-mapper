import type { AppState } from "@/types";
import { CONFIDENCE, DESTINATIONS, PHASE_ORDER, TOOL_STATUSES, TOOL_STATUS_LABEL, eur, fmt, isToolLive, median, phase, sum, teamById, toolKindLabel, uncaptured } from "@/lib/calc";
import { metrics } from "@/lib/metrics";
import { computeScenario, totals } from "@/lib/staffing";
import { runChecks } from "@/lib/quality";
import { toBe } from "@/lib/tobe";
import { GLOSSARY, Term } from "./Term";

interface Props {
  state: AppState;
  onGo: (tab: string) => void;
  onSettings: (patch: Partial<AppState["settings"]>) => void;
}

/** Traduce le persone mancanti (+) o in eccesso (-) in una frase leggibile */
function staffingWords(v: number): { text: string; tone: string } {
  if (v > 0.5) return { text: `mancano ${fmt(v, 1)} persone`, tone: "text-rose-700" };
  if (v < -0.5) return { text: `${fmt(-v, 1)} persone in eccesso`, tone: "text-emerald-700" };
  return { text: "organico in equilibrio", tone: "text-slate-700" };
}

export default function ExecutiveView({ state, onGo, onSettings }: Props) {
  const m = metrics(state);
  const t = toBe(state);
  const issues = runChecks(state);
  const grave = issues.filter((i) => i.level === "alta").length;

  const acts = state.activities.filter((a) => a.area !== "rnd");
  const med = median(acts.map(uncaptured));
  const nB = (id: string) => state.blockers.filter((b) => b.activityIds.includes(id)).length;

  const quickWins = acts
    .filter((a) => phase(a, med, nB(a.id)) === PHASE_ORDER[0])
    .sort((x, y) => uncaptured(y) - uncaptured(x))
    .slice(0, 3);
  const topBlockers = t.rows.filter((r) => r.unlock > 0).sort((x, y) => y.unlock - x.unlock).slice(0, 3);
  const riskFlags = acts.filter((a) => a.riskLevel === "alto" && a.pctAutomatable >= 30);
  const riskNoControl = riskFlags.filter((a) => !a.humanControl.trim());

  const hasStaffing = state.clients.length > 0 && state.people.length > 0;
  const scen = (["worst", "base", "best"] as const).map((s) => ({
    id: s,
    label: s === "worst" ? "Caso peggiore" : s === "base" ? "Caso base" : "Caso migliore",
    ai: totals(computeScenario(state, s, 50)).peopleAI,
    noAi: totals(computeScenario(state, s, 0)).people,
  }));

  // agenti e routine: quanti ne abbiamo sviluppati, di cosa si occupano, cosa permettono di fare
  const tools = state.microTools;
  const built = tools.filter((t) => t.status !== "idea");
  const countKind = (k: string) => built.filter((t) => t.kind === k).length;
  const agents = built.filter((t) => t.kind !== "one_shot").sort((x, y) => TOOL_STATUSES.indexOf(y.status) - TOOL_STATUSES.indexOf(x.status));
  const ideas = tools.filter((t) => t.status === "idea");
  const enabling = tools.filter((t) => t.newTask.trim());
  const teamsOf = (ids: string[]) =>
    [...new Set(state.activities.filter((a) => ids.includes(a.id)).map((a) => a.teamId))].map(teamById);
  const rest = Math.max(0, m.manual - m.freed - m.reinv);
  const byDest = DESTINATIONS.map((d) => ({ ...d, hours: sum(acts.filter((a) => a.destination === d.id).map((a) => a.hoursFreed)) })).filter((d) => d.hours > 0);
  const pct = (v: number) => `${m.manual ? (v / m.manual) * 100 : 0}%`;
  const confTotal = Math.max(1, m.conf.stima + m.conf.misurato + m.conf.validato);
  const solid = m.solidShare >= 60 ? "ok" : m.solidShare >= 30 ? "mid" : "low";

  // cosa fare adesso, in ordine di importanza
  const actions: { text: string; detail: string; tab: string; cta: string }[] = [];
  if (grave > 0) {
    actions.push({ text: `Correggere ${grave} incoerenze gravi nei dati`, detail: "Prima di mostrare i numeri a qualcuno.", tab: "Controlli", cta: "Apri i controlli" });
  }
  if (topBlockers[0]) {
    const b = topBlockers[0];
    actions.push({
      text: `Sbloccare «${b.blocker.name}»`,
      detail: `Vale fino a ${fmt(b.unlock)} h/mese${b.blocker.cost ? `, costo ${eur(b.blocker.cost)}` : ", senza costo"}.${b.blocker.owner ? ` Owner: ${b.blocker.owner}.` : " Manca un owner."}`,
      tab: "AS-IS / TO-BE", cta: "Vedi la lista della spesa",
    });
  }
  if (quickWins.length > 0) {
    actions.push({
      text: `Avviare ${quickWins.length === 1 ? "la quick win" : `le ${quickWins.length} quick win`}: ${quickWins.map((a) => a.name).join(", ")}`,
      detail: `Poco sforzo, fino a ${fmt(sum(quickWins.map(uncaptured)))} h/mese in più.`,
      tab: "Roadmap", cta: "Apri la roadmap",
    });
  }
  if (m.unalloc > 0) {
    actions.push({
      text: `Indicare dove sono state reinvestite ${fmt(m.unalloc)} h liberate`,
      detail: "Le ore liberate sono già reinvestite: se non lo si scrive, il risparmio si legge come «di quante risorse hai bisogno in meno?».",
      tab: "Riepilogo", cta: "Classifica le ore",
    });
  }
  if (m.solidShare < 60 && m.freed > 0) {
    actions.push({
      text: `Misurare le ${fmt(m.conf.stima)} h liberate ancora basate su stima`,
      detail: `Oggi solo il ${fmt(m.solidShare)}% è misurato o validato.`,
      tab: "Misurazione", cta: "Vai alla misurazione",
    });
  }
  if (riskNoControl.length > 0) {
    actions.push({
      text: `Definire il controllo umano su ${riskNoControl.length} attività a rischio alto`,
      detail: riskNoControl.map((a) => a.name).join(", "),
      tab: "Teams", cta: "Apri le attività",
    });
  }
  const todo = actions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1. dove siamo */}
      <section className="card p-6">
        <div className="label">Dove siamo oggi</div>
        <p className="max-w-3xl text-xl font-semibold leading-snug">
          Su {fmt(m.manual)} ore di lavoro al mese, l'AI ne <span className="text-emerald-700">libera {fmt(m.freed)}</span> ({fmt(m.freedPct)}%)
          e ne rende <span className="text-sky-700">{fmt(m.reinv)} più produttive</span>.
        </p>

        <div className="mt-4 flex h-6 w-full overflow-hidden rounded bg-slate-100" role="img" aria-label={`${fmt(m.freed)} ore liberate, ${fmt(m.reinv)} potenziate, ${fmt(rest)} invariate`}>
          <div className="bg-emerald-500" style={{ width: pct(m.freed) }} />
          <div className="bg-sky-500" style={{ width: pct(m.reinv) }} />
        </div>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /><Term k="liberate">Liberate</Term>: <b className="tabular-nums">{fmt(m.freed)} h</b><div className="text-xs text-slate-500">il lavoro sparisce dall'attività e il tempo viene reinvestito</div></div>
          <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" /><Term k="reinvestite">Potenziate</Term>: <b className="tabular-nums">{fmt(m.reinv)} h</b><div className="text-xs text-slate-500">stesso tempo sull'attività, più qualità e output</div></div>
          <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-slate-200" />Invariate: <b className="tabular-nums">{fmt(rest)} h</b><div className="text-xs text-slate-500">lavoro che resta com'è oggi</div></div>
        </div>

        {m.freed > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold">Dove sono state reinvestite le {fmt(m.freed)} h liberate</div>
            <div className="mt-2 flex h-4 w-full overflow-hidden rounded bg-slate-100" role="img" aria-label="Destinazione delle ore liberate">
              {byDest.map((d) => <div key={d.id} style={{ width: `${(d.hours / m.freed) * 100}%`, background: d.color }} title={`${d.label}: ${fmt(d.hours)} h`} />)}
            </div>
            <div className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {byDest.map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                  <span className="min-w-0 flex-1 truncate">{d.label}</span>
                  <b className="tabular-nums">{fmt(d.hours)} h</b>
                </div>
              ))}
            </div>
            {m.unalloc > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                {fmt(m.unalloc)} h sono ancora «da classificare»: non sono ore inutilizzate, manca solo indicare dove sono state reinvestite.{" "}
                <button className="font-medium underline" onClick={() => onGo("Riepilogo")}>Classificale</button>
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-medium ${solid === "ok" ? "bg-emerald-100 text-emerald-800" : solid === "mid" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>
            {fmt(m.solidShare)}% dei numeri misurato o validato
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            Valore stimato {eur(m.net)}/mese ({fmt(m.freed)} h × {eur(state.settings.hourlyCost)}/h meno {eur(m.toolCost)} di tool): un'ipotesi, non un risparmio di cassa
          </span>
        </div>
        {(m.rnd > 0 || m.gare > 0 || m.newHours > 0) && (
          <p className="mt-3 text-xs text-slate-500">
            {m.gare > 0 && <>Dentro i numeri ci sono {fmt(m.gare)} h/mese di gare e biz dev. </>}
            {m.rnd > 0 && <>Fuori dai numeri: {fmt(m.rnd)} h/mese di R&D e formazione, che sono tempo investito. </>}
            {m.newHours > 0 && <>L'AI ha anche creato {fmt(m.newHours, 1)} h/mese di lavoro che prima non esisteva.</>}
          </p>
        )}
      </section>

      {/* 2. tre domande */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tre cose da sapere per decidere</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card flex flex-col p-5">
            <div className="label">1. Quanto sono affidabili i numeri?</div>
            <div className={`text-3xl font-semibold tabular-nums ${solid === "ok" ? "text-emerald-700" : solid === "mid" ? "text-amber-600" : "text-rose-600"}`}>{fmt(m.solidShare)}%</div>
            <p className="text-sm text-slate-600">delle ore liberate è misurato o validato. Il resto è la stima del team.</p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded bg-slate-100">
              {CONFIDENCE.map((c) => <div key={c.id} style={{ width: `${(m.conf[c.id] / confTotal) * 100}%`, background: c.color }} title={`${c.label}: ${fmt(m.conf[c.id])} h`} />)}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
              {CONFIDENCE.map((c) => <span key={c.id}><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: c.color }} />{c.label} {fmt(m.conf[c.id])} h</span>)}
            </div>
            <button className="mt-auto pt-3 text-left text-xs font-medium text-indigo-600" onClick={() => onGo("Misurazione")}>Vai alla misurazione</button>
          </div>

          <div className="card flex flex-col p-5">
            <div className="label">2. Quanto possiamo ancora ottenere?</div>
            <div className="text-3xl font-semibold tabular-nums text-indigo-700">+{fmt(t.uniqueUnlock)} h</div>
            <p className="text-sm text-slate-600">
              al mese, rimuovendo i limiti già censiti{t.totalCost > 0 && <>: {eur(t.totalCost)} una tantum{t.payback !== null && <>, rientro in circa {fmt(t.payback, 1)} mesi</>}</>}.
            </p>
            <p className="mt-2 text-xs text-slate-500">Altre {fmt(t.undefinedHours)} h/mese di potenziale non hanno ancora un piano.</p>
            <button className="mt-auto pt-3 text-left text-xs font-medium text-indigo-600" onClick={() => onGo("AS-IS / TO-BE")}>Apri AS-IS / TO-BE e lista della spesa</button>
          </div>

          <div className="card flex flex-col p-5">
            <div className="label">3. Cosa cambia per le persone nel 2027?</div>
            {hasStaffing ? (
              <>
                <ul className="mt-1 space-y-2 text-sm">
                  {scen.map((s) => {
                    const w = staffingWords(s.ai);
                    return (
                      <li key={s.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-600">{s.label}</span>
                          <span className={`font-semibold ${w.tone}`}>{w.text}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">senza AI: {staffingWords(s.noAi).text}</div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">Con l'AI che cattura il 50% del potenziale. Peggiore: restano solo i clienti quasi certi. Migliore: tutte le gare vinte.</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Inserisci clienti e persone nella scheda Staffing per vedere gli scenari.</p>
            )}
            <button className="mt-auto pt-3 text-left text-xs font-medium text-indigo-600" onClick={() => onGo("Staffing")}>Apri il simulatore di staffing</button>
          </div>
        </div>
      </section>

      {/* agenti */}
      {tools.length > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Agenti e micro-tool sviluppati</h2>
            <button className="text-xs font-medium text-indigo-600" onClick={() => onGo("Agenti")}>Apri la vista agenti</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold tabular-nums">{countKind("agente")}</div><div className="text-xs text-slate-500">agenti che lavorano da soli</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold tabular-nums">{countKind("ricorrente")}</div><div className="text-xs text-slate-500">routine ricorrenti</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold tabular-nums">{countKind("one_shot")}</div><div className="text-xs text-slate-500">micro-tool a richiesta</div></div>
            <div className="rounded-lg bg-amber-50 p-3"><div className="text-2xl font-semibold tabular-nums text-amber-700">{enabling.length}</div><div className="text-xs text-amber-800">fanno ciò che prima non facevamo</div></div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Sviluppati = prototipo, in uso o adottati: {built.length}. In uso reale: {built.filter((t) => isToolLive(t.status)).length}.{" "}
            {ideas.length > 0 && <>Altre {ideas.length} idee non ancora sviluppate.</>}
          </p>

          {agents.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {agents.map((t) => {
                const teams = teamsOf(t.activityIds);
                const touched = sum(acts.filter((a) => t.activityIds.includes(a.id)).map(uncaptured));
                return (
                  <div key={t.id} className={`rounded-lg border p-3 text-sm ${isToolLive(t.status) ? "border-emerald-200 bg-emerald-50/40" : "border-dashed border-violet-300 bg-violet-50/40"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{t.name}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] ring-1 ring-slate-200">{toolKindLabel(t.kind)}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] ring-1 ring-slate-200">{TOOL_STATUS_LABEL[t.status]}</span>
                    </div>
                    <p className="mt-1 text-slate-600"><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Si occupa di </span>{t.description || "descrizione da completare"}</p>
                    <p className="mt-1 text-slate-700">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Abilita </span>
                      {t.newTask.trim() ? t.newTask : `fa in automatico un lavoro che già facevamo${touched > 0 ? `, tocca fino a ${fmt(touched, 1)} h/mese` : ""}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {teams.map((x) => <span key={x.id} className="rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: x.color }} />{x.name}</span>)}
                      {t.schedule && <span>{t.schedule}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {agents.length === 0 && <p className="mt-3 text-sm text-slate-400">Nessun agente o routine sviluppato. Segnali dalla scheda Collegamenti (tipo «agente» o «ricorrente»).</p>}
        </section>
      )}

      {/* 3. cosa fare */}
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Da fare adesso</h2>
        <p className="mb-3 text-sm text-slate-500">In ordine di importanza, in base ai dati inseriti.</p>
        {todo.length === 0 ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Nessuna azione urgente con i dati attuali.</p>
        ) : (
          <ol className="space-y-3">
            {todo.map((a, i) => (
              <li key={a.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.text}</div>
                  <div className="text-sm text-slate-500">{a.detail}</div>
                </div>
                <button className="btn shrink-0 !px-3 !py-1.5 text-xs" onClick={() => onGo(a.tab)}>{a.cta}</button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 4. attenzione */}
      {(riskFlags.length > 0 || (issues.length > 0 && grave === 0)) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">Da tenere d'occhio</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
            {riskFlags.map((a) => (
              <li key={a.id}>
                <b>{a.name}</b>: rischio alto con potenziale di automazione.{" "}
                {a.humanControl ? <span className="text-amber-800">Controllo previsto: {a.humanControl.replace(/[.]$/, "")}.</span> : <b>Nessun controllo umano definito.</b>}
              </li>
            ))}
            {issues.length > 0 && grave === 0 && (
              <li>
                {issues.length} controlli aperti sui dati, nessuno grave.{" "}
                <button className="font-medium underline" onClick={() => onGo("Controlli")}>Apri i controlli</button>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* dettagli */}
      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Dettagli: blocker, quick win e micro-tool</summary>
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Blocker che pesano di più</h3>
            <ul className="space-y-1.5 text-sm">
              {topBlockers.length === 0 && <li className="text-slate-400">Nessun blocker definito</li>}
              {topBlockers.map((r) => (
                <li key={r.blocker.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${r.blocker.severity === "alta" ? "bg-rose-500" : r.blocker.severity === "media" ? "bg-amber-500" : "bg-slate-400"}`} />
                  <span className="min-w-0 flex-1">{r.blocker.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-700">{fmt(r.unlock)} h</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Quick win</h3>
            <ul className="space-y-1.5 text-sm">
              {quickWins.length === 0 && <li className="text-slate-400">Nessuna quick win con i dati attuali</li>}
              {quickWins.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">{a.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-700">+{fmt(uncaptured(a), 1)} h</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Micro-tool</h3>
            <p className="text-sm text-slate-600">{m.toolsLive} in uso, {m.toolUsers} utenti attivi, {eur(m.toolCost)}/mese di costo.</p>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600" htmlFor="hourly-cost">
              Costo orario medio ipotizzato
              <input id="hourly-cost" type="number" min={0} className="input !w-20" value={state.settings.hourlyCost}
                onChange={(e) => onSettings({ hourlyCost: Math.max(0, +e.target.value) })} />
              €/h
            </label>
          </div>
        </div>
      </details>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Glossario</summary>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.values(GLOSSARY).map((g) => (
            <div key={g.label}>
              <dt className="text-sm font-semibold">{g.label}</dt>
              <dd className="text-sm text-slate-600">{g.def}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
