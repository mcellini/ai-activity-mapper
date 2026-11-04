import type { Activity, AppState, Client, Person, TeamId } from "@/types";
import { TEAMS, sum } from "@/lib/calc";

export type Scenario = "worst" | "base" | "best";

export const SCENARIOS: { id: Scenario; label: string; desc: string }[] = [
  { id: "worst", label: "Worst case", desc: "Restano solo i clienti con probabilità sopra la soglia; gare e prospect persi" },
  { id: "base", label: "Base (probabilistico)", desc: "Ogni cliente pesa per la sua probabilità" },
  { id: "best", label: "Best case", desc: "Tutti i clienti con probabilità maggiore di zero vengono confermati o vinti" },
];

/** Peso di un cliente in uno scenario (0..1) */
export function clientWeight(c: Client, s: Scenario, worstThreshold: number): number {
  if (s === "worst") return c.probability >= worstThreshold ? 1 : 0;
  if (s === "best") return c.probability > 0 ? 1 : 0;
  return Math.max(0, Math.min(100, c.probability)) / 100;
}

/** Quota di ore del team che l'AI libera (liberate / baseline), limitata a 1 */
export function teamReduction(activities: Activity[], teamId: TeamId): number {
  // R&D e formazione sono investimento: non fanno parte del lavoro che l'AI riduce
  const items = activities.filter((a) => a.teamId === teamId && a.area !== "rnd");
  const manual = sum(items.map((a) => a.hoursManual));
  const freed = sum(items.map((a) => a.hoursFreed));
  return manual > 0 ? Math.min(1, freed / manual) : 0;
}

export const teamCapacity = (people: Person[], teamId: TeamId) =>
  sum(people.filter((p) => p.teamId === teamId).map((p) => p.hours));

/** Ore medie per persona; se il team è vuoto usa 100 h come riferimento per convertire in persone */
export function avgCapacity(people: Person[], teamId: TeamId): number {
  const ps = people.filter((p) => p.teamId === teamId);
  return ps.length ? sum(ps.map((p) => p.hours)) / ps.length : 100;
}

export interface Cell {
  capacity: number;
  /** domanda baseline pesata, senza AI */
  demand: number;
  /** domanda dopo l'AI, con la quota di cattura scelta */
  demandAI: number;
  /** ore mancanti (>0) o in eccesso (<0) */
  gap: number;
  gapAI: number;
  /** stessa cosa in persone */
  people: number;
  peopleAI: number;
}

export function computeScenario(
  state: AppState,
  scenario: Scenario,
  capturePct: number
): Record<TeamId, Cell> {
  const out = {} as Record<TeamId, Cell>;
  for (const t of TEAMS) {
    const demand = sum(
      state.clients.map(
        (c) => clientWeight(c, scenario, state.settings.worstThreshold) * (c.hoursByTeam[t.id] ?? 0)
      )
    );
    const demandAI = demand * (1 - (capturePct / 100) * teamReduction(state.activities, t.id));
    const capacity = teamCapacity(state.people, t.id);
    const avg = avgCapacity(state.people, t.id);
    out[t.id] = {
      capacity,
      demand,
      demandAI,
      gap: demand - capacity,
      gapAI: demandAI - capacity,
      people: (demand - capacity) / avg,
      peopleAI: (demandAI - capacity) / avg,
    };
  }
  return out;
}

export function totals(cells: Record<TeamId, Cell>) {
  const list = Object.values(cells);
  return {
    capacity: sum(list.map((c) => c.capacity)),
    demand: sum(list.map((c) => c.demand)),
    demandAI: sum(list.map((c) => c.demandAI)),
    people: sum(list.map((c) => c.people)),
    peopleAI: sum(list.map((c) => c.peopleAI)),
  };
}

export interface ClientImpact {
  client: Client;
  /** persone equivalenti richieste dal cliente, senza AI */
  people: number;
  /** persone equivalenti dopo l'AI */
  peopleAI: number;
  /** contributo atteso = probabilità × persone con AI */
  expected: number;
}

/** Quanto pesa ogni cliente in persone equivalenti, ordinato per contributo atteso */
export function clientImpacts(state: AppState, capturePct: number): ClientImpact[] {
  const out = state.clients.map((c) => {
    let people = 0;
    let peopleAI = 0;
    for (const t of TEAMS) {
      const h = c.hoursByTeam[t.id] ?? 0;
      const avg = avgCapacity(state.people, t.id);
      people += h / avg;
      peopleAI += (h * (1 - (capturePct / 100) * teamReduction(state.activities, t.id))) / avg;
    }
    const p = Math.max(0, Math.min(100, c.probability)) / 100;
    return { client: c, people, peopleAI, expected: peopleAI * p };
  });
  return out.sort((a, b) => b.expected - a.expected);
}
