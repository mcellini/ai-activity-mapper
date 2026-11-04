import type { Issue, IssueLevel } from "@/lib/quality";

const LEVELS: { id: IssueLevel; label: string; style: string; dot: string }[] = [
  { id: "alta", label: "Da correggere prima di mostrare i dati", style: "border-rose-200 bg-rose-50", dot: "bg-rose-500" },
  { id: "media", label: "Da sistemare", style: "border-amber-200 bg-amber-50", dot: "bg-amber-500" },
  { id: "bassa", label: "Miglioramenti", style: "border-slate-200 bg-slate-50", dot: "bg-slate-400" },
];

export default function QualityView({ issues, onGo }: { issues: Issue[]; onGo: (tab: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Controlli sui dati</h2>
        <p className="text-sm text-slate-500">
          Incoerenze e buchi che un lettore attento troverebbe subito. Si ricalcolano a ogni modifica.
        </p>
      </div>
      {issues.length === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Nessun problema rilevato.
        </div>
      )}
      {LEVELS.map((lv) => {
        const items = issues.filter((i) => i.level === lv.id);
        if (!items.length) return null;
        return (
          <section key={lv.id} className={`rounded-xl border p-4 ${lv.style}`}>
            <h3 className="mb-2 font-semibold">{lv.label} ({items.length})</h3>
            <ul className="space-y-1.5">
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${lv.dot}`} />
                  <span className="min-w-0 flex-1">{i.text}</span>
                  <button className="shrink-0 text-xs font-medium text-indigo-600" onClick={() => onGo(i.tab)}>Apri {i.tab}</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
