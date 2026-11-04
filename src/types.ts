export type TeamId = "seo" | "content" | "pr" | "social" | "design";
export type Complexity = "low" | "medium" | "high";

/** Tipo di lavoro: dove si genera il risparmio */
export type WorkType =
  | "analisi"
  | "scrittura"
  | "creativita"
  | "relazione"
  | "produzione"
  | "strategia";

/** Destinazione dichiarata delle ore liberate dall'automazione */
export type Destination =
  | "nuovi_servizi"
  | "qualita"
  | "capacita_clienti"
  | "non_allocata";

/** Quanto è solido un numero */
export type Confidence = "stima" | "misurato" | "validato";
export type RiskLevel = "nd" | "basso" | "medio" | "alto";

export type BlockerKind = "dati" | "tool" | "competenze" | "processo" | "cliente";
export type Severity = "bassa" | "media" | "alta";
/** Maturità di un micro-tool: dall'idea all'uso reale */
export type ToolStatus = "idea" | "prototipo" | "in_uso" | "adottato";

/** Cosa è l'attività: lavoro ricorrente di delivery, gare e biz dev, oppure R&D e formazione */
export type Area = "delivery" | "gare" | "rnd";

/** Cosa serve per sbloccare un limite (lista della spesa del TO-BE) */
export type Need = "connettore" | "account" | "formazione" | "budget" | "dati" | "processo" | "altro";

/** One-shot, ricorrente (cron) o agente che gira da solo */
export type ToolKind = "one_shot" | "ricorrente" | "agente";

/** Ogni quanto gira una routine o un agente */
export type Cadence = "on_demand" | "giornaliera" | "settimanale" | "mensile";

/** Come viene trattato un micro-task */
export type Treatment = "umano" | "automazione" | "augmentation" | "nuovo";

export type Seniority = "junior" | "mid" | "senior" | "lead";
export type ClientStatus = "attivo" | "gara" | "prospect";

export interface Team {
  id: TeamId;
  name: string;
  color: string;
}

/** Micro-task dentro una macro-attività (es. keyword research -> 7 micro-task) */
export interface SubTask {
  id: string;
  name: string;
  /** ore/mese del micro-task; per "nuovo" sono le ore/mese di lavoro che prima non esisteva */
  hours: number;
  treatment: Treatment;
  /** % di ore risparmiate (automazione: tipicamente 100, augmentation: meno) */
  pctSaved: number;
}

export interface Activity {
  id: string;
  teamId: TeamId;
  name: string;
  workType: WorkType;
  area: Area;
  /** esecuzioni al mese (0 = non indicata): 21 = giornaliera, 4.3 = settimanale, 1 = mensile, 0.083 = annuale */
  runsPerMonth: number;
  /** ore per singola esecuzione (0 = non indicata) */
  hoursPerRun: number;
  /** micro-task: se presenti, spiegano come nascono ore liberate e reinvestite */
  subtasks: SubTask[];
  /** ore/mese svolte oggi manualmente (baseline) */
  hoursManual: number;
  /** AUTOMATION: ore/mese che spariscono davvero dall'attività */
  hoursFreed: number;
  /** AUGMENTATION: ore/mese che restano sull'attività ma producono più qualità/output */
  hoursReinvested: number;
  /** dove vanno le ore liberate */
  destination: Destination;
  /** solidità dei numeri di questa attività */
  confidence: Confidence;
  /** % del task che l'AI può eseguire end-to-end */
  pctAutomatable: number;
  /** % del task in cui l'AI migliora velocità/qualità ma serve l'umano */
  pctAugmentable: number;
  complexity: Complexity;
  riskLevel: RiskLevel;
  /** controllo umano richiesto per ridurre il rischio */
  humanControl: string;
  /** attività che devono essere sistemate prima di questa */
  dependsOn: string[];
  /** tool di terze parti usati (testo libero) */
  tools: string;
  dependencies: string;
  notes: string;
}

export interface Blocker {
  id: string;
  name: string;
  kind: BlockerKind;
  severity: Severity;
  owner: string;
  activityIds: string[];
  /** cosa serve per sbloccarlo */
  need: Need;
  /** costo una tantum stimato per sbloccarlo, euro */
  cost: number;
}

export interface MicroTool {
  id: string;
  name: string;
  description: string;
  status: ToolStatus;
  kind: ToolKind;
  /** per ricorrenti e agenti: quando gira (es. "ogni mattina alle 7") */
  schedule: string;
  cadence: Cadence;
  /** cosa fa che prima non facevamo (vuoto = sostituisce lavoro che già esisteva) */
  newTask: string;
  /** persone che lo usano davvero */
  users: number;
  /** licenze + token, euro/mese */
  monthlyCost: number;
  owner: string;
  activityIds: string[];
}

export interface Person {
  id: string;
  name: string;
  teamId: TeamId;
  seniority: Seniority;
  /** ore/mese disponibili sulle attività mappate */
  hours: number;
  /** % del proprio tempo in cui usa davvero l'AI (null = non rilevata) */
  aiShare: number | null;
}

export interface Client {
  id: string;
  name: string;
  status: ClientStatus;
  /** probabilità (0-100) che il cliente sia attivo nel 2027 */
  probability: number;
  /** domanda baseline (pre-AI) in ore/mese, per team */
  hoursByTeam: Record<TeamId, number>;
}

export interface Settings {
  /** ipotesi: costo orario medio, euro */
  hourlyCost: number;
  /** nello scenario worst restano solo i clienti con probabilità >= soglia */
  worstThreshold: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  teams: TeamId[];
  tools: string;
  automationNote: string;
  augmentationNote: string;
  dependencies: string;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

export interface AppState {
  version: 5;
  activities: Activity[];
  workflows: Workflow[];
  blockers: Blocker[];
  microTools: MicroTool[];
  people: Person[];
  clients: Client[];
  /** ore reali misurate: activityId -> mese (YYYY-MM) -> ore */
  actuals: Record<string, Record<string, number>>;
  settings: Settings;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  label: string;
  date: string;
  state: AppState;
}

export type SyncStatus = "off" | "idle" | "saving" | "saved" | "error";
