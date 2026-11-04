import type { AppState, Blocker, MicroTool, TeamId } from "@/types";
import { TEAMS, captured, sum, uncaptured } from "@/lib/calc";

export interface TeamToBe {
  teamId: TeamId;
  /** già catturato oggi */
  asIs: number;
  /** potenziale residuo sulle attività con almeno un blocker da sbloccare */
  unlockable: number;
  /** potenziale residuo senza blocker censiti: manca ancora un piano */
  undefined: number;
}

export interface ShoppingRow {
  blocker: Blocker;
  /** ore/mese di potenziale residuo sulle attività collegate */
  unlock: number;
  /** valore mensile in euro delle ore sbloccate */
  valueMonth: number;
  /** mesi per rientrare del costo; null se il costo è zero o il valore è zero */
  payback: number | null;
}

export function toBe(state: AppState) {
  // R&D e formazione sono investimento, non fanno parte del potenziale da catturare
  const acts = state.activities.filter((a) => a.area !== "rnd");
  const blocked = new Set(state.blockers.flatMap((b) => b.activityIds));

  const teams: TeamToBe[] = TEAMS.map((t) => {
    const items = acts.filter((a) => a.teamId === t.id);
    return {
      teamId: t.id,
      asIs: sum(items.map(captured)),
      unlockable: sum(items.filter((a) => blocked.has(a.id)).map(uncaptured)),
      undefined: sum(items.filter((a) => !blocked.has(a.id)).map(uncaptured)),
    };
  });

  const cost = state.settings.hourlyCost;
  const rows: ShoppingRow[] = state.blockers
    .map((b) => {
      const unlock = sum(acts.filter((a) => b.activityIds.includes(a.id)).map(uncaptured));
      const valueMonth = unlock * cost;
      return { blocker: b, unlock, valueMonth, payback: b.cost > 0 && valueMonth > 0 ? b.cost / valueMonth : null };
    })
    .sort((x, y) => {
      const xf = x.blocker.cost === 0 ? 0 : 1;
      const yf = y.blocker.cost === 0 ? 0 : 1;
      if (xf !== yf) return xf - yf;
      if (xf === 0) return y.unlock - x.unlock;
      return (x.payback ?? Infinity) - (y.payback ?? Infinity);
    });

  // ore uniche sbloccabili: più blocker sulla stessa attività non vanno sommati due volte
  const unionIds = new Set(state.blockers.flatMap((b) => b.activityIds));
  const uniqueUnlock = sum(acts.filter((a) => unionIds.has(a.id)).map(uncaptured));
  const totalCost = sum(state.blockers.map((b) => b.cost));
  const valueMonth = uniqueUnlock * cost;

  const recurring: (MicroTool & { potential: number })[] = state.microTools
    .filter((t) => t.kind !== "one_shot")
    .map((t) => ({ ...t, potential: sum(acts.filter((a) => t.activityIds.includes(a.id)).map(uncaptured)) }));

  return {
    teams,
    rows,
    recurring,
    asIs: sum(teams.map((t) => t.asIs)),
    unlockable: sum(teams.map((t) => t.unlockable)),
    undefinedHours: sum(teams.map((t) => t.undefined)),
    uniqueUnlock,
    totalCost,
    valueMonth,
    payback: totalCost > 0 && valueMonth > 0 ? totalCost / valueMonth : null,
  };
}

export type ToBe = ReturnType<typeof toBe>;
