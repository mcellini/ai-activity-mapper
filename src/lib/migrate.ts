import type { Activity, AppState, Blocker, MicroTool, Person, SubTask, TeamId, ToolStatus, Treatment, WorkTask } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TEAM_IDS: TeamId[] = ["seo", "content", "pr", "social", "design"];

/** v2 -> v3: ore AI divise in liberate/reinvestite, blocker e micro-tool */
function v2to3(raw: any): any {
  const activities = (raw.activities ?? []).map((a: any) => {
    const saved = Math.max(0, (a.hoursManual ?? 0) - (a.hoursAI ?? 0));
    const auto = a.pctAutomatable ?? 0;
    const aug = a.pctAugmentable ?? 0;
    const freed = auto + aug > 0 ? Math.round((saved * auto) / (auto + aug)) : 0;
    return {
      id: a.id, teamId: a.teamId, name: a.name, workType: "produzione",
      hoursManual: a.hoursManual ?? 0, hoursFreed: freed, hoursReinvested: saved - freed,
      destination: "non_allocata", pctAutomatable: auto, pctAugmentable: aug,
      complexity: a.complexity ?? "medium", tools: a.tools ?? "",
      dependencies: a.dependencies ?? "", notes: a.notes ?? "",
    };
  });
  return {
    version: 3, activities, workflows: raw.workflows ?? [], blockers: [], microTools: [],
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

const TOOL_STATUS_MAP: Record<string, ToolStatus> = {
  planned: "idea", beta: "prototipo", live: "in_uso",
  idea: "idea", prototipo: "prototipo", in_uso: "in_uso", adottato: "adottato",
};

/** v3 -> v4: confidenza, rischio, dipendenze, costi, persone, clienti, misurato */
function v3to4(raw: any): any {
  const activities: Activity[] = (raw.activities ?? []).map((a: any) => ({
    ...a,
    confidence: a.confidence ?? "stima",
    riskLevel: a.riskLevel ?? "nd",
    humanControl: a.humanControl ?? "",
    dependsOn: a.dependsOn ?? [],
  }));
  const microTools: MicroTool[] = (raw.microTools ?? []).map((t: any) => ({
    ...t,
    status: TOOL_STATUS_MAP[t.status] ?? "idea",
    monthlyCost: t.monthlyCost ?? 0,
  }));
  return {
    version: 4,
    activities,
    workflows: raw.workflows ?? [],
    blockers: raw.blockers ?? [],
    microTools,
    people: [],
    clients: [],
    actuals: {},
    settings: { hourlyCost: 40, worstThreshold: 80 },
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

/** Prova a ricavare la cadenza dal testo libero di versioni precedenti */
function guessCadence(schedule: string, kind: string): MicroTool["cadence"] {
  const s = schedule.toLowerCase();
  if (/mattin|giorn|ogni sera|notte/.test(s)) return "giornaliera";
  if (/settiman|lunedi|lunedì/.test(s)) return "settimanale";
  if (/mese|mensil/.test(s)) return "mensile";
  return kind === "one_shot" ? "on_demand" : "settimanale";
}

const NEED_BY_KIND: Record<string, Blocker["need"]> = {
  dati: "dati", tool: "account", competenze: "formazione", processo: "processo", cliente: "altro",
};

/** v4 -> v5: frequenza, micro-task, area, bisogni dei blocker, tipo di tool, adozione AI per persona */
function v4to5(raw: any): any {
  const activities: Activity[] = (raw.activities ?? []).map((a: any) => ({
    ...a,
    area: a.area ?? "delivery",
    runsPerMonth: a.runsPerMonth ?? 0,
    hoursPerRun: a.hoursPerRun ?? 0,
    subtasks: a.subtasks ?? [],
  }));
  const blockers: Blocker[] = (raw.blockers ?? []).map((b: any) => ({
    ...b,
    need: b.need ?? NEED_BY_KIND[b.kind] ?? "altro",
    cost: b.cost ?? 0,
  }));
  const microTools: MicroTool[] = (raw.microTools ?? []).map((t: any) => ({
    ...t,
    kind: t.kind ?? "one_shot",
    schedule: t.schedule ?? "",
    cadence: t.cadence ?? guessCadence(t.schedule ?? "", t.kind ?? "one_shot"),
    newTask: t.newTask ?? "",
  }));
  const people: Person[] = (raw.people ?? []).map((p: any) => ({ ...p, aiShare: p.aiShare ?? null }));
  return {
    ...raw,
    version: 5,
    activities,
    blockers,
    microTools,
    people,
    workflows: raw.workflows ?? [],
    clients: (raw.clients ?? []).map((c: any) => ({
      ...c,
      hoursByTeam: Object.fromEntries(TEAM_IDS.map((t) => [t, c.hoursByTeam?.[t] ?? 0])),
    })),
    actuals: raw.actuals ?? {},
    settings: { hourlyCost: 40, worstThreshold: 80, ...(raw.settings ?? {}) },
  };
}

const TREATMENTS: Treatment[] = ["umano", "automazione", "augmentation", "nuovo"];

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function treatmentOf(v: unknown): Treatment {
  return TREATMENTS.includes(v as Treatment) ? (v as Treatment) : "umano";
}

function normalizeTask(raw: any, fallbackOrder: number): WorkTask {
  return {
    id: String(raw?.id || ""),
    activityId: String(raw?.activityId || ""),
    name: String(raw?.name || ""),
    notes: String(raw?.notes || ""),
    teamId: TEAM_IDS.includes(raw?.teamId) ? raw.teamId : "seo",
    hours: Math.max(0, num(raw?.hours)),
    treatment: treatmentOf(raw?.treatment),
    pctSaved: Math.max(0, Math.min(100, num(raw?.pctSaved))),
    runsPerMonth: Math.max(0, num(raw?.runsPerMonth)),
    tools: String(raw?.tools || ""),
    owner: String(raw?.owner || ""),
    order: Number.isFinite(raw?.order) ? raw.order : fallbackOrder,
  };
}

function taskFromPart(
  activity: Activity, key: string, name: string, hours: number, treatment: Treatment, pctSaved: number, order: number, notes: string,
): WorkTask {
  return {
    id: `mig-${activity.id}-${key}`,
    activityId: activity.id,
    name,
    notes,
    teamId: activity.teamId,
    hours,
    treatment,
    pctSaved,
    runsPerMonth: activity.runsPerMonth || 0,
    tools: activity.tools || "",
    owner: "",
    order,
  };
}

/** Scompone i micro-task annidati, o le ore dell'attività, in task con id stabile. Non butta ore. */
function tasksFromActivity(activity: Activity): WorkTask[] {
  const subs = activity.subtasks ?? [];
  if (subs.length) {
    return subs.map((s: SubTask, i: number) => normalizeTask({
      id: s.id || `mig-${activity.id}-s${i}`,
      activityId: activity.id,
      name: s.name || activity.name,
      notes: "",
      teamId: activity.teamId,
      hours: s.hours,
      treatment: s.treatment,
      pctSaved: s.pctSaved,
      runsPerMonth: activity.runsPerMonth || 0,
      tools: activity.tools || "",
      owner: "",
      order: i,
    }, i));
  }
  const manual = Math.max(0, num(activity.hoursManual));
  const freed = Math.min(Math.max(0, num(activity.hoursFreed)), manual);
  const reinv = Math.min(Math.max(0, num(activity.hoursReinvested)), Math.max(0, manual - freed));
  const human = Math.max(0, manual - freed - reinv);
  const note = `Ore spostate dall'attività «${activity.name}» in migrazione, senza sommarle due volte.`;
  const parts: WorkTask[] = [];
  if (freed === 0 && reinv === 0) {
    parts.push(taskFromPart(activity, "u", activity.name, manual, "umano", 0, 0, ""));
  } else {
    if (human > 0) parts.push(taskFromPart(activity, "u", `${activity.name} · parte umana`, human, "umano", 0, 0, note));
    if (freed > 0) parts.push(taskFromPart(activity, "f", `${activity.name} · ore liberate`, freed, "automazione", 100, parts.length, note));
    if (reinv > 0) parts.push(taskFromPart(activity, "r", `${activity.name} · ore potenziate`, reinv, "augmentation", 100, parts.length, note));
  }
  if (!parts.length) parts.push(taskFromPart(activity, "u", activity.name, manual, "umano", 0, 0, ""));
  if (parts.length === 1) parts[0] = { ...parts[0], name: activity.name, notes: "" };
  return parts;
}

/**
 * v5 → v6: i micro-task escono dall'attività e diventano entità.
 * Se i task ci sono già, non vengono rigenerati.
 */
function v5to6(raw: any): AppState {
  const v5 = raw.version === 6 ? raw : v4to5(raw);
  const activities: Activity[] = (v5.activities ?? []).map((a: Activity) => ({ ...a, subtasks: a.subtasks ?? [] }));
  const existing = Array.isArray(v5.tasks) ? v5.tasks.map((t: any, i: number) => normalizeTask(t, i)).filter((t: WorkTask) => t.id && t.activityId) : [];
  const tasks = existing.length ? existing : activities.flatMap(tasksFromActivity);
  return {
    ...v5,
    version: 6,
    tasks,
    activities: activities.map((a) => ({ ...a, subtasks: [] })),
  };
}

/** Porta qualunque versione salvata (v2 ... v6) al formato v6. Ritorna null se non riconosciuta. */
export function migrate(raw: any): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.version === 6 || raw.version === 5 || raw.version === 4) return v5to6(raw);
  if (raw.version === 3) return v5to6(v3to4(raw));
  if (raw.version === 2) return v5to6(v3to4(v2to3(raw)));
  return null;
}
