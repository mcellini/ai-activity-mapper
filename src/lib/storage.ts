import type { AppState, Snapshot } from "@/types";
import { SEED } from "@/data/seed";
import { migrate } from "@/lib/migrate";
import { areaLabel, confLabel, destLabel, frequencyLabel, workTypeLabel } from "@/lib/calc";

const STATE_KEY = "aam.state.v5";
const OLD_STATE_KEYS = ["aam.state.v4", "aam.state.v3", "aam.state.v2"];
const URL_KEY = "aam.sheetsUrl";
const SNAP_KEY = "aam.snapshots.v1";

export function loadLocal(): AppState {
  try {
    for (const key of [STATE_KEY, ...OLD_STATE_KEYS]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const state = migrate(JSON.parse(raw));
        if (state) return state;
      }
    }
  } catch {
    /* storage non disponibile */
  }
  return SEED;
}

export function saveLocal(state: AppState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Snapshot[])
      .map((s) => ({ ...s, state: migrate(s.state) as AppState }))
      .filter((s) => s.state);
  } catch {
    return [];
  }
}

export function saveSnapshots(list: Snapshot[]) {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadSheetsUrl(): string {
  const envUrl = (import.meta.env.VITE_SHEETS_URL as string | undefined) ?? "";
  try {
    return localStorage.getItem(URL_KEY) ?? envUrl;
  } catch {
    return envUrl;
  }
}

export function saveSheetsUrl(url: string) {
  try {
    localStorage.setItem(URL_KEY, url);
  } catch {
    /* ignore */
  }
}

/** Legge lo stato dal foglio (Apps Script doGet). Accetta anche dati di versioni precedenti. */
export async function pullFromSheets(url: string): Promise<AppState | null> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return migrate(data?.state);
}

/**
 * Scrive lo stato sul foglio. Content-Type text/plain evita il preflight CORS,
 * che Apps Script non gestisce.
 */
export async function pushToSheets(url: string, state: AppState): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(state),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => ({ ok: true }));
  if (data?.ok === false) throw new Error(data.error ?? "Errore Apps Script");
}

export function exportJson(state: AppState) {
  download("ai-activity-mapper.json", JSON.stringify(state, null, 2), "application/json");
}

export function exportCsv(state: AppState) {
  const head = ["Team","Attivita","Area","Frequenza","OrePerEsecuzione","MicroTask","TipoLavoro","OreManuali","OreLiberate","OreReinvestite","DestinazioneOreLiberate","Confidenza","Rischio","ControlloUmano","Automatizzabile%","Aumentabile%","Complessita","Tool","Dipendenze","Note","Blocker","MicroTool"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = state.activities.map((a) =>
    [
      a.teamId, a.name, areaLabel(a.area), frequencyLabel(a.runsPerMonth), a.hoursPerRun, a.subtasks.map((x) => `${x.name} (${x.hours}h, ${x.treatment})`).join(" | "), workTypeLabel(a.workType), a.hoursManual, a.hoursFreed, a.hoursReinvested,
      destLabel(a.destination), confLabel(a.confidence), a.riskLevel, a.humanControl,
      a.pctAutomatable, a.pctAugmentable, a.complexity, a.tools, a.dependencies, a.notes,
      state.blockers.filter((b) => b.activityIds.includes(a.id)).map((b) => b.name).join(" | "),
      state.microTools.filter((t) => t.activityIds.includes(a.id)).map((t) => t.name).join(" | "),
    ].map(esc).join(",")
  );
  download("attivita.csv", [head.join(","), ...rows].join("\n"), "text/csv");
}

export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
