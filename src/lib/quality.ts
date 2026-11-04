import type { AppState } from "@/types";
import { subtaskMismatch } from "@/lib/subtasks";
import { TEAMS, isToolLive, median, potentialHours, captured, sum, uncaptured } from "@/lib/calc";

export type IssueLevel = "alta" | "media" | "bassa";

export interface Issue {
  id: string;
  level: IssueLevel;
  text: string;
  /** tab dove si corregge */
  tab: string;
}

/** Attività che, seguendo le dipendenze, tornano su se stesse */
function cyclic(s: AppState): string[] {
  const deps = new Map(s.activities.map((a) => [a.id, a.dependsOn]));
  const bad: string[] = [];
  for (const a of s.activities) {
    const seen = new Set<string>();
    const stack = [...(deps.get(a.id) ?? [])];
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === a.id) {
        bad.push(a.id);
        break;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(deps.get(id) ?? []));
    }
  }
  return bad;
}

export function runChecks(s: AppState): Issue[] {
  const out: Issue[] = [];
  const name = new Map(s.activities.map((a) => [a.id, a.name]));
  const med = median(s.activities.map(uncaptured));

  // incoerenze nei numeri
  for (const a of s.activities) {
    if (captured(a) > potentialHours(a) + 0.5) {
      out.push({
        id: `over-${a.id}`, level: "alta", tab: "Teams",
        text: `${a.name}: ore catturate (${captured(a)} h) superiori al potenziale dichiarato (${Math.round(potentialHours(a))} h). Alza le percentuali o riduci le ore.`,
      });
    }
    if (a.riskLevel === "alto" && !a.humanControl.trim()) {
      out.push({
        id: `ctl-${a.id}`, level: "alta", tab: "Teams",
        text: `${a.name}: rischio alto senza controllo umano definito.`,
      });
    }
    if (a.hoursFreed > 0 && a.destination === "non_allocata") {
      out.push({
        id: `dest-${a.id}`, level: "media", tab: "Teams",
        text: `${a.name}: ${a.hoursFreed} h liberate da classificare: dove sono state reinvestite?`,
      });
    }
    if (a.confidence === "stima" && a.hoursFreed >= 10) {
      out.push({
        id: `est-${a.id}`, level: "media", tab: "Misurazione",
        text: `${a.name}: ${a.hoursFreed} h liberate basate solo su stima. Da misurare.`,
      });
    }
    if (subtaskMismatch(a)) {
      out.push({
        id: `sub-${a.id}`, level: "media", tab: "Teams",
        text: `${a.name}: i micro-task non tornano con le ore dichiarate sull'attività. Apri il dettaglio e usa «Applica».`,
      });
    }
    if (a.runsPerMonth > 0 && a.hoursPerRun > 0 && Math.abs(a.runsPerMonth * a.hoursPerRun - a.hoursManual) > Math.max(1, a.hoursManual * 0.1)) {
      out.push({
        id: `freq-${a.id}`, level: "media", tab: "Teams",
        text: `${a.name}: frequenza × ore per esecuzione (${Math.round(a.runsPerMonth * a.hoursPerRun)} h) non coincide con le ore manuali (${a.hoursManual} h).`,
      });
    }
    const hasBlocker = s.blockers.some((b) => b.activityIds.includes(a.id));
    const hasTool = s.microTools.some((t) => t.activityIds.includes(a.id));
    if (uncaptured(a) >= med && uncaptured(a) > 0 && !hasBlocker && !hasTool) {
      out.push({
        id: `plan-${a.id}`, level: "bassa", tab: "Collegamenti",
        text: `${a.name}: potenziale residuo alto ma nessun tool né blocker collegato. Manca un piano.`,
      });
    }
  }
  const noFreq = s.activities.filter((a) => a.area !== "rnd" && a.runsPerMonth === 0).length;
  if (noFreq > 0) {
    out.push({ id: "freq-nd", level: "bassa", tab: "Teams", text: `${noFreq} attività senza frequenza: non si vede quali pesano di più perché si ripetono spesso.` });
  }
  const noRnd = s.activities.every((a) => a.area !== "rnd");
  if (s.activities.length > 0 && noRnd) {
    out.push({ id: "no-rnd", level: "bassa", tab: "Teams", text: "Nessuna voce di R&D e formazione: il tempo per imparare e costruire tool non è mappato." });
  }
  const noRisk = s.activities.filter((a) => a.riskLevel === "nd").length;
  if (noRisk > 0) {
    out.push({
      id: "risk-nd", level: "bassa", tab: "Teams",
      text: `${noRisk} attività senza valutazione del rischio.`,
    });
  }

  const loop = cyclic(s);
  if (loop.length) {
    out.push({
      id: "cycle", level: "alta", tab: "Teams",
      text: `Dipendenze circolari tra attività: ${loop.map((id) => name.get(id)).join(", ")}.`,
    });
  }

  // tool e blocker
  for (const t of s.microTools) {
    if (isToolLive(t.status) && t.users === 0) {
      out.push({ id: `tu-${t.id}`, level: "media", tab: "Collegamenti", text: `${t.name}: segnato come in uso ma senza utenti attivi.` });
    }
    if (t.activityIds.length === 0) {
      out.push({ id: `tn-${t.id}`, level: "bassa", tab: "Collegamenti", text: `${t.name}: nessuna attività collegata.` });
    }
  }
  for (const t of s.microTools) {
    if (t.kind !== "one_shot" && !t.schedule.trim()) {
      out.push({ id: `sch-${t.id}`, level: "bassa", tab: "Collegamenti", text: `${t.name}: automazione ${t.kind === "agente" ? "con agente" : "ricorrente"} senza indicare quando gira.` });
    }
  }
  for (const b of s.blockers) {
    if (b.need !== "altro" && b.need !== "dati" && b.need !== "processo" && b.cost === 0 && b.activityIds.length > 0 && b.severity !== "bassa") {
      out.push({ id: `bcost-${b.id}`, level: "bassa", tab: "Collegamenti", text: `Blocker «${b.name}»: serve ${b.need} ma il costo è zero. Il TO-BE lo tratta come gratuito.` });
    }
    if (b.activityIds.length === 0) {
      out.push({ id: `bn-${b.id}`, level: "bassa", tab: "Collegamenti", text: `Blocker «${b.name}» senza attività collegate.` });
    }
    if (!b.owner.trim() && b.severity !== "bassa") {
      out.push({ id: `bo-${b.id}`, level: "media", tab: "Collegamenti", text: `Blocker «${b.name}» di gravità ${b.severity} senza owner.` });
    }
  }

  // staffing
  for (const t of TEAMS) {
    const demand = sum(s.clients.map((c) => c.hoursByTeam[t.id] ?? 0));
    const people = s.people.filter((p) => p.teamId === t.id).length;
    if (demand > 0 && people === 0) {
      out.push({ id: `nopeople-${t.id}`, level: "alta", tab: "Staffing", text: `${t.name}: domanda dei clienti ma nessuna persona inserita.` });
    }
  }
  for (const c of s.clients) {
    if (sum(Object.values(c.hoursByTeam)) === 0) {
      out.push({ id: `cl-${c.id}`, level: "media", tab: "Staffing", text: `${c.name}: nessuna ora di domanda inserita.` });
    }
  }
  const noShare = s.people.filter((p) => p.aiShare === null).length;
  if (s.people.length > 0 && noShare > 0) {
    out.push({ id: "share-nd", level: "bassa", tab: "Staffing", text: `${noShare} persone senza adozione AI rilevata: la cattura nello staffing resta un'ipotesi.` });
  }
  if (s.clients.length === 0) {
    out.push({ id: "noclients", level: "media", tab: "Staffing", text: "Nessun cliente inserito: gli scenari di staffing 2027 non hanno dati." });
  }

  const order: Record<IssueLevel, number> = { alta: 0, media: 1, bassa: 2 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}
