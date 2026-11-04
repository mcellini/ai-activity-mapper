import type { Activity, SubTask, Treatment, WorkTask } from "@/types";
import { TREATMENTS, sum, uid } from "@/lib/calc";

export const defaultSaved = (t: Treatment) => TREATMENTS.find((x) => x.id === t)?.defaultSaved ?? 0;

export const newSubtask = (): SubTask => ({ id: uid(), name: "Nuovo micro-task", hours: 0, treatment: "umano", pctSaved: 0 });

export function newTask(activity: Activity, order = 0): WorkTask {
  return {
    id: uid(),
    activityId: activity.id,
    name: "Nuovo task",
    notes: "",
    teamId: activity.teamId,
    hours: 0,
    treatment: "umano",
    pctSaved: 0,
    runsPerMonth: activity.runsPerMonth || 0,
    tools: "",
    owner: "",
    order,
  };
}

export function tasksOf(tasks: WorkTask[], activityId: string): WorkTask[] {
  return tasks.filter((t) => t.activityId === activityId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "it"));
}

/** Allinea le ore dell'attività alla somma dei suoi task. Le percentuali dichiarate restano. */
export function syncHours(activity: Activity, tasks: WorkTask[]): Activity {
  const mine = tasksOf(tasks, activity.id);
  if (!mine.length) return { ...activity, subtasks: [] };
  const totals = subtaskTotals(mine.map((t) => ({ id: t.id, name: t.name, hours: t.hours, treatment: t.treatment, pctSaved: t.pctSaved })));
  const manual = r1(totals.manual);
  const freed = Math.min(r1(totals.freed), manual);
  const reinv = Math.min(r1(totals.reinv), r1(Math.max(0, manual - freed)));
  return {
    ...activity,
    subtasks: [],
    hoursManual: manual,
    hoursFreed: freed,
    hoursReinvested: reinv,
    hoursPerRun: activity.runsPerMonth > 0 ? r1(manual / activity.runsPerMonth) : activity.hoursPerRun,
  };
}

/** Quanto dicono i micro-task, ore/mese */
export function subtaskTotals(subs: SubTask[]) {
  const base = subs.filter((s) => s.treatment !== "nuovo");
  const manual = sum(base.map((s) => s.hours));
  const saved = (s: SubTask) => (s.hours * Math.max(0, Math.min(100, s.pctSaved))) / 100;
  const freed = sum(base.filter((s) => s.treatment === "automazione").map(saved));
  const reinv = sum(base.filter((s) => s.treatment === "augmentation").map(saved));
  const newHours = sum(subs.filter((s) => s.treatment === "nuovo").map((s) => s.hours));
  const autoHours = sum(base.filter((s) => s.treatment === "automazione").map((s) => s.hours));
  const augHours = sum(base.filter((s) => s.treatment === "augmentation").map((s) => s.hours));
  return { manual, freed, reinv, newHours, autoHours, augHours };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Riporta i totali dei micro-task sull'attività, mantenendo i vincoli */
export function applySubtasks(a: Activity): Activity {
  const t = subtaskTotals(a.subtasks);
  if (t.manual <= 0) return a;
  const manual = r1(t.manual);
  const freed = Math.min(r1(t.freed), manual);
  const reinv = Math.min(r1(t.reinv), r1(manual - freed));
  const auto = Math.round((t.autoHours / t.manual) * 100);
  const aug = Math.min(100 - auto, Math.round((t.augHours / t.manual) * 100));
  return {
    ...a,
    hoursManual: manual,
    hoursFreed: freed,
    hoursReinvested: reinv,
    pctAutomatable: auto,
    pctAugmentable: aug,
    hoursPerRun: a.runsPerMonth > 0 ? r1(manual / a.runsPerMonth) : a.hoursPerRun,
  };
}

/** Il risparmio dei micro-task è diverso da quello dichiarato sull'attività? */
export function subtaskMismatch(a: Activity): boolean {
  if (!a.subtasks.length) return false;
  const t = subtaskTotals(a.subtasks);
  return (
    Math.abs(t.manual - a.hoursManual) > 0.5 ||
    Math.abs(t.freed - a.hoursFreed) > 0.5 ||
    Math.abs(t.reinv - a.hoursReinvested) > 0.5
  );
}
