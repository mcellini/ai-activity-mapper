import type { Activity, Blocker } from "@/types";
import { COMPLEXITY_LABEL, PHASE_ORDER, fmt, median, phase, teamById, uncaptured } from "@/lib/calc";

const PHASE_STYLE: Record<string, { bg: string; desc: string }> = {
  "Quick win": { bg: "bg-emerald-50 border-emerald-200", desc: "Molto potenziale residuo, pochi ostacoli: partire da qui" },
  Strategico: { bg: "bg-indigo-50 border-indigo-200", desc: "Molto potenziale residuo ma con blocker o complessità alta: da pianificare" },
  Opportunistico: { bg: "bg-amber-50 border-amber-200", desc: "Poco potenziale, ostacoli bassi: se c'è capacità" },
  "Da rivalutare": { bg: "bg-slate-50 border-slate-200", desc: "Poco potenziale e ostacoli alti: non prioritario" },
};

export default function RoadmapView({ activities, blockers }: { activities: Activity[]; blockers: Blocker[] }) {
  const med = median(activities.map(uncaptured));
  const byId = new Map(activities.map((a) => [a.id, a]));
  const rows = activities.map((a) => {
    const n = blockers.filter((b) => b.activityIds.includes(a.id)).length;
    return { a, n, p: phase(a, med, n) };
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Impatto = ore/mese ancora catturabili (mediana {fmt(med, 1)} h). Sforzo = complessità più numero di blocker collegati.
        Dove un'attività dipende da un'altra, l'ordine di avvio è indicato con «dopo».
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {PHASE_ORDER.map((p) => {
          const items = rows.filter((r) => r.p === p).sort((x, y) => uncaptured(y.a) - uncaptured(x.a));
          const total = items.reduce((s, r) => s + uncaptured(r.a), 0);
          return (
            <section key={p} className={`rounded-xl border p-4 ${PHASE_STYLE[p].bg}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{p}</h3>
                <span className="text-sm font-semibold">+{fmt(total, 1)} h/mese</span>
              </div>
              <p className="mb-3 text-xs text-slate-500">{PHASE_STYLE[p].desc}</p>
              <ul className="space-y-2">
                {items.length === 0 && <li className="text-xs text-slate-400">Nessuna attività</li>}
                {items.map(({ a, n }) => {
                  const deps = a.dependsOn.map((id) => byId.get(id)?.name).filter(Boolean);
                  return (
                    <li key={a.id} className="rounded-lg bg-white p-2 text-sm shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: teamById(a.teamId).color }} />
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        {n > 0 && <span className="rounded-full bg-rose-50 px-1.5 text-[11px] text-rose-700">{n} blocker</span>}
                        <span className="text-[11px] text-slate-500">{COMPLEXITY_LABEL[a.complexity]}</span>
                        <span className="w-16 text-right text-xs font-semibold text-emerald-700">+{fmt(uncaptured(a), 1)} h</span>
                      </div>
                      {deps.length > 0 && <div className="mt-1 pl-5 text-[11px] text-slate-500">dopo: {deps.join(", ")}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
