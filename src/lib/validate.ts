import type {
  Activity, AppState, Area, Blocker, BlockerKind, Cadence, Client, ClientStatus, Complexity,
  Confidence, Destination, MicroTool, Need, Person, RiskLevel, Seniority, Severity, SubTask,
  ToolKind, ToolStatus, Treatment, WorkType, Workflow,
} from "@/types";

const TEAMS = ["seo", "content", "pr", "social", "design"];
const WORK: WorkType[] = ["analisi", "scrittura", "creativita", "relazione", "produzione", "strategia"];
const AREAS: Area[] = ["delivery", "gare", "rnd"];
const DESTS: Destination[] = ["nuovi_servizi", "qualita", "capacita_clienti", "non_allocata"];
const CONF: Confidence[] = ["stima", "misurato", "validato"];
const COMPLEX: Complexity[] = ["low", "medium", "high"];
const RISK: RiskLevel[] = ["nd", "basso", "medio", "alto"];
const TREAT: Treatment[] = ["umano", "automazione", "augmentation", "nuovo"];
const BKIND: BlockerKind[] = ["dati", "tool", "competenze", "processo", "cliente"];
const SEV: Severity[] = ["bassa", "media", "alta"];
const NEED: Need[] = ["connettore", "account", "formazione", "budget", "dati", "processo", "altro"];
const TSTATUS: ToolStatus[] = ["idea", "prototipo", "in_uso", "adottato"];
const TKIND: ToolKind[] = ["one_shot", "ricorrente", "agente"];
const CAD: Cadence[] = ["on_demand", "giornaliera", "settimanale", "mensile"];
const SEN: Seniority[] = ["junior", "mid", "senior", "lead"];
const CSTAT: ClientStatus[] = ["attivo", "gara", "prospect"];

const MAX = 30;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

function num(v: unknown, min = 0, max = Infinity): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

function str(v: unknown): v is string {
  return typeof v === "string";
}

function strList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Controlla versione e strutture obbligatorie. Lista vuota = valido. */
export function validateState(raw: unknown): string[] {
  const errors: string[] = [];
  const push = (m: string) => {
    if (errors.length < MAX) errors.push(m);
  };
  if (!isRecord(raw)) return ["Lo stato non è un oggetto"];
  if (raw.version !== 5) push("Versione non supportata (attesa la 5)");
  if (raw.example !== undefined && typeof raw.example !== "boolean") push("Il campo example non è un booleano");
  if (!str(raw.updatedAt)) push("Manca updatedAt");

  if (!Array.isArray(raw.activities)) push("activities non è una lista");
  else checkIds(raw.activities, "attività", push, (a, label) => checkActivity(a, label, push));

  if (!Array.isArray(raw.workflows)) push("workflows non è una lista");
  else checkIds(raw.workflows, "workflow", push, (w, label) => checkWorkflow(w, label, push));

  if (!Array.isArray(raw.blockers)) push("blockers non è una lista");
  else checkIds(raw.blockers, "blocker", push, (b, label) => checkBlocker(b, label, push));

  if (!Array.isArray(raw.microTools)) push("microTools non è una lista");
  else checkIds(raw.microTools, "micro-tool", push, (t, label) => checkTool(t, label, push));

  if (!Array.isArray(raw.people)) push("people non è una lista");
  else checkIds(raw.people, "persona", push, (p, label) => checkPerson(p, label, push));

  if (!Array.isArray(raw.clients)) push("clients non è una lista");
  else checkIds(raw.clients, "cliente", push, (c, label) => checkClient(c, label, push));

  if (!isRecord(raw.actuals)) push("actuals non è un oggetto");
  else {
    for (const [id, months] of Object.entries(raw.actuals)) {
      if (!isRecord(months)) { push(`Ore reali di ${id} non sono un oggetto`); continue; }
      for (const [month, hours] of Object.entries(months)) {
        if (!/^\d{4}-\d{2}$/.test(month) || !num(hours)) push(`Ore reali non valide per ${id} / ${month}`);
      }
    }
  }

  if (!isRecord(raw.settings)) push("Mancano le impostazioni");
  else {
    if (!num(raw.settings.hourlyCost)) push("Costo orario non valido");
    if (!num(raw.settings.worstThreshold, 0, 100)) push("Soglia del caso peggiore non valida");
  }

  return errors;
}

export function isValidState(raw: unknown): raw is AppState {
  return validateState(raw).length === 0;
}

function checkIds(
  list: unknown[],
  kind: string,
  push: (m: string) => void,
  each: (item: unknown, label: string) => void,
) {
  const seen = new Set<string>();
  list.forEach((item, i) => {
    const label = `${kind} #${i + 1}`;
    if (!isRecord(item) || !str(item.id) || !item.id.trim()) {
      push(`${label}: manca l'id`);
      return;
    }
    if (seen.has(item.id)) push(`${label}: id duplicato ${item.id}`);
    seen.add(item.id);
    each(item, `${kind} «${str(item.name) ? item.name : item.id}»`);
  });
}

function checkActivity(a: unknown, label: string, push: (m: string) => void) {
  const x = a as Partial<Activity>;
  if (!oneOf(x.teamId, TEAMS)) push(`${label}: team non valido`);
  if (!str(x.name)) push(`${label}: nome mancante`);
  if (!oneOf(x.workType, WORK)) push(`${label}: tipo di lavoro non valido`);
  if (!oneOf(x.area, AREAS)) push(`${label}: area non valida`);
  for (const k of ["runsPerMonth", "hoursPerRun", "hoursManual", "hoursFreed", "hoursReinvested"] as const) {
    if (!num(x[k])) push(`${label}: ${k} non è un numero valido`);
  }
  if (!oneOf(x.destination, DESTS)) push(`${label}: destinazione non valida`);
  if (!oneOf(x.confidence, CONF)) push(`${label}: confidenza non valida`);
  if (!oneOf(x.complexity, COMPLEX)) push(`${label}: complessità non valida`);
  if (!oneOf(x.riskLevel, RISK)) push(`${label}: rischio non valido`);
  if (!num(x.pctAutomatable, 0, 100) || !num(x.pctAugmentable, 0, 100)) push(`${label}: percentuali non valide`);
  if (!str(x.humanControl) || !str(x.tools) || !str(x.dependencies) || !str(x.notes)) push(`${label}: campi di testo mancanti`);
  if (!strList(x.dependsOn)) push(`${label}: dependsOn non è una lista`);
  if (!Array.isArray(x.subtasks)) push(`${label}: subtasks non è una lista`);
  else x.subtasks.forEach((s, i) => checkSub(s, `${label} micro-task #${i + 1}`, push));
}

function checkSub(s: unknown, label: string, push: (m: string) => void) {
  const x = s as Partial<SubTask>;
  if (!str(x.id) || !x.id.trim() || !str(x.name)) push(`${label}: id o nome mancante`);
  if (!num(x.hours) || !num(x.pctSaved, 0, 100)) push(`${label}: ore o percentuale non valide`);
  if (!oneOf(x.treatment, TREAT)) push(`${label}: trattamento non valido`);
}

function checkWorkflow(w: unknown, label: string, push: (m: string) => void) {
  const x = w as Partial<Workflow>;
  if (!str(x.name)) push(`${label}: nome mancante`);
  if (!Array.isArray(x.steps)) { push(`${label}: steps non è una lista`); return; }
  x.steps.forEach((s, i) => {
    if (!isRecord(s) || !str(s.id) || !str(s.name)) push(`${label} passo #${i + 1}: id o nome mancante`);
    else {
      if (!Array.isArray(s.teams) || !s.teams.every((t) => oneOf(t, TEAMS))) push(`${label} passo «${s.name}»: team non validi`);
      if (!str(s.tools) || !str(s.automationNote) || !str(s.augmentationNote) || !str(s.dependencies)) {
        push(`${label} passo «${s.name}»: campi di testo mancanti`);
      }
    }
  });
}

function checkBlocker(b: unknown, label: string, push: (m: string) => void) {
  const x = b as Partial<Blocker>;
  if (!str(x.name) || !str(x.owner)) push(`${label}: nome o owner mancante`);
  if (!oneOf(x.kind, BKIND) || !oneOf(x.severity, SEV) || !oneOf(x.need, NEED)) push(`${label}: classificazione non valida`);
  if (!num(x.cost)) push(`${label}: costo non valido`);
  if (!strList(x.activityIds)) push(`${label}: activityIds non è una lista`);
}

function checkTool(t: unknown, label: string, push: (m: string) => void) {
  const x = t as Partial<MicroTool>;
  if (!str(x.name) || !str(x.description) || !str(x.schedule) || !str(x.newTask) || !str(x.owner)) {
    push(`${label}: campi di testo mancanti`);
  }
  if (!oneOf(x.status, TSTATUS) || !oneOf(x.kind, TKIND) || !oneOf(x.cadence, CAD)) push(`${label}: classificazione non valida`);
  if (!num(x.users) || !num(x.monthlyCost)) push(`${label}: utenti o costo non validi`);
  if (!strList(x.activityIds)) push(`${label}: activityIds non è una lista`);
}

function checkPerson(p: unknown, label: string, push: (m: string) => void) {
  const x = p as Partial<Person>;
  if (!str(x.name)) push(`${label}: nome mancante`);
  if (!oneOf(x.teamId, TEAMS) || !oneOf(x.seniority, SEN)) push(`${label}: team o seniority non validi`);
  if (!num(x.hours)) push(`${label}: ore non valide`);
  if (!(x.aiShare === null || num(x.aiShare, 0, 100))) push(`${label}: uso AI non valido`);
}

function checkClient(c: unknown, label: string, push: (m: string) => void) {
  const x = c as Partial<Client>;
  if (!str(x.name)) push(`${label}: nome mancante`);
  if (!oneOf(x.status, CSTAT)) push(`${label}: stato non valido`);
  if (!num(x.probability, 0, 100)) push(`${label}: probabilità non valida`);
  if (!isRecord(x.hoursByTeam)) { push(`${label}: hoursByTeam mancante`); return; }
  const hours = x.hoursByTeam as Record<string, unknown>;
  for (const team of TEAMS) {
    if (!num(hours[team])) push(`${label}: ore ${team} non valide`);
  }
}
