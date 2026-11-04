import type { AppState } from "@/types";
import { isToolLive, sum, uncaptured } from "@/lib/calc";

export function metrics(s: AppState) {
  const all = s.activities;
  // R&D e formazione sono tempo investito, non baseline da risparmiare: contati a parte
  const a = all.filter((x) => x.area !== "rnd");
  const rnd = sum(all.filter((x) => x.area === "rnd").map((x) => x.hoursManual));
  const gare = sum(all.filter((x) => x.area === "gare").map((x) => x.hoursManual));
  const newHours = sum((s.tasks ?? []).filter((t) => t.treatment === "nuovo").map((t) => t.hours));
  const manual = sum(a.map((x) => x.hoursManual));
  const freed = sum(a.map((x) => x.hoursFreed));
  const reinv = sum(a.map((x) => x.hoursReinvested));
  const unalloc = sum(a.filter((x) => x.destination === "non_allocata").map((x) => x.hoursFreed));
  const residual = sum(a.map(uncaptured));
  const conf = { stima: 0, misurato: 0, validato: 0 };
  for (const x of a) conf[x.confidence] += x.hoursFreed;
  const live = s.microTools.filter((t) => isToolLive(t.status));
  const toolCost = sum(s.microTools.map((t) => t.monthlyCost));
  const value = freed * s.settings.hourlyCost;
  return {
    n: all.length,
    rnd,
    gare,
    newHours,
    manual,
    freed,
    reinv,
    unalloc,
    residual,
    freedPct: manual ? (freed / manual) * 100 : 0,
    conf,
    solidShare: freed ? ((conf.misurato + conf.validato) / freed) * 100 : 0,
    blockers: s.blockers.length,
    toolsLive: live.length,
    toolUsers: sum(live.map((t) => t.users)),
    toolCost,
    value,
    net: value - toolCost,
  };
}

export type Metrics = ReturnType<typeof metrics>;
