import type { Activity, Area, Complexity, TeamId, WorkType } from "@/types";
import { WORK_DEFAULTS, uid } from "@/lib/calc";

/** Parser CSV con virgolette; riconosce da solo il separatore "," o ";" */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

type Field = "team" | "name" | "workType" | "manual" | "withAI" | "freed" | "reinv" | "auto" | "aug" | "complexity" | "tools" | "notes" | "area" | "runs";

const ALIASES: Record<Field, string[]> = {
  team: ["team", "reparto", "squadra"],
  name: ["attivita", "nome", "nome attivita", "attivita nome", "activity", "task"],
  workType: ["tipo lavoro", "tipo di lavoro", "tipolavoro", "tipo"],
  manual: ["ore manuali", "oremanuali", "ore mese", "ore al mese", "baseline", "ore baseline", "ore"],
  withAI: ["ore con ai", "oreconai", "ore ai", "ore con gpt", "ore con ai mese"],
  freed: ["ore liberate", "oreliberate"],
  reinv: ["ore reinvestite", "orereinvestite"],
  auto: ["automatizzabile", "automatizzabile %", "% automatizzabile", "automatizzabile%", "automation"],
  aug: ["aumentabile", "aumentabile %", "% aumentabile", "aumentabile%", "augmentation"],
  complexity: ["complessita", "complexity"],
  tools: ["tool", "tools", "strumenti"],
  notes: ["note", "notes"],
  area: ["area attivita", "ambito", "categoria"],
  runs: ["esecuzioni mese", "esecuzioni al mese", "volte al mese", "frequenza mese"],
};

function mapHeaders(header: string[]): Partial<Record<Field, number>> {
  const out: Partial<Record<Field, number>> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const f of Object.keys(ALIASES) as Field[]) {
      if (out[f] === undefined && ALIASES[f].includes(n)) { out[f] = i; break; }
    }
  });
  // "Area" è ambigua: è il team se manca una colonna Team, altrimenti è l'area di lavoro
  const areaCol = header.findIndex((h) => norm(h) === "area");
  if (areaCol >= 0) {
    if (out.team === undefined) out.team = areaCol;
    else if (out.area === undefined) out.area = areaCol;
  }
  return out;
}

function toTeam(v: string): TeamId | null {
  const n = norm(v);
  if (/\b(seo|geo)\b/.test(n)) return "seo";
  if (/content|contenut|editoria/.test(n)) return "content";
  if (/\bpr\b|press|relations/.test(n)) return "pr";
  if (/social/.test(n)) return "social";
  if (/design|creativ|grafic/.test(n)) return "design";
  return null;
}

function toWorkType(v: string): WorkType {
  const n = norm(v);
  if (n.startsWith("analis")) return "analisi";
  if (n.startsWith("scritt")) return "scrittura";
  if (n.startsWith("creativ")) return "creativita";
  if (n.startsWith("relaz")) return "relazione";
  if (n.startsWith("strateg")) return "strategia";
  return "produzione";
}

function toArea(v: string): Area {
  const n = norm(v);
  if (/gara|gare|biz|business dev|new business/.test(n)) return "gare";
  if (/r d|rnd|ricerca|formazione|sviluppo|training/.test(n)) return "rnd";
  return "delivery";
}

function toComplexity(v: string): Complexity {
  const n = norm(v);
  if (/^(alta|alto|high)/.test(n)) return "high";
  if (/^(bassa|basso|low)/.test(n)) return "low";
  return "medium";
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const t = v.replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface CsvResult {
  activities: Activity[];
  errors: string[];
  recognized: string[];
}

export function rowsToActivities(rows: string[][]): CsvResult {
  const errors: string[] = [];
  if (rows.length < 2) return { activities: [], errors: ["Il file non ha righe di dati."], recognized: [] };
  const map = mapHeaders(rows[0]);
  if (map.name === undefined) errors.push("Colonna dell'attività non trovata (cerco «Attività» o «Nome»).");
  if (map.team === undefined) errors.push("Colonna del team non trovata (cerco «Team»).");
  if (map.manual === undefined) errors.push("Colonna delle ore manuali non trovata (cerco «Ore manuali» o «Ore/mese»).");
  const recognized = (Object.keys(map) as Field[]).map((f) => rows[0][map[f] as number]);
  if (errors.length) return { activities: [], errors, recognized };

  const activities: Activity[] = [];
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const name = (r[map.name as number] ?? "").trim();
    if (!name) return;
    const teamId = toTeam(r[map.team as number] ?? "");
    if (!teamId) { errors.push(`Riga ${line} («${name}»): team non riconosciuto «${r[map.team as number] ?? ""}».`); return; }
    const manual = num(r[map.manual as number]);
    if (manual === null || manual < 0) { errors.push(`Riga ${line} («${name}»): ore manuali mancanti o non valide.`); return; }

    const workType = map.workType !== undefined ? toWorkType(r[map.workType] ?? "") : "produzione";
    const d = WORK_DEFAULTS[workType];
    let auto = map.auto !== undefined ? num(r[map.auto]) : null;
    let aug = map.aug !== undefined ? num(r[map.aug]) : null;
    if (auto === null) auto = d.auto;
    if (aug === null) aug = d.aug;
    auto = Math.max(0, Math.min(100, auto));
    aug = Math.max(0, Math.min(100 - auto, aug));

    let freed = map.freed !== undefined ? num(r[map.freed]) : null;
    let reinv = map.reinv !== undefined ? num(r[map.reinv]) : null;
    if (freed === null && reinv === null && map.withAI !== undefined) {
      const withAI = num(r[map.withAI]);
      if (withAI !== null) {
        const saved = Math.max(0, manual - withAI);
        freed = auto + aug > 0 ? Math.round((saved * auto) / (auto + aug)) : 0;
        reinv = saved - freed;
      }
    }
    freed = Math.max(0, Math.min(freed ?? 0, manual));
    reinv = Math.max(0, Math.min(reinv ?? 0, manual - freed));

    const runs = map.runs !== undefined ? Math.max(0, num(r[map.runs]) ?? 0) : 0;
    activities.push({
      id: uid(), teamId, name, workType,
      area: map.area !== undefined ? toArea(r[map.area] ?? "") : "delivery",
      runsPerMonth: runs, hoursPerRun: runs > 0 ? Math.round((manual / runs) * 10) / 10 : 0, subtasks: [], hoursManual: manual, hoursFreed: freed, hoursReinvested: reinv,
      destination: "non_allocata", confidence: "stima", pctAutomatable: auto, pctAugmentable: aug,
      complexity: map.complexity !== undefined ? toComplexity(r[map.complexity] ?? "") : "medium",
      riskLevel: "nd", humanControl: "", dependsOn: [],
      tools: map.tools !== undefined ? (r[map.tools] ?? "").trim() : "",
      dependencies: "", notes: map.notes !== undefined ? (r[map.notes] ?? "").trim() : "",
    });
  });
  return { activities, errors, recognized };
}
