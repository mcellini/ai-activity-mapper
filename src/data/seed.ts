import type { Activity, SubTask, AppState, Client, ClientStatus, Person, Seniority, TeamId } from "@/types";

type Opt = "tools" | "dependencies" | "notes" | "confidence" | "riskLevel" | "humanControl" | "dependsOn" | "area" | "runsPerMonth" | "hoursPerRun" | "subtasks";
type A = Omit<Activity, Opt> & Partial<Pick<Activity, Opt>>;
const st = (id: string, name: string, hours: number, treatment: SubTask["treatment"], pctSaved: number): SubTask => ({ id, name, hours, treatment, pctSaved });
const act = (a: A): Activity => ({
  tools: "", dependencies: "", notes: "", confidence: "stima", riskLevel: "nd", humanControl: "", dependsOn: [],
  area: "delivery", runsPerMonth: 0, hoursPerRun: 0, subtasks: [],
  ...a,
});

// DATI DI ESEMPIO: attività, blocker, tool, persone e clienti sono illustrativi.
// Sostituirli con quelli reali tramite Import JSON o sync Google Sheets.
const activities: Activity[] = [
  act({ id: "a1", teamId: "seo", name: "Keyword research e clustering", workType: "analisi", hoursManual: 40, hoursFreed: 14, hoursReinvested: 12, destination: "nuovi_servizi", pctAutomatable: 50, pctAugmentable: 50, complexity: "medium", tools: "Semrush, Sheets", confidence: "validato", riskLevel: "basso", runsPerMonth: 8, hoursPerRun: 5, subtasks: [st("s1", "Raccolta seed keyword", 4, "automazione", 100), st("s2", "Pulizia e deduplica", 8, "automazione", 75), st("s3", "Clustering per intento", 8, "automazione", 50), st("s4", "Analisi SERP e competitor", 10, "augmentation", 60), st("s5", "Mappatura sul funnel", 5, "augmentation", 60), st("s6", "Priorità per opportunità", 3, "augmentation", 100), st("s7", "Presentazione al cliente", 2, "umano", 0), st("s8", "Keyword per query conversazionali (LLM)", 3, "nuovo", 0), st("s9", "Cluster per prompt tracciati", 2, "nuovo", 0)] }),
  act({ id: "a2", teamId: "seo", name: "Audit tecnico mensile", runsPerMonth: 1, hoursPerRun: 24, workType: "analisi", hoursManual: 24, hoursFreed: 4, hoursReinvested: 8, destination: "qualita", pctAutomatable: 30, pctAugmentable: 50, complexity: "high", tools: "Screaming Frog", dependencies: "Accesso dev", riskLevel: "medio", humanControl: "Verifica tecnica del lead prima dell'invio al cliente" }),
  act({ id: "a3", teamId: "seo", name: "Monitoraggio AI visibility (GEO)", runsPerMonth: 4, hoursPerRun: 4, workType: "analisi", hoursManual: 16, hoursFreed: 9, hoursReinvested: 2, destination: "nuovi_servizi", pctAutomatable: 65, pctAugmentable: 25, complexity: "medium", tools: "SEOcrawl", confidence: "misurato", riskLevel: "basso" }),
  act({ id: "a4", teamId: "content", name: "Brief e outline articoli", workType: "scrittura", hoursManual: 36, hoursFreed: 14, hoursReinvested: 10, destination: "qualita", pctAutomatable: 45, pctAugmentable: 45, complexity: "low", tools: "ChatGPT, Claude", dependencies: "Output SEO", confidence: "misurato", riskLevel: "basso", dependsOn: ["a1"] }),
  act({ id: "a5", teamId: "content", name: "Prima stesura contenuti", workType: "scrittura", hoursManual: 80, hoursFreed: 16, hoursReinvested: 24, destination: "capacita_clienti", pctAutomatable: 25, pctAugmentable: 60, complexity: "medium", tools: "Claude", dependencies: "Brief", notes: "Revisione umana obbligatoria", riskLevel: "medio", humanControl: "Revisione editoriale su ogni contenuto prima della pubblicazione", dependsOn: ["a4"] }),
  act({ id: "a6", teamId: "content", name: "Strategia editoriale", workType: "strategia", hoursManual: 20, hoursFreed: 1, hoursReinvested: 3, destination: "qualita", pctAutomatable: 5, pctAugmentable: 40, complexity: "high", riskLevel: "basso" }),
  act({ id: "a7", teamId: "pr", name: "Media monitoring e rassegna", runsPerMonth: 21, hoursPerRun: 1.4, workType: "analisi", hoursManual: 30, hoursFreed: 22, hoursReinvested: 3, destination: "non_allocata", pctAutomatable: 80, pctAugmentable: 15, complexity: "low", tools: "Talkwalker", riskLevel: "basso" }),
  act({ id: "a8", teamId: "pr", name: "Outreach personalizzato a giornalisti", workType: "relazione", hoursManual: 32, hoursFreed: 6, hoursReinvested: 8, destination: "qualita", pctAutomatable: 30, pctAugmentable: 55, complexity: "medium", dependencies: "Lista contatti", riskLevel: "alto", humanControl: "Ogni pitch letto e firmato da un consulente PR" }),
  act({ id: "a9", teamId: "social", name: "Calendario editoriale e caption", runsPerMonth: 4.3, hoursPerRun: 14, workType: "scrittura", hoursManual: 60, hoursFreed: 18, hoursReinvested: 14, destination: "capacita_clienti", pctAutomatable: 40, pctAugmentable: 50, complexity: "low", tools: "Claude, Planoly", confidence: "misurato", riskLevel: "medio", humanControl: "Approvazione del social lead sui post sensibili" }),
  act({ id: "a10", teamId: "social", name: "Community management", workType: "relazione", hoursManual: 70, hoursFreed: 8, hoursReinvested: 10, destination: "non_allocata", pctAutomatable: 15, pctAugmentable: 40, complexity: "high", notes: "Tono di voce sensibile", riskLevel: "alto", humanControl: "Nessuna risposta automatica su temi sensibili o reclami" }),
  act({ id: "a11", teamId: "design", name: "Adattamento formati creatività", workType: "produzione", hoursManual: 50, hoursFreed: 28, hoursReinvested: 7, destination: "nuovi_servizi", pctAutomatable: 70, pctAugmentable: 20, complexity: "medium", tools: "Figma, Firefly", dependencies: "Key visual", riskLevel: "medio", humanControl: "Controllo brand sul primo formato di ogni campagna" }),
  act({ id: "a12", teamId: "design", name: "Concept creativo", workType: "creativita", hoursManual: 28, hoursFreed: 1, hoursReinvested: 5, destination: "qualita", pctAutomatable: 5, pctAugmentable: 35, complexity: "high", riskLevel: "basso" }),
  act({ id: "g1", teamId: "seo", name: "Sezione SEO/GEO nelle risposte a gara", area: "gare", workType: "scrittura", hoursManual: 30, hoursFreed: 8, hoursReinvested: 6, destination: "qualita", pctAutomatable: 30, pctAugmentable: 45, complexity: "medium", runsPerMonth: 2, hoursPerRun: 15, tools: "Claude" }),
  act({ id: "g2", teamId: "content", name: "Credential e case study per gare", area: "gare", workType: "scrittura", hoursManual: 24, hoursFreed: 6, hoursReinvested: 4, destination: "qualita", pctAutomatable: 30, pctAugmentable: 40, complexity: "low", runsPerMonth: 2, hoursPerRun: 12 }),
  act({ id: "r1", teamId: "social", name: "Formazione e sperimentazione con l'AI", area: "rnd", workType: "strategia", hoursManual: 20, hoursFreed: 0, hoursReinvested: 0, destination: "non_allocata", pctAutomatable: 0, pctAugmentable: 0, complexity: "low", notes: "Tempo investito per imparare, non da risparmiare" }),
  act({ id: "r2", teamId: "seo", name: "Costruzione e manutenzione micro-tool", area: "rnd", workType: "produzione", hoursManual: 16, hoursFreed: 0, hoursReinvested: 0, destination: "non_allocata", pctAutomatable: 0, pctAugmentable: 0, complexity: "medium" }),
];

const teams: TeamId[] = ["seo", "content", "pr", "social", "design"];
const baseline = (t: TeamId) => activities.filter((a) => a.teamId === t && a.area === "delivery").reduce((s, a) => s + a.hoursManual, 0);

/** Domanda del cliente per team = baseline del team * peso * correzione di mix */
const client = (
  id: string, name: string, status: ClientStatus, probability: number, weight: number,
  mix: Partial<Record<TeamId, number>> = {}
): Client => ({
  id, name, status, probability,
  hoursByTeam: Object.fromEntries(
    teams.map((t) => [t, Math.round(baseline(t) * weight * (mix[t] ?? 1))])
  ) as Record<TeamId, number>,
});

const clients: Client[] = [
  client("c1", "Cliente A", "attivo", 100, 0.3),
  client("c2", "Cliente B", "attivo", 100, 0.25, { social: 1.3, design: 0.8 }),
  client("c3", "Cliente C", "attivo", 100, 0.25, { seo: 1.2, pr: 0.7 }),
  client("c4", "Cliente D (rinnovo a rischio)", "attivo", 70, 0.2, { content: 1.2 }),
  client("c5", "Gara E", "gara", 60, 0.22, { seo: 1.4, content: 1.2, pr: 0.6, social: 0.8 }),
  client("c6", "Gara F", "gara", 40, 0.18, { social: 1.5, design: 1.3, seo: 0.6 }),
  client("c7", "Prospect G", "prospect", 25, 0.12, { pr: 1.6, content: 0.8 }),
];

const person = (id: string, name: string, teamId: TeamId, seniority: Seniority, hours: number, aiShare: number | null): Person => ({
  id, name, teamId, seniority, hours, aiShare,
});

const people: Person[] = [
  person("p1", "SEO 1", "seo", "senior", 55, 60),
  person("p2", "SEO 2", "seo", "mid", 40, 25),
  person("p3", "Content 1", "content", "lead", 40, 45),
  person("p4", "Content 2", "content", "mid", 50, 55),
  person("p5", "Content 3", "content", "junior", 45, 20),
  person("p6", "PR 1", "pr", "senior", 40, 30),
  person("p7", "PR 2", "pr", "junior", 30, 10),
  person("p8", "Social 1", "social", "mid", 50, 40),
  person("p9", "Social 2", "social", "mid", 45, 35),
  person("p10", "Social 3", "social", "junior", 40, 15),
  person("p11", "Design 1", "design", "senior", 45, 50),
  person("p12", "Design 2", "design", "mid", 40, 30),
];

export const SEED: AppState = {
  version: 5,
  example: true,
  updatedAt: new Date(0).toISOString(),
  activities,
  blockers: [
    { id: "b1", name: "Accesso ai dati cliente (GA4, GSC)", kind: "dati", severity: "alta", owner: "Account", activityIds: ["a1", "a2", "a3"], need: "dati", cost: 0 },
    { id: "b2", name: "Policy cliente sull'uso di AI generativa", kind: "cliente", severity: "alta", owner: "Account", activityIds: ["a4", "a5", "a8", "a9"], need: "altro", cost: 0 },
    { id: "b3", name: "Brand voice non formalizzato per i GPT", kind: "processo", severity: "media", owner: "Content lead", activityIds: ["a5", "a9", "a10"], need: "processo", cost: 2000 },
    { id: "b4", name: "Licenze AI per media monitoring", kind: "tool", severity: "media", owner: "Operations", activityIds: ["a7", "a8"], need: "account", cost: 1800 },
    { id: "b5", name: "Competenze di prompt design", kind: "competenze", severity: "bassa", owner: "Team lead", activityIds: ["a11", "a12", "a5"], need: "formazione", cost: 3000 },
    { id: "b6", name: "Connettori mancanti tra CMS e strumenti AI", kind: "tool", severity: "media", owner: "Operations", activityIds: ["a5", "a11", "a9"], need: "connettore", cost: 2500 },
  ],
  microTools: [
    { id: "t1", name: "Keyword Clusterer GPT", description: "Raggruppa keyword per intento e restituisce cluster pronti per il brief", status: "adottato", kind: "one_shot", schedule: "", cadence: "on_demand", newTask: "", users: 6, monthlyCost: 20, owner: "SEO", activityIds: ["a1"] },
    { id: "t2", name: "Brief Builder", description: "Genera brief e outline da cluster e linee guida di brand", status: "adottato", kind: "one_shot", schedule: "", cadence: "on_demand", newTask: "", users: 9, monthlyCost: 40, owner: "Content", activityIds: ["a4", "a5"] },
    { id: "t3", name: "AI Visibility Tracker", description: "Controlla citazioni del brand nelle risposte degli LLM", status: "in_uso", kind: "one_shot", schedule: "", cadence: "on_demand", newTask: "", users: 4, monthlyCost: 150, owner: "SEO", activityIds: ["a3"] },
    { id: "t4", name: "Caption Assistant", description: "Varianti di caption per canale e tono di voce", status: "in_uso", kind: "one_shot", schedule: "", cadence: "on_demand", newTask: "", users: 7, monthlyCost: 30, owner: "Social", activityIds: ["a9"] },
    { id: "t5", name: "Rassegna Stampa Summarizer", description: "Sintesi quotidiana delle uscite con sentiment", status: "prototipo", kind: "ricorrente", schedule: "ogni mattina alle 7", cadence: "giornaliera", newTask: "", users: 0, monthlyCost: 60, owner: "Digital PR", activityIds: ["a7"] },
    { id: "t6", name: "Format Resizer", description: "Adatta il key visual a tutti i formati paid e organic", status: "idea", kind: "one_shot", schedule: "", cadence: "on_demand", newTask: "", users: 0, monthlyCost: 0, owner: "Design", activityIds: ["a11"] },
    { id: "t7", name: "Outreach Personalizer", description: "Personalizza pitch su beat e articoli recenti del giornalista", status: "idea", kind: "one_shot", schedule: "", cadence: "on_demand", newTask: "", users: 0, monthlyCost: 0, owner: "Digital PR", activityIds: ["a8"] },
    { id: "t8", name: "Reddit Scout", description: "Scraping dei subreddit di settore ogni mattina, brief automatico e proposta di nuova offerta", status: "idea", kind: "agente", schedule: "ogni mattina", cadence: "giornaliera", newTask: "Ascolto delle conversazioni di settore su Reddit e brief automatico per nuove offerte: oggi non lo facciamo", users: 0, monthlyCost: 0, owner: "SEO", activityIds: ["a6"] },
    { id: "t9", name: "Report Mensile Agent", description: "Raccoglie i dati GEO, scrive la bozza del report e la manda al lead", status: "prototipo", kind: "ricorrente", schedule: "il primo giorno del mese", cadence: "mensile", newTask: "", users: 0, monthlyCost: 25, owner: "SEO", activityIds: ["a3"] },
    { id: "t10", name: "Alert Citazioni LLM", description: "Controlla ogni giorno se il brand perde o guadagna citazioni nelle risposte degli LLM e avvisa il team", status: "prototipo", kind: "agente", schedule: "ogni giorno alle 8", cadence: "giornaliera", newTask: "Allerta sulle variazioni di citazione: prima si guardava solo a fine mese", users: 0, monthlyCost: 40, owner: "SEO", activityIds: ["a3"] },
  ],
  people,
  clients,
  actuals: {
    a1: { "2026-10": 27 },
    a4: { "2026-10": 24 },
    a9: { "2026-10": 45 },
  },
  settings: { hourlyCost: 40, worstThreshold: 80 },
  workflows: [
    {
      id: "w1",
      name: "Pubblicazione articolo blog",
      steps: [
        { id: "s1", name: "Keyword e brief", teams: ["seo", "content"], tools: "Semrush, Claude", automationNote: "Clustering automatico delle keyword", augmentationNote: "Outline suggerita da AI, validata dal content lead", dependencies: "" },
        { id: "s2", name: "Stesura e revisione", teams: ["content"], tools: "Claude", automationNote: "", augmentationNote: "Bozza AI + editing umano", dependencies: "Brief approvato" },
        { id: "s3", name: "Visual e pubblicazione", teams: ["design", "seo"], tools: "Figma, CMS", automationNote: "Resize e alt text automatici", augmentationNote: "", dependencies: "Testo finale" },
      ],
    },
  ],
};

/** Copia del dataset di esempio, con un updatedAt nuovo. Non muta SEED. */
export function sampleState(): AppState {
  const copy = structuredClone(SEED);
  copy.example = true;
  copy.updatedAt = new Date().toISOString();
  return copy;
}

/** Stato vuoto, da usare quando il foglio non ha ancora dati. */
export function emptyState(): AppState {
  return {
    version: 5,
    example: false,
    updatedAt: new Date().toISOString(),
    activities: [],
    workflows: [],
    blockers: [],
    microTools: [],
    people: [],
    clients: [],
    actuals: {},
    settings: { hourlyCost: 40, worstThreshold: 80 },
  };
}
