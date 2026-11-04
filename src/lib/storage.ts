import type { AppState, ServerSnapshot, Snapshot } from "@/types";
import { emptyState, SEED } from "@/data/seed";
import { migrate } from "@/lib/migrate";
import { areaLabel, confLabel, destLabel, frequencyLabel, workTypeLabel } from "@/lib/calc";
import { validateState } from "@/lib/validate";

const STATE_KEY = "aam.state.v5";
const OLD_STATE_KEYS = ["aam.state.v4", "aam.state.v3", "aam.state.v2"];
const URL_KEY = "aam.sheetsUrl";
const URL_OFF_KEY = "aam.sheetsUrl.off";
const SNAP_KEY = "aam.snapshots.v1";

export interface SheetsResponse {
  ok: boolean;
  error?: string;
  empty?: boolean;
  conflict?: boolean;
  conflicts?: string[];
  revision?: number;
  state?: unknown;
  merged?: boolean;
  snapshots?: ServerSnapshot[];
  snapshot?: ServerSnapshot;
}

/** Migra e rifiuta gli oggetti che non hanno la forma attesa. */
export function acceptState(raw: unknown): AppState | null {
  const migrated = migrate(raw);
  if (!migrated) return null;
  return validateState(migrated).length === 0 ? migrated : null;
}

export function loadLocal(): AppState {
  try {
    for (const key of [STATE_KEY, ...OLD_STATE_KEYS]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const state = acceptState(JSON.parse(raw));
      if (state) return state;
    }
  } catch {
    /* storage non disponibile */
  }
  return structuredClone(SEED);
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
      .map((s) => ({ ...s, state: acceptState(s.state) as AppState }))
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
  const envUrl = (import.meta.env.VITE_SHEETS_URL as string | undefined)?.trim() ?? "";
  try {
    if (localStorage.getItem(URL_OFF_KEY) === "1") return "";
    return localStorage.getItem(URL_KEY) ?? envUrl;
  } catch {
    return envUrl;
  }
}

export function saveSheetsUrl(url: string) {
  try {
    if (url) {
      localStorage.setItem(URL_KEY, url);
      localStorage.removeItem(URL_OFF_KEY);
    } else {
      localStorage.removeItem(URL_KEY);
      localStorage.setItem(URL_OFF_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

/**
 * Tutte le chiamate sono POST con Content-Type text/plain: niente preflight CORS,
 * e la password resta nel corpo, non nell'URL.
 */
export async function sheetsCall(url: string, body: Record<string, unknown>): Promise<SheetsResponse> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
    });
  } catch {
    throw new Error("Rete non disponibile");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try {
    return await res.json() as SheetsResponse;
  } catch {
    throw new Error("Risposta non valida dall'app web");
  }
}

export function pullFromSheets(url: string, password: string) {
  return sheetsCall(url, { action: "pull", password });
}

export function pushToSheets(
  url: string,
  password: string,
  payload: { expectedRevision: number; baseState: AppState | null; state: AppState; force?: boolean },
) {
  return sheetsCall(url, { action: "push", password, ...payload });
}

export function snapshotOnSheets(url: string, password: string, label: string) {
  return sheetsCall(url, { action: "snapshot", password, label });
}

export function listServerSnapshots(url: string, password: string) {
  return sheetsCall(url, { action: "listSnapshots", password });
}

export function restoreServerSnapshot(
  url: string, password: string, fileId: string, expectedRevision: number, force = false,
) {
  return sheetsCall(url, { action: "restore", password, fileId, expectedRevision, force });
}

export { emptyState };

export function exportJson(state: AppState) {
  download("ai-activity-mapper.json", JSON.stringify(state, null, 2), "application/json");
}

export function exportCsv(state: AppState) {
  const head = ["Team","Attivita","Area","Frequenza","OrePerEsecuzione","MicroTask","TipoLavoro","OreManuali","OreLiberate","OreReinvestite","DestinazioneOreLiberate","Confidenza","Rischio","ControlloUmano","Automatizzabile%","Aumentabile%","Complessita","Tool","Dipendenze","Note","Blocker","MicroTool"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = state.activities.map((a) =>
    [
      a.teamId, a.name, areaLabel(a.area), frequencyLabel(a.runsPerMonth), a.hoursPerRun, (state.tasks ?? []).filter((x) => x.activityId === a.id).map((x) => `${x.name} (${x.hours}h, ${x.treatment})`).join(" | "), workTypeLabel(a.workType), a.hoursManual, a.hoursFreed, a.hoursReinvested,
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
