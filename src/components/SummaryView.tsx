import type { Activity, Destination } from "@/types";
import {
  AREAS, DESTINATIONS, TEAMS, WORK_TYPES, fmt, sum, uncaptured, teamById,
} from "@/lib/calc";

/** Fasce di frequenza: dove pesa di più il lavoro, contano le ore ma anche quante volte si ripete */
const FREQ_BANDS: { id: string; label: string; test: (r: number) => boolean }[] = [
  { id: "g", label: "Ogni giorno", test: (r) => r >= 15 },
  { id: "s", label: "Ogni settimana", test: (r) => r >= 3 && r < 15 },
  { id: "m", label: "Ogni mese", test: (r) => r >= 0.7 && r < 3 },
  { id: "r", label: "Raramente (trimestrale o annuale)", test: (r) => r > 0 && r < 0.7 },
  { id: "n", label: "Frequenza non indicata", test: (r) => r === 0 },
];

export default function SummaryView({ activities: all, onChange }: { activities: Activity[]; onChange: (next: Activity[]) => void }) {
  const setDest = (ids: string[], destination: Destination) =>
    onChange(all.map((a) => (ids.includes(a.id) ? { ...a, destination } : a)));
  // R&D e formazione sono investimento: restano fuori dal calcolo del risparmio e hanno una sezione a parte
  const activities = all.filter((a) => a.area !== "rnd");
  const areaRows = AREAS.map((ar) => {
    const items = all.filter((a) => a.area === ar.id);
    return {
      ...ar,
      n: items.length,
      manual: sum(items.map((a) => a.hoursManual)),
      freed: sum(items.map((a) => a.hoursFreed)),
      reinv: sum(items.map((a) => a.hoursReinvested)),
    };
  }).filter((r) => r.n > 0);
  const freqRows = FREQ_BANDS.map((b) => {
    const items = activities.filter((a) => b.test(a.runsPerMonth));
    return {
      ...b,
      n: items.length,
      manual: sum(items.map((a) => a.hoursManual)),
      freed: sum(items.map((a) => a.hoursFreed)),
      reinv: sum(items.map((a) => a.hoursReinvested)),
    };
  }).filter((r) => r.n > 0);
  const rows = WORK_TYPES.map((w) => {
    const items = activities.filter((a) => a.workType === w.id);
    return {
      id: w.id,
      label: w.label,
      n: items.length,
      manual: sum(items.map((a) => a.hoursManual)),
      freed: sum(items.map((a) => a.hoursFreed)),
      reinv: sum(items.map((a) => a.hoursReinvested)),
    };
  }).filter((r) => r.n > 0);
  const maxManual = Math.max(1, ...rows.map((r) => r.manual));

  const totalFreed = sum(activities.map((a) => a.hoursFreed));
  const totalReinv = sum(activities.map((a) => a.hoursReinvested));
  const byDest = DESTINATIONS.map((d) => ({
    ...d,
    hours: sum(activities.filter((a) => a.destination === d.id).map((a) => a.hoursFreed)),
  }));
  const unallocated = activities
    .filter((a) => a.destination === "non_allocata" && a.hoursFreed > 0)
    .sort((x, y) => y.hoursFreed - x.hoursFreed);

  const teamRows = TEAMS.map((t) => {
    const items = activities.filter((a) => a.teamId === t.id);
    return {
      ...t,
      manual: sum(items.map((a) => a.hoursManual)),
      freed: sum(items.map((a) => a.hoursFreed)),
      reinv: sum(items.map((a) => a.hoursReinvested)),
      left: sum(items.map(uncaptured)),
    };
  });

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Dove si genera il risparmio</h2>
        <p className="mb-4 text-sm text-slate-500">
          Per tipo di lavoro: la barra grigia sono le ore di oggi, in verde quelle liberate dall'automazione, in azzurro quelle potenziate dall'augmentation.
        </p>
        <div className="space-y-3">
          {rows.map((r) => {
            const w = (r.manual / maxManual) * 100;
            return (
              <div key={r.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[14rem_1fr_9rem]">
                <div className="min-w-0 truncate font-medium" title={r.label}>{r.label}</div>
                <div className="h-5 rounded bg-slate-100" style={{ width: `${w}%`, minWidth: "2rem" }}>
                  <div className="flex h-full overflow-hidden rounded">
                    <div className="bg-emerald-500" style={{ width: `${r.manual ? (r.freed / r.manual) * 100 : 0}%` }} />
                    <div className="bg-sky-500" style={{ width: `${r.manual ? (r.reinv / r.manual) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs tabular-nums text-slate-600">
                  <span className="font-semibold text-emerald-700">−{fmt(r.freed)}</span> / <span className="font-semibold text-sky-700">{fmt(r.reinv)}</span> su {fmt(r.manual)} h
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-slate-500">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Liberate (automation)</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />Potenziate (augmentation)</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-200" />Ore di oggi</span>
        </div>
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-semibold">Quanto spesso si ripete</h2>
        <p className="mb-3 text-sm text-slate-500">
          Un'attività giornaliera da 1 ora e una annuale da 12 ore pesano in modo molto diverso sul tempo e sull'automazione. Qui le ore sono raggruppate per frequenza.
        </p>
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2">Frequenza</th><th className="py-2 text-right">Attività</th><th className="py-2 text-right">Ore oggi</th>
              <th className="py-2 text-right">Liberate</th><th className="py-2 text-right">Potenziate</th><th className="py-2 text-right">% liberata</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {freqRows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right">{r.n}</td>
                <td className="py-2 text-right">{fmt(r.manual)}</td>
                <td className="py-2 text-right font-medium text-emerald-700">{fmt(r.freed)}</td>
                <td className="py-2 text-right font-medium text-sky-700">{fmt(r.reinv)}</td>
                <td className="py-2 text-right">{fmt(r.manual ? (r.freed / r.manual) * 100 : 0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {freqRows.some((r) => r.id === "n") && <p className="mt-2 text-xs text-slate-400">Compila la frequenza dalla scheda Teams: apri «Modifica» sull'attività.</p>}
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-semibold">Per area di lavoro</h2>
        <p className="mb-3 text-sm text-slate-500">
          Delivery ricorrente, gare e biz dev hanno dinamiche diverse. R&D e formazione è tempo investito per imparare e costruire tool: non è risparmio da recuperare.
        </p>
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2">Area</th><th className="py-2 text-right">Attività</th><th className="py-2 text-right">Ore oggi</th>
              <th className="py-2 text-right">Liberate</th><th className="py-2 text-right">Potenziate</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {areaRows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right">{r.n}</td>
                <td className="py-2 text-right">{fmt(r.manual)}</td>
                <td className="py-2 text-right font-medium text-emerald-700">{r.id === "rnd" ? "n.a." : fmt(r.freed)}</td>
                <td className="py-2 text-right font-medium text-sky-700">{r.id === "rnd" ? "n.a." : fmt(r.reinv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Dove vengono reinvestite le ore liberate</h2>
        <p className="mb-4 text-sm text-slate-500">
          {fmt(totalFreed)} h/mese liberate, {fmt(totalReinv)} h/mese potenziate sulle stesse attività. Ogni ora liberata viene reinvestita da qualche parte: qui si vede dove.
        </p>
        <div className="flex h-7 w-full overflow-hidden rounded-md bg-slate-100">
          {byDest.map((d) => (
            <div key={d.id} style={{ width: `${totalFreed ? (d.hours / totalFreed) * 100 : 0}%`, background: d.color }} title={`${d.label}: ${d.hours} h`} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          {byDest.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
              <span className="font-semibold tabular-nums">{fmt(d.hours)} h</span>
            </div>
          ))}
        </div>
        {unallocated.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="font-semibold text-amber-800">
              {fmt(sum(unallocated.map((a) => a.hoursFreed)))} h/mese liberate da classificare
            </div>
            <p className="text-xs text-amber-800">Le ore liberate non restano ferme: il team le reinveste. Indica dove, così il risparmio non si legge come taglio di risorse.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-amber-900" htmlFor="bulk-dest">Assegna a tutte:</label>
              <select id="bulk-dest" className="input !w-auto" value="" onChange={(e) => e.target.value && setDest(unallocated.map((a) => a.id), e.target.value as Destination)}>
                <option value="">Scegli una destinazione</option>
                {DESTINATIONS.filter((d) => d.id !== "non_allocata").map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <ul className="mt-2 space-y-1 text-amber-900">
              {unallocated.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">{a.name} <span className="text-amber-700">({teamById(a.teamId).name})</span>: {fmt(a.hoursFreed)} h</span>
                  <select aria-label={`Destinazione di ${a.name}`} className="input !w-auto" value={a.destination} onChange={(e) => setDest([a.id], e.target.value as Destination)}>
                    {DESTINATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="mb-3 text-lg font-semibold">Per team</h2>
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2">Team</th>
              <th className="py-2 text-right">Ore oggi</th>
              <th className="py-2 text-right">Liberate</th>
              <th className="py-2 text-right">Potenziate</th>
              <th className="py-2 text-right">Potenziale residuo</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {teamRows.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="py-2">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </td>
                <td className="py-2 text-right">{fmt(t.manual)}</td>
                <td className="py-2 text-right font-medium text-emerald-700">{fmt(t.freed)}</td>
                <td className="py-2 text-right font-medium text-sky-700">{fmt(t.reinv)}</td>
                <td className="py-2 text-right">{fmt(t.left, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
