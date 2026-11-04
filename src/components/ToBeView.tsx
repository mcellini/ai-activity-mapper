import { useState } from "react";
import type { AppState } from "@/types";
import { eur, fmt, needLabel, teamById, toolKindLabel, TOOL_STATUS_LABEL, isToolLive } from "@/lib/calc";
import { toBe } from "@/lib/tobe";
import { download } from "@/lib/storage";

export default function ToBeView({ state, onGo }: { state: AppState; onGo: (tab: string) => void }) {
  const t = toBe(state);
  const [copied, setCopied] = useState("");
  const potential = t.asIs + t.unlockable + t.undefinedHours;
  const maxTeam = Math.max(1, ...t.teams.map((x) => x.asIs + x.unlockable + x.undefined));

  const listText = () =>
    [
      "Lista della spesa AI (ordinata per rientro)",
      ...t.rows.map((r) => {
        const b = r.blocker;
        const back = b.cost === 0 ? "senza costo" : r.payback ? `rientro ${fmt(r.payback, 1)} mesi` : "rientro n.d.";
        return `- ${b.name} [${needLabel(b.need)}]: ${b.cost ? eur(b.cost) : "nessun costo"}, sblocca fino a ${fmt(r.unlock, 1)} h/mese (${back}). Owner: ${b.owner || "da assegnare"}`;
      }),
      `Totale: ${eur(t.totalCost)} una tantum, sblocca ${fmt(t.uniqueUnlock, 1)} h/mese uniche`,
    ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(listText());
      setCopied("Copiata negli appunti");
    } catch {
      setCopied("Copia non riuscita: seleziona il testo e copialo a mano");
    }
  };

  const csv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Limite", "Cosa serve", "Costo una tantum", "Ore sbloccate al mese", "Valore al mese", "Rientro in mesi", "Owner", "Gravita"];
    const lines = t.rows.map((r) =>
      [r.blocker.name, needLabel(r.blocker.need), r.blocker.cost, r.unlock.toFixed(1), Math.round(r.valueMonth), r.payback ? r.payback.toFixed(1) : "", r.blocker.owner, r.blocker.severity].map(esc).join(",")
    );
    download("lista-della-spesa-ai.csv", [head.join(","), ...lines].join("\n"), "text/csv");
  };

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="label">Dove siamo e dove possiamo arrivare</div>
        <p className="max-w-3xl text-xl font-semibold leading-snug">
          Oggi catturiamo {fmt(t.asIs)} h/mese, il {fmt(potential ? (t.asIs / potential) * 100 : 0)}% del potenziale.
          Sbloccando i limiti censiti se ne aggiungono fino a {fmt(t.uniqueUnlock)}, con {eur(t.totalCost)} una tantum.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          {t.payback !== null
            ? <>Al costo orario ipotizzato vale {eur(t.valueMonth)} al mese, con un rientro complessivo in circa {fmt(t.payback, 1)} mesi. </>
            : null}
          Restano {fmt(t.undefinedHours)} h/mese di potenziale su attività senza limiti censiti: manca ancora un piano.
          La fotografia AS-IS conta solo i benefici già ottenuti, il TO-BE è potenziale.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">AS-IS e TO-BE per team</h2>
        <div className="mt-3 space-y-3">
          {t.teams.map((x) => {
            const total = x.asIs + x.unlockable + x.undefined;
            const w = (total / maxTeam) * 100;
            return (
              <div key={x.teamId} className="grid grid-cols-[6.5rem_1fr_9rem] items-center gap-3 text-sm">
                <div className="truncate font-medium">{teamById(x.teamId).name}</div>
                <div className="h-5 overflow-hidden rounded bg-slate-100" style={{ width: `${Math.max(w, 2)}%` }}>
                  <div className="flex h-full">
                    <div className="bg-emerald-500" style={{ width: `${total ? (x.asIs / total) * 100 : 0}%` }} title={`AS-IS ${fmt(x.asIs, 1)} h`} />
                    <div className="bg-indigo-500" style={{ width: `${total ? (x.unlockable / total) * 100 : 0}%` }} title={`Sbloccabile ${fmt(x.unlockable, 1)} h`} />
                    <div className="bg-slate-300" style={{ width: `${total ? (x.undefined / total) * 100 : 0}%` }} title={`Senza piano ${fmt(x.undefined, 1)} h`} />
                  </div>
                </div>
                <div className="text-right text-xs tabular-nums text-slate-600">
                  <span className="font-semibold text-emerald-700">{fmt(x.asIs)}</span> + <span className="font-semibold text-indigo-700">{fmt(x.unlockable)}</span> + {fmt(x.undefined)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />AS-IS: già ottenuto</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />Sbloccabile con la lista della spesa</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />Potenziale senza un piano</span>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Lista della spesa</h2>
          <span className="text-xs text-slate-500">Cosa serve per sbloccare ogni limite, ordinato per rientro. Utile per giustificare richieste di account, connettori e formazione.</span>
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={copy}>Copia testo</button>
            <button className="btn" onClick={csv}>CSV</button>
          </div>
        </div>
        {copied && <p className="mb-2 text-xs text-slate-500" role="status">{copied}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Limite</th><th>Cosa serve</th><th className="text-right">Costo</th>
                <th className="text-right">Sblocca h/mese</th><th className="text-right">Valore/mese</th><th className="text-right">Rientro</th><th className="pl-2">Owner</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {t.rows.map((r) => (
                <tr key={r.blocker.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{r.blocker.name}</td>
                  <td className="pr-2">{needLabel(r.blocker.need)}</td>
                  <td className="text-right">{r.blocker.cost ? eur(r.blocker.cost) : "–"}</td>
                  <td className="text-right font-medium text-emerald-700">{fmt(r.unlock, 1)}</td>
                  <td className="text-right">{eur(r.valueMonth)}</td>
                  <td className="text-right">{r.blocker.cost === 0 ? "senza costo" : r.payback ? `${fmt(r.payback, 1)} mesi` : "n.d."}</td>
                  <td className="pl-2">{r.blocker.owner || <span className="text-amber-700">da assegnare</span>}</td>
                </tr>
              ))}
              {t.rows.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-slate-400">Nessun limite censito. Aggiungili dalla scheda Collegamenti.</td></tr>}
            </tbody>
            {t.rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2" colSpan={2}>Totale (ore uniche)</td>
                  <td className="text-right">{eur(t.totalCost)}</td>
                  <td className="text-right text-emerald-700">{fmt(t.uniqueUnlock, 1)}</td>
                  <td className="text-right">{eur(t.valueMonth)}</td>
                  <td className="text-right">{t.payback ? `${fmt(t.payback, 1)} mesi` : "n.d."}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Più limiti possono insistere sulla stessa attività: il totale conta le ore una volta sola, quindi non coincide con la somma delle righe.
          Per modificare costi e bisogni vai in <button className="font-medium text-indigo-600" onClick={() => onGo("Collegamenti")}>Collegamenti</button>.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Automazioni ricorrenti e agenti</h2>
        <p className="mb-3 text-sm text-slate-500">
          Cosa gira già da solo e cosa è ancora scenario futuro. Gli agenti non ancora in uso restano potenziale da mappare, non risparmio.
        </p>
        {t.recurring.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna automazione ricorrente o agente censito. Imposta il tipo di un micro-tool dalla scheda Collegamenti.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {t.recurring.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{r.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{toolKindLabel(r.kind)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${isToolLive(r.status) ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                  {isToolLive(r.status) ? "Attivo oggi" : `Scenario futuro (${TOOL_STATUS_LABEL[r.status].toLowerCase()})`}
                </span>
                {r.schedule && <span className="text-xs text-slate-500">{r.schedule}</span>}
                <span className="ml-auto text-xs tabular-nums text-slate-600">tocca fino a {fmt(r.potential, 1)} h/mese di potenziale</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
