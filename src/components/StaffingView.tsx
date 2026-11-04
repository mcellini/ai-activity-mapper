import { useState } from "react";
import type { AppState, Client, ClientStatus, Person, Seniority, TeamId } from "@/types";
import { SENIORITIES, TEAMS, fmt, sum, uid } from "@/lib/calc";
import {
  SCENARIOS, clientImpacts, computeScenario, teamReduction, totals, type Scenario,
} from "@/lib/staffing";
import ConfirmButton from "./ConfirmButton";
import { Term } from "./Term";

interface Props {
  state: AppState;
  onClients: (next: Client[]) => void;
  onPeople: (next: Person[]) => void;
  onSettings: (patch: Partial<AppState["settings"]>) => void;
}

/** Colore heatmap: rosso = mancano persone, verde = capacità in eccesso */
function heat(v: number): React.CSSProperties {
  const a = Math.min(0.75, (Math.abs(v) / 2.5) * 0.75);
  return { background: v >= 0 ? `rgba(225,29,72,${a})` : `rgba(22,163,74,${a})`, color: a > 0.45 ? "#fff" : undefined };
}
const sgn = (v: number) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v), 1)}`;

const STATUS_LABEL: Record<ClientStatus, string> = { attivo: "Attivo", gara: "Gara", prospect: "Prospect" };

export default function StaffingView({ state, onClients, onPeople, onSettings }: Props) {
  const [capture, setCapture] = useState(50);
  const [detail, setDetail] = useState<Scenario>("base");

  const res = Object.fromEntries(
    SCENARIOS.map((s) => [s.id, computeScenario(state, s.id, capture)])
  ) as Record<Scenario, ReturnType<typeof computeScenario>>;
  const tot = Object.fromEntries(SCENARIOS.map((s) => [s.id, totals(res[s.id])])) as Record<Scenario, ReturnType<typeof totals>>;

  const d = res[detail];
  const maxH = Math.max(1, ...TEAMS.flatMap((t) => [d[t.id].capacity, d[t.id].demand]));

  const patchClient = (id: string, p: Partial<Client>) => onClients(state.clients.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const patchHours = (c: Client, t: TeamId, v: number) => patchClient(c.id, { hoursByTeam: { ...c.hoursByTeam, [t]: Math.max(0, v) } });
  const patchPerson = (id: string, p: Partial<Person>) => onPeople(state.people.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const addClient = () =>
    onClients([...state.clients, {
      id: uid(), name: "Nuovo cliente", status: "gara", probability: 50,
      hoursByTeam: { seo: 0, content: 0, pr: 0, social: 0, design: 0 },
    }]);
  const addPerson = () =>
    onPeople([...state.people, { id: uid(), name: "Nuova persona", teamId: "seo", seniority: "mid", hours: 40, aiShare: null }]);

  const impacts = clientImpacts(state, capture);

  const adoption = TEAMS.map((t) => {
    const ps = state.people.filter((p) => p.teamId === t.id);
    const known = ps.filter((p) => p.aiShare !== null);
    const hrs = sum(known.map((p) => p.hours));
    const avg = hrs > 0 ? sum(known.map((p) => p.hours * (p.aiShare as number))) / hrs : known.length ? sum(known.map((p) => p.aiShare as number)) / known.length : 0;
    const vals = known.map((p) => p.aiShare as number);
    return { id: t.id, name: t.name, color: t.color, total: ps.length, known: known.length, avg, min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0 };
  });
  const knownAll = state.people.filter((p) => p.aiShare !== null);
  const hrsAll = sum(knownAll.map((p) => p.hours));
  const adoptionAll = knownAll.length === 0 ? null : hrsAll > 0 ? sum(knownAll.map((p) => p.hours * (p.aiShare as number))) / hrsAll : sum(knownAll.map((p) => p.aiShare as number)) / knownAll.length;
  const wc = tot.worst, bc = tot.best;
  const coverBest = bc.people > 0 ? ((bc.people - bc.peopleAI) / bc.people) * 100 : 0;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-end gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Staffing 2027: persone mancanti o in eccesso</h2>
            <p className="text-sm text-slate-500">
              Domanda dei clienti per scenario contro la capacità del team, con e senza AI. Rosso: mancano persone. Verde: capacità in eccesso.
            </p>
          </div>
          <label className="w-64 text-sm" htmlFor="capture">
            <span className="label"><Term k="cattura">Cattura AI</Term>: {capture}%</span>
            <input id="capture" type="range" min={0} max={100} step={10} className="w-full" value={capture} onChange={(e) => setCapture(+e.target.value)} />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-center text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th rowSpan={2} className="text-left">Team</th>
                {SCENARIOS.map((s) => <th key={s.id} colSpan={2} title={s.desc}>{s.label}</th>)}
              </tr>
              <tr className="text-[10px] text-slate-400">
                {SCENARIOS.flatMap((s) => [<th key={s.id + "a"}>senza AI</th>, <th key={s.id + "b"}>con AI</th>])}
              </tr>
            </thead>
            <tbody>
              {TEAMS.map((t) => (
                <tr key={t.id}>
                  <td className="text-left font-medium">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />{t.name}
                  </td>
                  {SCENARIOS.flatMap((s) => [
                    <td key={s.id + "a"} className="rounded py-1.5" style={heat(res[s.id][t.id].people)}>{sgn(res[s.id][t.id].people)}</td>,
                    <td key={s.id + "b"} className="rounded py-1.5" style={heat(res[s.id][t.id].peopleAI)}>{sgn(res[s.id][t.id].peopleAI)}</td>,
                  ])}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="text-left">Totale persone</td>
                {SCENARIOS.flatMap((s) => [
                  <td key={s.id + "a"} className="rounded py-1.5" style={heat(tot[s.id].people / 2)}>{sgn(tot[s.id].people)}</td>,
                  <td key={s.id + "b"} className="rounded py-1.5" style={heat(tot[s.id].peopleAI / 2)}>{sgn(tot[s.id].peopleAI)}</td>,
                ])}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Nel best case servirebbero {sgn(bc.people)} persone senza AI e {sgn(bc.peopleAI)} con una cattura del {capture}%: l'AI copre circa il {fmt(Math.max(0, coverBest))}% del fabbisogno.
          Nel worst case il quadro è {sgn(wc.peopleAI)} persone con AI, cioè {wc.peopleAI < 0 ? "capacità da ricollocare o da riempire con nuovi servizi" : "ancora scoperto"}.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Conversione in persone sulle ore medie per persona del team. Il valore dell'AI per team è il rapporto tra ore liberate e baseline delle attività mappate.
        </p>
      </section>

      {impacts.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">Quanto pesa ogni cliente</h2>
          <p className="mb-3 text-sm text-slate-500">
            Persone equivalenti richieste da ciascun cliente. Il contributo atteso è la probabilità per le persone con AI: dice chi sposta di più lo staffing.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th>Cliente</th><th>Stato</th><th className="text-right">Prob.</th>
                  <th className="text-right">Persone senza AI</th><th className="text-right">Persone con AI</th><th className="text-right">Contributo atteso</th>
                </tr>
              </thead>
              <tbody>
                {impacts.map((i) => (
                  <tr key={i.client.id} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium">{i.client.name}</td>
                    <td>{STATUS_LABEL[i.client.status]}</td>
                    <td className="text-right">{fmt(i.client.probability)}%</td>
                    <td className="text-right">{fmt(i.people, 1)}</td>
                    <td className="text-right">{fmt(i.peopleAI, 1)}</td>
                    <td className="text-right font-semibold">{fmt(i.expected, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Domanda contro capacità</h2>
          <select id="detail-scenario" className="input !w-auto" value={detail} onChange={(e) => setDetail(e.target.value as Scenario)}>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <span className="text-xs text-slate-500">{SCENARIOS.find((s) => s.id === detail)?.desc}</span>
        </div>
        <div className="space-y-3">
          {TEAMS.map((t) => {
            const c = d[t.id];
            return (
              <div key={t.id} className="grid grid-cols-[6.5rem_1fr_8rem] items-center gap-3 text-sm">
                <div className="truncate font-medium">{t.name}</div>
                <div className="relative space-y-1">
                  <div className="h-3 rounded bg-slate-300" style={{ width: `${(c.demand / maxH) * 100}%` }} title={`Domanda senza AI ${fmt(c.demand)} h`} />
                  <div className="h-3 rounded" style={{ width: `${(c.demandAI / maxH) * 100}%`, background: t.color }} title={`Domanda con AI ${fmt(c.demandAI)} h`} />
                  <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: `${(c.capacity / maxH) * 100}%` }} title={`Capacità ${fmt(c.capacity)} h`} />
                </div>
                <div className="text-right text-xs tabular-nums text-slate-600">
                  {fmt(c.demandAI)} / {fmt(c.capacity)} h
                  <div className="text-[10px] text-slate-400">AI libera {fmt(teamReduction(state.activities, t.id) * 100)}%</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />Domanda senza AI</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />Domanda con AI</span>
          <span><span className="mr-1 inline-block h-3 w-0.5 bg-slate-900 align-middle" /> Capacità del team</span>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Clienti</h2>
          <label className="flex items-center gap-2 text-xs text-slate-600" htmlFor="worst-th">
            Worst case: restano i clienti con probabilità ≥
            <input id="worst-th" type="number" min={0} max={100} className="input !w-16" value={state.settings.worstThreshold} onChange={(e) => onSettings({ worstThreshold: Math.max(0, Math.min(100, +e.target.value)) })} />%
          </label>
          <div className="flex-1" />
          <button className="btn-primary" onClick={addClient}>+ Cliente</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Cliente</th><th>Stato</th><th>Prob. %</th>
                {TEAMS.map((t) => <th key={t.id} className="text-right">{t.name.split(" ")[0]} h</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {state.clients.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2"><input id={`cn-${c.id}`} className="input" value={c.name} onChange={(e) => patchClient(c.id, { name: e.target.value })} /></td>
                  <td className="pr-2">
                    <select id={`cs-${c.id}`} className="input" value={c.status} onChange={(e) => patchClient(c.id, { status: e.target.value as ClientStatus })}>
                      {(Object.keys(STATUS_LABEL) as ClientStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="pr-2"><input id={`cp-${c.id}`} type="number" min={0} max={100} className="input !w-16" value={c.probability} onChange={(e) => patchClient(c.id, { probability: Math.max(0, Math.min(100, +e.target.value)) })} /></td>
                  {TEAMS.map((t) => (
                    <td key={t.id} className="pr-2"><input id={`ch-${c.id}-${t.id}`} type="number" min={0} className="input !w-16 text-right" value={c.hoursByTeam[t.id] ?? 0} onChange={(e) => patchHours(c, t.id, +e.target.value)} /></td>
                  ))}
                  <td><ConfirmButton className="btn !px-2 text-rose-600" onConfirm={() => onClients(state.clients.filter((x) => x.id !== c.id))}>×</ConfirmButton></td>
                </tr>
              ))}
              {state.clients.length === 0 && <tr><td colSpan={9} className="py-4 text-center text-slate-400">Nessun cliente. Aggiungi quelli attivi e quelli in ballo per il 2027.</td></tr>}
            </tbody>
            {state.clients.length > 0 && (
              <tfoot>
                <tr className="text-xs text-slate-500">
                  <td className="pt-2" colSpan={3}>Domanda baseline totale (ore/mese, tutti i clienti)</td>
                  {TEAMS.map((t) => <td key={t.id} className="pt-2 pr-2 text-right tabular-nums">{fmt(sum(state.clients.map((c) => c.hoursByTeam[t.id] ?? 0)))}</td>)}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Le ore sono la domanda baseline (senza AI) di ciascun cliente per team, non per singola attività.</p>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-semibold">Persone e capacità</h2>
          <div className="flex-1" />
          <button className="btn-primary" onClick={addPerson}>+ Persona</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Nome o ruolo</th><th>Team</th><th>Seniority</th><th>Ore/mese su attività mappate</th><th>Uso AI % del tempo</th><th />
              </tr>
            </thead>
            <tbody>
              {state.people.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2"><input id={`pn-${p.id}`} className="input" value={p.name} onChange={(e) => patchPerson(p.id, { name: e.target.value })} /></td>
                  <td className="pr-2">
                    <select id={`pt-${p.id}`} className="input" value={p.teamId} onChange={(e) => patchPerson(p.id, { teamId: e.target.value as TeamId })}>
                      {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td className="pr-2">
                    <select id={`ps-${p.id}`} className="input" value={p.seniority} onChange={(e) => patchPerson(p.id, { seniority: e.target.value as Seniority })}>
                      {SENIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="pr-2"><input id={`ph-${p.id}`} type="number" min={0} className="input !w-24" value={p.hours} onChange={(e) => patchPerson(p.id, { hours: Math.max(0, +e.target.value) })} /></td>
                  <td className="pr-2">
                    <input id={`pa-${p.id}`} type="number" min={0} max={100} placeholder="n.d." className="input !w-20" value={p.aiShare ?? ""}
                      onChange={(e) => patchPerson(p.id, { aiShare: e.target.value === "" ? null : Math.max(0, Math.min(100, +e.target.value)) })} />
                  </td>
                  <td><ConfirmButton className="btn !px-2 text-rose-600" onConfirm={() => onPeople(state.people.filter((x) => x.id !== p.id))}>×</ConfirmButton></td>
                </tr>
              ))}
              {state.people.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-400">Nessuna persona inserita.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
          {TEAMS.map((t) => {
            const ps = state.people.filter((p) => p.teamId === t.id);
            const mix = SENIORITIES.map((s) => ({ s, n: ps.filter((p) => p.seniority === s).length })).filter((x) => x.n > 0);
            return (
              <div key={t.id} className="rounded-lg bg-slate-50 p-2">
                <div className="font-semibold" style={{ color: t.color }}>{t.name}</div>
                <div className="text-slate-500">{ps.length} persone, {fmt(sum(ps.map((p) => p.hours)))} h</div>
                <div className="text-slate-500">{mix.map((x) => `${x.n} ${x.s}`).join(", ") || "nessuna"}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Adozione dell'AI nel team</h2>
            <p className="text-sm text-slate-500">
              Quanto del proprio tempo ciascuno lavora davvero con l'AI. La copertura cambia molto da persona a persona: qui si legge per team, senza nomi.
            </p>
          </div>
          <button className="btn" disabled={adoptionAll === null} onClick={() => adoptionAll !== null && setCapture(Math.round(adoptionAll / 10) * 10)}>
            Usa l'adozione media come cattura{adoptionAll !== null ? ` (${fmt(adoptionAll)}%)` : ""}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {adoption.map((r) => (
            <div key={r.id} className="grid grid-cols-[6.5rem_1fr_11rem] items-center gap-3 text-sm">
              <div className="truncate font-medium">{r.name}</div>
              <div className="relative h-4 rounded bg-slate-100">
                {r.known > 0 && (
                  <>
                    <div className="absolute inset-y-0 rounded" style={{ left: `${r.min}%`, width: `${Math.max(1, r.max - r.min)}%`, background: r.color, opacity: 0.3 }} />
                    <div className="absolute inset-y-0 w-1 rounded bg-slate-900" style={{ left: `calc(${r.avg}% - 2px)` }} title={`Media ${fmt(r.avg)}%`} />
                  </>
                )}
              </div>
              <div className="text-right text-xs tabular-nums text-slate-600">
                {r.known > 0 ? <>media <span className="font-semibold">{fmt(r.avg)}%</span>, da {fmt(r.min)} a {fmt(r.max)}%</> : <span className="text-slate-400">non rilevata</span>}
                {r.known > 0 && r.known < r.total && <span className="text-slate-400"> ({r.known}/{r.total})</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">La media è pesata sulle ore di ciascuno. Un divario ampio dentro un team indica che la cattura reale può salire con la formazione, senza nuovi tool.</p>
      </section>
    </div>
  );
}
