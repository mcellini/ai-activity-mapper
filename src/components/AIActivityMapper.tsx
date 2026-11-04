import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Activity, AppState, ServerSnapshot, Snapshot, SyncStatus, WorkTask } from "@/types";
import { fmt, uid } from "@/lib/calc";
import { metrics } from "@/lib/metrics";
import { contentKey } from "@/lib/merge";
import { migrate } from "@/lib/migrate";
import { validateState } from "@/lib/validate";
import { emptyState, sampleState } from "@/data/seed";
import {
  acceptState, exportCsv, exportJson, listServerSnapshots, loadLocal, loadSheetsUrl, loadSnapshots,
  pullFromSheets, pushToSheets, restoreServerSnapshot, saveLocal, saveSheetsUrl, saveSnapshots, snapshotOnSheets,
} from "@/lib/storage";
import { clearPassword, loadPassword, savePassword } from "@/lib/password";
import { newTask, syncHours } from "@/lib/subtasks";
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
import SyncPanel, { PasswordFields } from "./SyncPanel";
import QualityView from "./QualityView";
import TableView from "./TableView";
import ToBeView from "./ToBeView";
import AgentsView from "./AgentsView";
import ImportCsvModal from "./ImportCsvModal";
import ConfirmButton from "./ConfirmButton";
import { runChecks } from "@/lib/quality";

const TABS = [
  "Executive", "Riepilogo", "Teams", "Workflows", "Matrix", "Roadmap",
  "Collegamenti", "Misurazione", "Staffing", "AS-IS / TO-BE", "Agenti", "Tabella", "Controlli", "Storico",
] as const;
type Tab = (typeof TABS)[number];

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: "Solo locale",
  auth: "Password richiesta",
  loading: "Caricamento…",
  idle: "Sheets collegato",
  saving: "Salvataggio…",
  saved: "Salvato su Sheets",
  error: "Errore sync",
};

const tabDomId = (tab: string) => `vista-${tab.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
const clone = <T,>(value: T): T => structuredClone(value);

export default function AIActivityMapper() {
  const initialUrl = loadSheetsUrl();
  const [state, setState] = useState<AppState>(loadLocal);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(loadSnapshots);
  const [serverSnaps, setServerSnaps] = useState<ServerSnapshot[]>([]);
  const [tab, setTab] = useState<Tab>("Executive");
  const [sheetsUrl, setSheetsUrl] = useState(initialUrl);
  const storedPassword = loadPassword();
  const [password, setPassword] = useState(storedPassword.password);
  const [rememberPassword, setRememberPassword] = useState(storedPassword.remember);
  const [status, setStatus] = useState<SyncStatus>(initialUrl ? "auth" : "off");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSync, setShowSync] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [conflict, setConflict] = useState<AppState | null>(null);
  const [conflictNames, setConflictNames] = useState<string[]>([]);
  const [syncReady, setSyncReady] = useState(!initialUrl);
  const [revealed, setRevealed] = useState(!initialUrl);
  const [remoteRevision, setRemoteRevision] = useState(0);
  const [pullNonce, setPullNonce] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  const snapsRef = useRef(snapshots);
  const revealedRef = useRef(revealed);
  const passwordRef = useRef(password);
  const baseRevision = useRef(0);
  const baseState = useRef<AppState | null>(initialUrl ? null : clone(loadLocal()));
  const conflictRev = useRef(0);
  const editGen = useRef(0);
  stateRef.current = state;
  snapsRef.current = snapshots;
  revealedRef.current = revealed;
  passwordRef.current = password;

  const remember = (label: string) => {
    const snap: Snapshot = { id: uid(), label, date: new Date().toISOString(), state: clone(stateRef.current) };
    const next = [snap, ...snapsRef.current].slice(0, 20);
    snapsRef.current = next;
    setSnapshots(next);
    saveSnapshots(next);
  };

  const applyRemote = (next: AppState, revision: number, snapshotLabel: string | null) => {
    if (snapshotLabel && revealedRef.current && contentKey(stateRef.current) !== contentKey(next)) remember(snapshotLabel);
    baseRevision.current = revision;
    baseState.current = clone(next);
    setRemoteRevision(revision);
    setConflict(null);
    setConflictNames([]);
    setState(next);
    setSyncReady(true);
    setRevealed(true);
  };

  const onPassword = useCallback((next: string, remember: boolean) => {
    setPassword(next);
    setRememberPassword(remember);
    if (next) savePassword(next, remember);
    else clearPassword();
    setError("");
  }, []);

  const signOut = () => {
    clearPassword();
    setPassword("");
    setRememberPassword(false);
    if (sheetsUrl) {
      setSyncReady(false);
      setRevealed(false);
      setStatus("auth");
    }
  };

  useEffect(() => { saveLocal(state); }, [state]);

  useEffect(() => {
    if (!sheetsUrl) {
      setStatus("off");
      setSyncReady(true);
      setRevealed(true);
      setError("");
      if (!baseState.current) baseState.current = clone(stateRef.current);
      return;
    }
    if (!Boolean(password)) {
      setStatus("auth");
      setSyncReady(false);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setSyncReady(false);
    (async () => {
      try {
        const res = await pullFromSheets(sheetsUrl, password);
        if (cancelled) return;
        if (!res.ok) throw new Error(res.error || "Errore");
        if (res.empty) applyRemote(emptyState(), 0, "Prima del collegamento al foglio vuoto");
        else {
          const accepted = acceptState(res.state);
          if (!accepted) throw new Error("Il foglio contiene dati non validi");
          applyRemote(accepted, res.revision ?? 0, "Prima del caricamento dal foglio");
        }
        setStatus("idle");
        setError("");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setSyncReady(false);
        setError(e instanceof Error ? e.message : "Errore");
      }
    })();
    return () => { cancelled = true; };
    // applyRemote chiude sulle ref, non sullo stato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetsUrl, password, pullNonce]);

  useEffect(() => {
    if (!sheetsUrl || !syncReady || conflict || !Boolean(password)) return;
    if (!baseState.current) return;
    if (contentKey(state) === contentKey(baseState.current)) return;
    const problems = validateState(state);
    if (problems.length) {
      setStatus("error");
      setError(problems.slice(0, 2).join(" "));
      return;
    }
    const gen = ++editGen.current;
    const sent = state;
    const token = password;
    const expected = baseRevision.current;
    const base = clone(baseState.current);
    setStatus("saving");
    const timer = window.setTimeout(async () => {
      try {
        const res = await pushToSheets(sheetsUrl, token, { expectedRevision: expected, baseState: base, state: sent });
        if (res.conflict) {
          const remote = acceptState(res.state);
          if (!remote) throw new Error("Il foglio contiene dati non validi");
          conflictRev.current = res.revision ?? 0;
          setConflict(remote);
          setConflictNames(res.conflicts ?? []);
          setStatus("error");
          setError(res.conflicts?.length ? "Conflitto sugli stessi elementi" : "Un collega ha salvato modifiche più recenti");
          return;
        }
        if (!res.ok || res.state == null) throw new Error(res.error || "Errore");
        const saved = acceptState(res.state);
        if (!saved) throw new Error("Il foglio ha restituito dati non validi");
        baseRevision.current = res.revision ?? expected;
        baseState.current = clone(saved);
        setRemoteRevision(res.revision ?? 0);
        if (editGen.current !== gen && res.merged) {
          conflictRev.current = res.revision ?? 0;
          setConflict(saved);
          setConflictNames(["Modifiche arrivate mentre stavi scrivendo"]);
          setStatus("error");
          return;
        }
        if (contentKey(saved) !== contentKey(sent)) setState(saved);
        setStatus("saved");
        setError("");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Errore");
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [state, sheetsUrl, syncReady, conflict, password]);

  useEffect(() => {
    if (tab !== "Storico" || !sheetsUrl || !Boolean(password) || !syncReady) return;
    let cancelled = false;
    listServerSnapshots(sheetsUrl, password).then((res) => {
      if (!cancelled && res.ok && res.snapshots) setServerSnaps(res.snapshots);
    }).catch(() => { /* la sezione Drive resta vuota */ });
    return () => { cancelled = true; };
  }, [tab, sheetsUrl, password, syncReady, remoteRevision]);

  const commit = (patch: Partial<AppState>) =>
    setState((s) => ({ ...s, ...patch, updatedAt: new Date().toISOString() }));

  const setActivities = (activities: Activity[]) => {
    const ids = new Set(activities.map((a) => a.id));
    commit({
      activities: activities.map((a) => ({ ...a, subtasks: [] })),
      tasks: stateRef.current.tasks.filter((t) => ids.has(t.activityId)),
    });
  };

  const setTasks = (tasks: WorkTask[]) => {
    commit({
      tasks,
      activities: stateRef.current.activities.map((a) => syncHours(a, tasks)),
    });
  };

  const addActivity = (activity: Activity) => {
    setState((current) => {
      const created = { ...activity, subtasks: [] as Activity["subtasks"] };
      const task = newTask(created, 0);
      task.name = created.name;
      task.hours = created.hoursManual;
      const tasks = [...current.tasks, task];
      return {
        ...current,
        tasks,
        activities: [...current.activities, syncHours(created, tasks)],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const forcePush = async (next: AppState) => {
    if (!sheetsUrl || !Boolean(passwordRef.current)) {
      setState(next);
      return;
    }
    setStatus("saving");
    const res = await pushToSheets(sheetsUrl, passwordRef.current, {
      expectedRevision: baseRevision.current,
      baseState: baseState.current,
      state: next,
      force: true,
    });
    if (!res.ok || res.state == null) throw new Error(res.error || "Errore");
    const saved = acceptState(res.state);
    if (!saved) throw new Error("Dati non validi");
    baseRevision.current = res.revision ?? 0;
    baseState.current = clone(saved);
    setRemoteRevision(res.revision ?? 0);
    setConflict(null);
    setConflictNames([]);
    setState(saved);
    setSyncReady(true);
    setRevealed(true);
    setStatus("saved");
    setError("");
  };

  const overwrite = async () => {
    remember("Prima di sovrascrivere il foglio");
    try {
      await forcePush(stateRef.current);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Errore");
    }
  };

  const loadExample = async () => {
    remember("Prima del caricamento dell'esempio");
    try {
      await forcePush(sampleState());
      setNotice("");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Errore");
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const migrated = migrate(JSON.parse(await file.text()));
      if (!migrated) throw new Error("versione non supportata");
      const problems = validateState(migrated);
      if (problems.length) throw new Error(problems.slice(0, 3).join(" "));
      remember("Prima dell'import JSON");
      setState({ ...migrated, example: false, updatedAt: new Date().toISOString() });
      setNotice("");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "File JSON non valido o di una versione non supportata.");
    }
  };

  const saveSnap = async (label: string) => {
    remember(label);
    if (!sheetsUrl || !syncReady || !Boolean(passwordRef.current) || conflict) return;
    try {
      let current = stateRef.current;
      if (baseState.current && contentKey(current) !== contentKey(baseState.current)) {
        const pushed = await pushToSheets(sheetsUrl, passwordRef.current, {
          expectedRevision: baseRevision.current,
          baseState: baseState.current,
          state: current,
        });
        if (pushed.conflict && pushed.state) {
          const remote = acceptState(pushed.state);
          if (remote) {
            conflictRev.current = pushed.revision ?? 0;
            setConflict(remote);
            setConflictNames(pushed.conflicts ?? []);
          }
          setNotice("Copia salvata in questo browser. Sul Drive manca perché c'è un conflitto da risolvere.");
          return;
        }
        if (!pushed.ok || pushed.state == null) throw new Error(pushed.error || "Errore");
        const saved = acceptState(pushed.state);
        if (!saved) throw new Error("Dati non validi");
        baseRevision.current = pushed.revision ?? baseRevision.current;
        baseState.current = clone(saved);
        setRemoteRevision(pushed.revision ?? 0);
        if (contentKey(saved) !== contentKey(current)) setState(saved);
        current = saved;
      }
      const snap = await snapshotOnSheets(sheetsUrl, passwordRef.current, label);
      if (!snap.ok) throw new Error(snap.error || "Errore");
      const listed = await listServerSnapshots(sheetsUrl, passwordRef.current);
      if (listed.ok && listed.snapshots) setServerSnaps(listed.snapshots);
      setNotice("Istantanea salvata anche sul Drive.");
      setStatus("saved");
    } catch (e) {
      setNotice(`Copia salvata in questo browser. Sul Drive: ${e instanceof Error ? e.message : "errore"}`);
    }
  };

  const deleteSnap = (id: string) => {
    const next = snapsRef.current.filter((s) => s.id !== id);
    snapsRef.current = next;
    setSnapshots(next);
    saveSnapshots(next);
  };

  const restoreServer = async (id: string) => {
    if (!sheetsUrl || !Boolean(passwordRef.current)) return;
    remember("Prima del ripristino dallo storico");
    try {
      const res = await restoreServerSnapshot(sheetsUrl, passwordRef.current, id, baseRevision.current);
      if (res.conflict && res.state) {
        const remote = acceptState(res.state);
        if (!remote) throw new Error("Il foglio contiene dati non validi");
        conflictRev.current = res.revision ?? 0;
        setConflict(remote);
        setConflictNames(res.conflicts ?? []);
        setStatus("error");
        setError("Il foglio è cambiato: scegli cosa tenere prima di ripristinare");
        return;
      }
      if (!res.ok || res.state == null) throw new Error(res.error || "Errore");
      const saved = acceptState(res.state);
      if (!saved) throw new Error("Snapshot non valido");
      applyRemote(saved, res.revision ?? 0, null);
      setStatus("saved");
      setNotice("Ripristino salvato come nuova revisione.");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Errore");
    }
  };

  const kpi = useMemo(() => metrics(state), [state]);
  const issues = useMemo(() => runChecks(state), [state]);
  const blocked = Boolean(sheetsUrl) && !syncReady;
  const canUploadExample = !state.example && (!sheetsUrl || (syncReady && remoteRevision === 0));

  const importActivities = (items: Activity[], mode: "append" | "replace") => {
    remember(mode === "replace" ? "Prima della sostituzione CSV" : "Prima dell'import CSV");
    if (mode === "append") {
      commit({ activities: [...state.activities, ...items] });
    } else {
      commit({
        example: false,
        activities: items,
        blockers: state.blockers.map((b) => ({ ...b, activityIds: [] })),
        microTools: state.microTools.map((t) => ({ ...t, activityIds: [] })),
        actuals: {},
      });
    }
    setShowCsv(false);
    setNotice("");
    setTab("Tabella");
  };

  const onTabKey = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("role") !== "tab") return;
    const index = TABS.indexOf(tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    const name = TABS[next];
    setTab(name);
    document.getElementById(tabDomId(name))?.focus();
  };

  const workLocal = () => {
    setSheetsUrl("");
    saveSheetsUrl("");
    setStatus("off");
    setError("");
    setSyncReady(true);
    setRevealed(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="w-full sm:min-w-0 sm:flex-1">
          <h1 className="text-2xl font-bold tracking-tight">AI Activity Mapper</h1>
          <p className="text-sm text-slate-500">Cosa automatizzare, cosa aumentare, cosa lasciare umano.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <span role="status" className={`rounded-full px-2.5 py-1 text-xs font-medium ${status === "error" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
            {STATUS_LABEL[status]}
          </span>
          <button type="button" className="btn" onClick={() => setShowSync(true)}>Sheets</button>
          {sheetsUrl && password && <button type="button" className="btn" onClick={signOut}>Esci</button>}
          <button type="button" className="btn" onClick={() => setShowCsv(true)} disabled={blocked}>Import CSV</button>
          <button type="button" className="btn" onClick={() => exportCsv(state)} disabled={blocked}>CSV</button>
          <button type="button" className="btn" onClick={() => exportJson(state)} disabled={blocked}>Export JSON</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={blocked}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </header>

      {!revealed && (
        <section className="card space-y-3 p-6" aria-busy={status === "loading"}>
          <h2 className="text-lg font-semibold">Collegamento al foglio</h2>
          {status === "loading" && <p className="text-sm text-slate-600">Caricamento del foglio. La modifica è sospesa finché non arriva la risposta.</p>}
          {(status === "auth" || status === "error") && (
            <>
              <p className="text-sm text-slate-600">Per leggere il foglio serve la password condivisa. I dati di esempio non vengono inviati.</p>
              {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
              <PasswordFields
                password={password}
                remember={rememberPassword}
                onSubmit={(next, keep) => { onPassword(next, keep); setPullNonce((n) => n + 1); }}
              />
              <button type="button" className="btn" onClick={workLocal}>Continua solo in questo browser</button>
            </>
          )}
        </section>
      )}

      {revealed && state.example && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Dati di esempio</p>
          <p className="mt-1">Attività, persone e clienti sono illustrativi e non descrivono il tuo team.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ConfirmButton className="btn" confirmLabel="Svuotare?" onConfirm={() => { remember("Prima di partire da zero"); setState(emptyState()); }}>Parti da zero</ConfirmButton>
            <button type="button" className="btn-primary" onClick={() => commit({ example: false })}>Questi sono i miei dati</button>
          </div>
        </div>
      )}

      {revealed && blocked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          <p className="font-semibold">Modifica sospesa</p>
          <p className="mt-1">{status === "auth" ? "Manca la password. Inseriscila per continuare sul foglio." : (error || "Attendi il foglio.")}</p>
          {status === "auth" && (
            <div className="mt-2">
              <PasswordFields password={password} remember={rememberPassword} onSubmit={(next, keep) => { onPassword(next, keep); setPullNonce((n) => n + 1); }} />
            </div>
          )}
          {status === "error" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => setPullNonce((n) => n + 1)}>Riprova</button>
              <button type="button" className="btn" onClick={workLocal}>Continua solo in questo browser</button>
            </div>
          )}
        </div>
      )}

      {conflict && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <div className="font-semibold">Gli stessi elementi sono stati modificati da un collega.</div>
          <p className="mt-1">Le modifiche su attività diverse si uniscono da sole. Qui va scelto cosa tenere.</p>
          {conflictNames.length > 0 && <p className="mt-1">In conflitto: {conflictNames.join(", ")}.</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => { remember("Prima di caricare le modifiche remote"); applyRemote(conflict, conflictRev.current, null); setStatus("idle"); setError(""); }}>Carica le sue modifiche (perdo le mie)</button>
            <button type="button" className="btn" onClick={overwrite}>Sovrascrivi con le mie</button>
          </div>
        </div>
      )}

      {notice && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700" role="status">{notice}</div>}

      {revealed && (
        <div ref={(node) => { if (node) node.toggleAttribute("inert", blocked); }} className={blocked ? "opacity-60" : undefined}>
          {tab !== "Executive" && (
            <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
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

          <div role="tablist" aria-label="Viste" className="flex gap-1 overflow-x-auto border-b border-slate-200" onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={tabDomId(t)}
                aria-selected={tab === t}
                aria-controls="pannello-vista"
                tabIndex={tab === t ? 0 : -1}
                onClick={() => setTab(t)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {t}
                {t === "Controlli" && issues.length > 0 && (
                  <>
                    <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 text-[11px] text-rose-700" aria-hidden="true">{issues.length}</span>
                    <span className="sr-only">, {issues.length} avvisi</span>
                  </>
                )}
              </button>
            ))}
          </div>

          <div role="tabpanel" id="pannello-vista" aria-labelledby={tabDomId(tab)} className="pt-5" tabIndex={0}>
            {tab === "Executive" && (
              <ExecutiveView state={state} onGo={(t) => setTab(t as Tab)} onSettings={(p) => commit({ settings: { ...state.settings, ...p } })} />
            )}
            {tab === "Riepilogo" && <SummaryView activities={state.activities} onChange={(activities) => commit({ activities })} />}
            {tab === "Teams" && (
              <TeamsView
                activities={state.activities}
                tasks={state.tasks}
                blockers={state.blockers}
                microTools={state.microTools}
                onChange={setActivities}
                onTasks={setTasks}
                onAdd={addActivity}
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
              <MeasureView state={state} onActuals={(actuals) => commit({ actuals })} onActivities={(activities) => commit({ activities })} />
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
            {tab === "Tabella" && (
              <TableView activities={state.activities} tasks={state.tasks} onChange={setActivities} onTasks={setTasks} />
            )}
            {tab === "Controlli" && <QualityView issues={issues} onGo={(t) => setTab(t as Tab)} />}
            {tab === "Storico" && (
              <HistoryView
                state={state}
                snapshots={snapshots}
                serverSnapshots={serverSnaps}
                serverReady={Boolean(sheetsUrl) && syncReady && Boolean(password)}
                onSave={saveSnap}
                onRestore={(s) => { remember("Prima del ripristino locale"); setState({ ...clone(s.state), updatedAt: new Date().toISOString() }); setNotice(""); }}
                onDelete={deleteSnap}
                onRestoreServer={restoreServer}
              />
            )}
          </div>
        </div>
      )}

      {showCsv && <ImportCsvModal existing={state.activities.length} onImport={importActivities} onClose={() => setShowCsv(false)} />}

      {showSync && (
        <SyncPanel
          url={sheetsUrl}
          status={status}
          error={error}
          password={password}
          remember={rememberPassword}
          canUploadExample={canUploadExample}
          onPassword={onPassword}
          onSignOut={signOut}
          onSaveUrl={(u) => {
            setSheetsUrl(u);
            saveSheetsUrl(u);
            setPullNonce((n) => n + 1);
            if (!u) {
              setStatus("off");
              setSyncReady(true);
              setRevealed(true);
            } else {
              setRevealed(false);
              setSyncReady(false);
            }
            setShowSync(false);
          }}
          onPull={() => { setPullNonce((n) => n + 1); setShowSync(false); }}
          onUploadExample={() => { setShowSync(false); void loadExample(); }}
          onClose={() => setShowSync(false)}
        />
      )}
    </div>
  );
}
