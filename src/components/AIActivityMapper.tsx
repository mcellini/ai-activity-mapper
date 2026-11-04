import { useEffect, useMemo, useRef, useState } from "react";
import type { Activity, AppState, Snapshot, SyncStatus } from "@/types";
import { fmt, uid } from "@/lib/calc";
import { metrics } from "@/lib/metrics";
import { migrate } from "@/lib/migrate";
import {
  exportCsv, exportJson, loadLocal, loadSheetsUrl, loadSnapshots, pullFromSheets,
  pushToSheets, saveLocal, saveSheetsUrl, saveSnapshots,
} from "@/lib/storage";
import ExecutiveView from "./ExecutiveView";
import SummaryView from "./SummaryView";
import TeamsView from "./TeamsView";
import WorkflowsView from "./WorkflowsView";
import MatrixView from "./MatrixView";
import RoadmapView from "./RoadmapView";
import LinksView from "./LinksView";
import MeasureView from "./MeasureView";
import StaffingView from "./StaffingView";
import HistoryView from "./HistoryView";
import SyncPanel from "./SyncPanel";
import QualityView from "./QualityView";
import TableView from "./TableView";
import ToBeView from "./ToBeView";
import AgentsView from "./AgentsView";
import ImportCsvModal from "./ImportCsvModal";
import { runChecks } from "@/lib/quality";

const TABS = [
  "Executive", "Riepilogo", "Teams", "Workflows", "Matrix", "Roadmap",
  "Collegamenti", "Misurazione", "Staffing", "AS-IS / TO-BE", "Agenti", "Tabella", "Controlli", "Storico",
] as const;
type Tab = (typeof TABS)[number];

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: "Solo locale",
  idle: "Sheets collegato",
  saving: "Salvataggio…",
  saved: "Salvato su Sheets",
  error: "Errore sync",
};

export default function AIActivityMapper() {
  const [state, setState] = useState<AppState>(loadLocal);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(loadSnapshots);
  const [tab, setTab] = useState<Tab>("Executive");
  const [sheetsUrl, setSheetsUrl] = useState(loadSheetsUrl);
  const [status, setStatus] = useState<SyncStatus>(sheetsUrl ? "idle" : "off");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSync, setShowSync] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRun = useRef(true);

  const commit = (patch: Partial<AppState>) =>
    setState((s) => ({ ...s, ...patch, updatedAt: new Date().toISOString() }));

  /** updatedAt dello stato sul foglio all'ultimo allineamento: serve a capire se un collega ha salvato prima di noi */
  const base = useRef<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [conflict, setConflict] = useState<AppState | null>(null);

  const adopt = (remote: AppState) => {
    firstRun.current = true; // evita di rispedire subito ciò che abbiamo appena letto
    base.current = remote.updatedAt;
    setConflict(null);
    setState(remote);
    setStatus("idle");
    setError("");
  };

  // all'apertura con Sheets collegato: prima si legge il foglio, solo dopo si può scrivere
  useEffect(() => {
    if (!sheetsUrl) { setSynced(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const remote = await pullFromSheets(sheetsUrl);
        if (cancelled) return;
        if (remote) adopt(remote);
        else base.current = ""; // foglio vuoto: il primo salvataggio parte dai dati locali
        setSynced(true);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Errore");
      }
    })();
    return () => { cancelled = true; };
  }, [sheetsUrl]);

  // salvataggio locale immediato + sync su Sheets con debounce di 2s
  useEffect(() => {
    saveLocal(state);
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!sheetsUrl || !synced || conflict) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        // se nel frattempo un collega ha salvato, non si sovrascrive in silenzio
        const remote = await pullFromSheets(sheetsUrl);
        if (remote && remote.updatedAt !== base.current) {
          setConflict(remote);
          setStatus("error");
          setError("Un collega ha salvato modifiche più recenti");
          return;
        }
        await pushToSheets(sheetsUrl, state);
        base.current = state.updatedAt;
        setStatus("saved");
        setError("");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Errore");
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [state, sheetsUrl, synced, conflict]);

  const pull = async () => {
    if (!sheetsUrl) return;
    try {
      const remote = await pullFromSheets(sheetsUrl);
      if (remote) {
        adopt(remote);
        setSynced(true);
      } else {
        setError("Il foglio non contiene ancora dati");
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Errore");
    }
  };

  const overwrite = async () => {
    if (!sheetsUrl) return;
    try {
      await pushToSheets(sheetsUrl, state);
      base.current = state.updatedAt;
      setConflict(null);
      setStatus("saved");
      setError("");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Errore");
    }
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = migrate(JSON.parse(await f.text()));
      if (!parsed) throw new Error("versione non supportata");
      setState(parsed);
      setNotice("");
    } catch {
      setNotice("File JSON non valido o di una versione non supportata.");
    }
  };

  const saveSnap = (label: string) => {
    const next = [{ id: uid(), label, date: new Date().toISOString(), state }, ...snapshots].slice(0, 20);
    setSnapshots(next);
    saveSnapshots(next);
  };
  const deleteSnap = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    setSnapshots(next);
    saveSnapshots(next);
  };

  const kpi = useMemo(() => metrics(state), [state]);
  const issues = useMemo(() => runChecks(state), [state]);

  const importActivities = (items: Activity[], mode: "append" | "replace") => {
    if (mode === "append") {
      commit({ activities: [...state.activities, ...items] });
    } else {
      commit({
        activities: items,
        workflows: state.workflows,
        blockers: state.blockers.map((b) => ({ ...b, activityIds: [] })),
        microTools: state.microTools.map((t) => ({ ...t, activityIds: [] })),
        actuals: {},
      });
    }
    setShowCsv(false);
    setNotice("");
    setTab("Tabella");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">AI Activity Mapper</h1>
          <p className="text-sm text-slate-500">Cosa automatizzare, cosa aumentare, cosa lasciare umano.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status === "error" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABEL[status]}
        </span>
        <button className="btn" onClick={() => setShowSync(true)}>Sheets</button>
        <button className="btn" onClick={() => setShowCsv(true)}>Import CSV</button>
        <button className="btn" onClick={() => exportCsv(state)}>CSV</button>
        <button className="btn" onClick={() => exportJson(state)}>Export JSON</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </header>

      {conflict && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <div className="font-semibold">Un collega ha salvato modifiche più recenti sul foglio.</div>
          <p className="mt-1">Per non cancellare il suo lavoro, il tuo salvataggio è in pausa. Scegli cosa tenere.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => adopt(conflict)}>Carica le sue modifiche (perdo le mie)</button>
            <button className="btn" onClick={overwrite}>Sovrascrivi con le mie</button>
          </div>
        </div>
      )}

      {notice && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{notice}</div>}

      {tab !== "Executive" && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Attività mappate", fmt(kpi.n), ""],
            ["Ore/mese oggi", fmt(kpi.manual), ""],
            ["Ore liberate", `${fmt(kpi.freed)} (${fmt(kpi.freedPct)}%)`, "text-emerald-700"],
            ["Ore potenziate", fmt(kpi.reinv), "text-sky-700"],
            ["Liberate: da classificare", `${fmt(kpi.unalloc)} su ${fmt(kpi.freed)}`, kpi.unalloc > 0 ? "text-amber-600" : "text-emerald-700"],
          ].map(([l, v, c]) => (
            <div key={l} className="card p-4">
              <div className="label">{l}</div>
              <div className={`text-xl font-semibold ${c}`}>{v}</div>
            </div>
          ))}
        </section>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t}
            {t === "Controlli" && issues.length > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 text-[11px] text-rose-700">{issues.length}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "Executive" && (
        <ExecutiveView
          state={state}
          onGo={(t) => setTab(t as Tab)}
          onSettings={(p) => commit({ settings: { ...state.settings, ...p } })}
        />
      )}
      {tab === "Riepilogo" && <SummaryView activities={state.activities} onChange={(activities) => commit({ activities })} />}
      {tab === "Teams" && (
        <TeamsView
          activities={state.activities}
          blockers={state.blockers}
          microTools={state.microTools}
          onChange={(activities) => commit({ activities })}
          onChangeBlockers={(blockers) => commit({ blockers })}
          onChangeTools={(microTools) => commit({ microTools })}
        />
      )}
      {tab === "Workflows" && <WorkflowsView workflows={state.workflows} onChange={(workflows) => commit({ workflows })} />}
      {tab === "Matrix" && <MatrixView activities={state.activities} />}
      {tab === "Roadmap" && <RoadmapView activities={state.activities} blockers={state.blockers} />}
      {tab === "Collegamenti" && (
        <LinksView
          activities={state.activities}
          blockers={state.blockers}
          microTools={state.microTools}
          hourlyCost={state.settings.hourlyCost}
          onChangeBlockers={(blockers) => commit({ blockers })}
          onChangeTools={(microTools) => commit({ microTools })}
        />
      )}
      {tab === "Misurazione" && (
        <MeasureView
          state={state}
          onActuals={(actuals) => commit({ actuals })}
          onActivities={(activities) => commit({ activities })}
        />
      )}
      {tab === "Staffing" && (
        <StaffingView
          state={state}
          onClients={(clients) => commit({ clients })}
          onPeople={(people) => commit({ people })}
          onSettings={(p) => commit({ settings: { ...state.settings, ...p } })}
        />
      )}
      {tab === "AS-IS / TO-BE" && <ToBeView state={state} onGo={(t) => setTab(t as Tab)} />}
      {tab === "Agenti" && <AgentsView state={state} onGo={(t) => setTab(t as Tab)} />}
      {tab === "Tabella" && <TableView activities={state.activities} onChange={(activities) => commit({ activities })} />}
      {tab === "Controlli" && <QualityView issues={issues} onGo={(t) => setTab(t as Tab)} />}
      {tab === "Storico" && (
        <HistoryView
          state={state}
          snapshots={snapshots}
          onSave={saveSnap}
          onRestore={(s) => { setState(s.state); setNotice(""); }}
          onDelete={deleteSnap}
        />
      )}

      {showCsv && <ImportCsvModal existing={state.activities.length} onImport={importActivities} onClose={() => setShowCsv(false)} />}

      {showSync && (
        <SyncPanel
          url={sheetsUrl}
          status={status}
          error={error}
          onSaveUrl={(u) => { setSheetsUrl(u); saveSheetsUrl(u); setStatus(u ? "idle" : "off"); }}
          onPull={pull}
          onClose={() => setShowSync(false)}
        />
      )}
    </div>
  );
}
