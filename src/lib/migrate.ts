import type { Activity, AppState, Blocker, MicroTool, Person, TeamId, ToolStatus } from "@/types";

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
function v4to5(raw: any): AppState {
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
  } as AppState;
}

/** Porta qualunque versione salvata (v2 ... v5) al formato v5. Ritorna null se non riconosciuta. */
export function migrate(raw: any): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.version === 5 || raw.version === 4) return v4to5(raw);
  if (raw.version === 3) return v4to5(v3to4(raw));
  if (raw.version === 2) return v4to5(v3to4(v2to3(raw)));
  return null;
}
