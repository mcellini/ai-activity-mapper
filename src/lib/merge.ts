import type { AppState, Settings } from "@/types";

export interface MergeResult {
  state: AppState;
  conflicts: string[];
}

type WithId = { id: string; name?: string };

/** JSON stabile: l'ordine delle chiavi non conta. Serve al confronto a tre vie. */
export function stableString(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Confronto del contenuto, ignorando updatedAt che è un timbro del server. */
export function contentKey(state: AppState): string {
  const copy = { ...state } as Partial<AppState>;
  delete copy.updatedAt;
  return stableString(copy);
}

/**
 * Unione a tre vie per id.
 * Se solo uno dei due lati ha toccato un elemento, vince quel lato.
 * Se entrambi hanno toccato lo stesso elemento in modo diverso, è un conflitto
 * e si tiene la copia del server (il chiamante non deve salvarla).
 */
export function mergeThreeWay(base: AppState, server: AppState, client: AppState): MergeResult {
  const conflicts: string[] = [];
  const state: AppState = {
    version: 5,
    example: mergeFlag(base.example, server.example, client.example, conflicts),
    updatedAt: server.updatedAt,
    activities: [],
    workflows: [],
    blockers: [],
    microTools: [],
    people: [],
    clients: [],
    actuals: mergeActuals(base.actuals, server.actuals, client.actuals, conflicts),
    settings: mergeSettings(base.settings, server.settings, client.settings, conflicts),
  };
  state.activities = mergeById("Attività", base.activities, server.activities, client.activities, conflicts);
  state.blockers = mergeById("Blocker", base.blockers, server.blockers, client.blockers, conflicts);
  state.microTools = mergeById("Micro-tool", base.microTools, server.microTools, client.microTools, conflicts);
  state.people = mergeById("Persona", base.people, server.people, client.people, conflicts);
  state.clients = mergeById("Cliente", base.clients, server.clients, client.clients, conflicts);
  state.workflows = mergeById("Workflow", base.workflows, server.workflows, client.workflows, conflicts);
  return { state, conflicts };
}

function mergeFlag(
  base: boolean | undefined, server: boolean | undefined, client: boolean | undefined, conflicts: string[],
): boolean {
  const b = !!base;
  const s = !!server;
  const c = !!client;
  if (c !== b && s !== b && c !== s) {
    conflicts.push("Dati di esempio");
    return s;
  }
  return c !== b ? c : s;
}

function mergeSettings(base: Settings, server: Settings, client: Settings, conflicts: string[]): Settings {
  const b = stableString(base);
  const s = stableString(server);
  const c = stableString(client);
  if (c !== b && s !== b && c !== s) {
    conflicts.push("Impostazioni");
    return server;
  }
  return c !== b ? client : server;
}

function mergeActuals(
  base: AppState["actuals"], server: AppState["actuals"], client: AppState["actuals"], conflicts: string[],
): AppState["actuals"] {
  const ids = new Set([...Object.keys(base ?? {}), ...Object.keys(server ?? {}), ...Object.keys(client ?? {})]);
  const out: AppState["actuals"] = {};
  for (const id of ids) {
    const b = base?.[id];
    const s = server?.[id];
    const c = client?.[id];
    const bs = stableString(b);
    const ss = stableString(s);
    const cs = stableString(c);
    if (cs !== bs && ss !== bs && cs !== ss) {
      conflicts.push(`Ore reali «${id}»`);
      if (s) out[id] = s;
      continue;
    }
    const chosen = cs !== bs ? c : s;
    if (chosen && Object.keys(chosen).length) out[id] = chosen;
  }
  return out;
}

function mergeById<T extends WithId>(label: string, base: T[], server: T[], client: T[], conflicts: string[]): T[] {
  const bm = toMap(base);
  const sm = toMap(server);
  const cm = toMap(client);
  const chosen = new Map<string, T>();
  const ids = new Set([...bm.keys(), ...sm.keys(), ...cm.keys()]);
  for (const id of ids) {
    const b = bm.get(id);
    const s = sm.get(id);
    const c = cm.get(id);
    const bs = stableString(b);
    const ss = stableString(s);
    const cs = stableString(c);
    const clientChanged = cs !== bs;
    const serverChanged = ss !== bs;
    if (clientChanged && serverChanged && cs !== ss) {
      conflicts.push(`${label} «${nameOf(c) || nameOf(s) || nameOf(b) || id}»`);
      if (s) chosen.set(id, s);
      continue;
    }
    if (clientChanged) {
      if (c) chosen.set(id, c);
      continue;
    }
    if (s) chosen.set(id, s);
  }
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of [...server, ...client]) {
    const kept = chosen.get(item.id);
    if (kept && !seen.has(item.id)) {
      out.push(kept);
      seen.add(item.id);
    }
  }
  return out;
}

function toMap<T extends WithId>(list: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of list ?? []) map.set(item.id, item);
  return map;
}

function nameOf(item: WithId | undefined): string {
  return item?.name?.trim() || item?.id || "";
}
