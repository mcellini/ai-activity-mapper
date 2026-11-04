import type {
  Activity, Area, BlockerKind, Complexity, Confidence, Destination, RiskLevel, Seniority,
  Cadence, Need, Severity, ToolKind, ToolStatus, Treatment, WorkType,
} from "@/types";

export const TEAMS = [
  { id: "seo", name: "SEO / GEO", color: "#4f46e5" },
  { id: "content", name: "Content", color: "#0891b2" },
  { id: "pr", name: "Digital PR", color: "#d97706" },
  { id: "social", name: "Social Media", color: "#db2777" },
  { id: "design", name: "Design", color: "#16a34a" },
] as const;

export const teamById = (id: string) => TEAMS.find((t) => t.id === id) ?? TEAMS[0];

export const WORK_TYPES: { id: WorkType; label: string }[] = [
  { id: "analisi", label: "Analisi" },
  { id: "scrittura", label: "Scrittura" },
  { id: "creativita", label: "Creatività" },
  { id: "relazione", label: "Relazione col cliente / stakeholder" },
  { id: "produzione", label: "Produzione operativa" },
  { id: "strategia", label: "Strategia" },
];
export const workTypeLabel = (id: WorkType) => WORK_TYPES.find((w) => w.id === id)?.label ?? id;

/** Punto di partenza prudente per le % quando si crea una nuova attività: va corretto dal team. */
export const WORK_DEFAULTS: Record<WorkType, { auto: number; aug: number }> = {
  analisi: { auto: 50, aug: 35 },
  scrittura: { auto: 35, aug: 50 },
  creativita: { auto: 10, aug: 40 },
  relazione: { auto: 15, aug: 40 },
  produzione: { auto: 65, aug: 25 },
  strategia: { auto: 5, aug: 35 },
};

export const DESTINATIONS: { id: Destination; label: string; color: string }[] = [
  { id: "nuovi_servizi", label: "Nuovi servizi", color: "#4f46e5" },
  { id: "qualita", label: "Qualità e profondità", color: "#0891b2" },
  { id: "capacita_clienti", label: "Capacità per nuovi clienti", color: "#16a34a" },
  { id: "non_allocata", label: "Da classificare", color: "#f59e0b" },
];
export const destLabel = (id: Destination) => DESTINATIONS.find((d) => d.id === id)?.label ?? id;

export const CONFIDENCE: { id: Confidence; label: string; color: string }[] = [
  { id: "stima", label: "Stima del team", color: "#94a3b8" },
  { id: "misurato", label: "Misurato", color: "#0891b2" },
  { id: "validato", label: "Validato dal lead", color: "#16a34a" },
];
export const confLabel = (id: Confidence) => CONFIDENCE.find((c) => c.id === id)?.label ?? id;

export const RISK_LABEL: Record<RiskLevel, string> = {
  nd: "Da valutare",
  basso: "Basso",
  medio: "Medio",
  alto: "Alto",
};

export const BLOCKER_KINDS: { id: BlockerKind; label: string }[] = [
  { id: "dati", label: "Dati / accessi" },
  { id: "tool", label: "Tool / licenze" },
  { id: "competenze", label: "Competenze" },
  { id: "processo", label: "Processo" },
  { id: "cliente", label: "Cliente / policy" },
];
export const SEVERITIES: Severity[] = ["bassa", "media", "alta"];

export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  idea: "Idea",
  prototipo: "Prototipo",
  in_uso: "In uso",
  adottato: "Adottato",
};
export const TOOL_STATUSES: ToolStatus[] = ["idea", "prototipo", "in_uso", "adottato"];
export const isToolLive = (s: ToolStatus) => s === "in_uso" || s === "adottato";

export const SENIORITIES: Seniority[] = ["junior", "mid", "senior", "lead"];

export const COMPLEXITY_LABEL: Record<Complexity, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

const EFFORT: Record<Complexity, number> = { low: 1, medium: 2, high: 3 };

export const pctHuman = (a: Activity) =>
  Math.max(0, 100 - a.pctAutomatable - a.pctAugmentable);

/** ore catturate oggi (liberate + potenziate) */
export const captured = (a: Activity) => a.hoursFreed + a.hoursReinvested;

/** potenziale totale in ore/mese, dalle % dichiarate */
export const potentialHours = (a: Activity) =>
  (a.hoursManual * (a.pctAutomatable + a.pctAugmentable)) / 100;

/** potenziale non ancora catturato */
export const uncaptured = (a: Activity) => Math.max(0, potentialHours(a) - captured(a));

export type Quadrant = "Full AI" | "Automate" | "Augmented" | "Human Core";

/** Quadranti della matrice: soglia al 50% su entrambi gli assi */
export function quadrant(a: Activity): Quadrant {
  const auto = a.pctAutomatable >= 50;
  const aug = a.pctAugmentable >= 50;
  if (auto && aug) return "Full AI";
  if (auto) return "Automate";
  if (aug) return "Augmented";
  return "Human Core";
}

export type Phase = "Quick win" | "Strategico" | "Opportunistico" | "Da rivalutare";

/**
 * Roadmap: impatto = ore ancora catturabili (vs mediana);
 * sforzo = complessità + numero di blocker collegati.
 */
export function phase(a: Activity, medianUncaptured: number, nBlockers: number): Phase {
  const highImpact = uncaptured(a) >= medianUncaptured && uncaptured(a) > 0;
  const lowEffort = EFFORT[a.complexity] + nBlockers <= 2;
  if (highImpact && lowEffort) return "Quick win";
  if (highImpact) return "Strategico";
  if (lowEffort) return "Opportunistico";
  return "Da rivalutare";
}

export const PHASE_ORDER: Phase[] = [
  "Quick win",
  "Strategico",
  "Opportunistico",
  "Da rivalutare",
];

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

export const fmt = (n: number, d = 0) =>
  n.toLocaleString("it-IT", { maximumFractionDigits: d, minimumFractionDigits: d });

export const eur = (n: number) =>
  n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const uid = () => Math.random().toString(36).slice(2, 10);

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const AREAS: { id: Area; label: string; short: string }[] = [
  { id: "delivery", label: "Delivery ricorrente", short: "Delivery" },
  { id: "gare", label: "Gare e biz dev", short: "Gare" },
  { id: "rnd", label: "R&D e formazione", short: "R&D" },
];
export const areaLabel = (id: Area) => AREAS.find((a) => a.id === id)?.short ?? id;

export const NEEDS: { id: Need; label: string }[] = [
  { id: "connettore", label: "Connettore / integrazione" },
  { id: "account", label: "Account o licenze" },
  { id: "formazione", label: "Formazione" },
  { id: "budget", label: "Budget" },
  { id: "dati", label: "Accesso ai dati" },
  { id: "processo", label: "Processo / policy" },
  { id: "altro", label: "Altro" },
];
export const needLabel = (id: Need) => NEEDS.find((n) => n.id === id)?.label ?? id;

export const TOOL_KINDS: { id: ToolKind; label: string }[] = [
  { id: "one_shot", label: "One-shot" },
  { id: "ricorrente", label: "Ricorrente (cron)" },
  { id: "agente", label: "Agente" },
];
export const toolKindLabel = (id: ToolKind) => TOOL_KINDS.find((k) => k.id === id)?.label ?? id;

export const TREATMENTS: { id: Treatment; label: string; defaultSaved: number }[] = [
  { id: "umano", label: "Resta umano", defaultSaved: 0 },
  { id: "automazione", label: "Automatizzato", defaultSaved: 100 },
  { id: "augmentation", label: "Aumentato", defaultSaved: 40 },
  { id: "nuovo", label: "Nuovo grazie all'AI", defaultSaved: 0 },
];

export const FREQUENCIES: { id: string; label: string; runs: number }[] = [
  { id: "giornaliera", label: "Ogni giorno", runs: 21 },
  { id: "settimanale", label: "Ogni settimana", runs: 4.3 },
  { id: "mensile", label: "Ogni mese", runs: 1 },
  { id: "trimestrale", label: "Ogni trimestre", runs: 0.33 },
  { id: "annuale", label: "Una volta l'anno", runs: 0.083 },
];
/** Etichetta leggibile della frequenza a partire dalle esecuzioni/mese */
export function frequencyLabel(runs: number): string {
  if (!runs) return "n.d.";
  const hit = FREQUENCIES.find((f) => Math.abs(f.runs - runs) < 0.01);
  if (hit) return hit.label;
  return runs >= 1 ? `${fmt(runs, 1)} volte/mese` : `1 volta ogni ${fmt(1 / runs, 1)} mesi`;
}

export const CADENCES: { id: Cadence; label: string }[] = [
  { id: "giornaliera", label: "Ogni giorno" },
  { id: "settimanale", label: "Ogni settimana" },
  { id: "mensile", label: "Ogni mese" },
  { id: "on_demand", label: "Su richiesta" },
];
