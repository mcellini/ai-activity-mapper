import { useState } from "react";
import type { Activity, Area, Complexity, Destination, RiskLevel, TeamId, WorkType } from "@/types";
import Dialog from "./Dialog";
import {
  AREAS, COMPLEXITY_LABEL, DESTINATIONS, FREQUENCIES, RISK_LABEL, TEAMS, WORK_DEFAULTS, WORK_TYPES, fmt, uid,
} from "@/lib/calc";

interface Props {
  defaultTeam: TeamId;
  onCreate: (a: Activity) => void;
  onClose: () => void;
}

const STEPS = ["Cos'è", "Quanto tempo", "Quanta AI", "Rischio e ostacoli"];

export default function Wizard({ defaultTeam, onCreate, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState<TeamId>(defaultTeam);
  const [workType, setWorkType] = useState<WorkType>("produzione");
  const [area, setArea] = useState<Area>("delivery");
  const [freq, setFreq] = useState("");
  const [perRun, setPerRun] = useState(0);
  const [monthly, setMonthly] = useState(20);
  const runs = FREQUENCIES.find((x) => x.id === freq)?.runs ?? 0;
  // se frequenza e ore per esecuzione sono note, le ore al mese ne derivano
  const hours = runs > 0 && perRun > 0 ? Math.round(runs * perRun * 10) / 10 : monthly;
  const [auto, setAuto] = useState(WORK_DEFAULTS.produzione.auto);
  const [aug, setAug] = useState(WORK_DEFAULTS.produzione.aug);
  const [freed, setFreed] = useState<number | null>(null);
  const [reinv, setReinv] = useState<number | null>(null);
  const [destination, setDestination] = useState<Destination>("non_allocata");
  const [complexity, setComplexity] = useState<Complexity>("medium");
  const [risk, setRisk] = useState<RiskLevel>("nd");
  const [control, setControl] = useState("");
  const [tools, setTools] = useState("");

  // prima ipotesi prudente: metà del potenziale dichiarato
  const sugFreed = Math.round((hours * auto) / 100 / 2);
  const sugReinv = Math.round((hours * aug) / 100 / 2);
  const f = Math.min(freed ?? sugFreed, hours);
  const r = Math.min(reinv ?? sugReinv, hours - f);

  const pickType = (w: WorkType) => {
    setWorkType(w);
    setAuto(WORK_DEFAULTS[w].auto);
    setAug(WORK_DEFAULTS[w].aug);
    setFreed(null);
    setReinv(null);
  };

  const create = () =>
    onCreate({
      id: uid(), teamId, name: name.trim() || "Nuova attività", workType, hoursManual: hours,
      hoursFreed: f, hoursReinvested: r, destination, confidence: "stima",
      pctAutomatable: auto, pctAugmentable: aug, complexity, riskLevel: risk, humanControl: control,
      dependsOn: [], area, runsPerMonth: runs, hoursPerRun: runs > 0 ? (perRun > 0 ? perRun : Math.round((hours / runs) * 10) / 10) : 0, subtasks: [], tools, dependencies: "", notes: "",
    });

  return (
    <Dialog title="Nuova attività" onClose={onClose}>
        <div>
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-indigo-600" : "bg-slate-200"}`} />
            ))}
          </div>
          <div className="mt-1 text-xs text-slate-500">Passo {step + 1} di {STEPS.length}: {STEPS[step]}</div>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <label className="block"><span className="label">Nome dell'attività</span>
              <input id="wz-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Report mensile di performance" />
            </label>
            <label className="block"><span className="label">Team</span>
              <select id="wz-team" className="input" value={teamId} onChange={(e) => setTeamId(e.target.value as TeamId)}>
                {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Area di lavoro</span>
              <select id="wz-area" className="input" value={area} onChange={(e) => setArea(e.target.value as Area)}>
                {AREAS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Tipo di lavoro</span>
              <select id="wz-wt" className="input" value={workType} onChange={(e) => pickType(e.target.value as WorkType)}>
                {WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="rounded-lg bg-indigo-50 p-2 text-xs text-indigo-800">
              Quante volte si fa conta tanto quanto la durata: un'attività giornaliera da 1 ora e una annuale da 12 ore hanno ore diverse e vanno automatizzate in modo diverso.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Ogni quanto si ripete</span>
                <select id="wz-freq" className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
                  <option value="">Non lo so / varia</option>
                  {FREQUENCIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </label>
              <label><span className="label">Ore per esecuzione</span>
                <input id="wz-perrun" type="number" min={0} step={0.5} className="input" disabled={!freq} value={perRun} onChange={(e) => setPerRun(Math.max(0, +e.target.value))} />
              </label>
            </div>
            {runs > 0 && perRun > 0 ? (
              <p className="text-sm text-slate-700">{fmt(runs, 1)} volte al mese × {fmt(perRun, 1)} h = <b>{fmt(hours, 1)} h/mese</b></p>
            ) : (
              <label className="block"><span className="label">Ore al mese che richiede oggi (baseline)</span>
                <input id="wz-hours" type="number" min={0} className="input" value={monthly} onChange={(e) => setMonthly(Math.max(0, +e.target.value))} />
                <span className="mt-1 block text-xs text-slate-500">Ore totali del team su questa attività, senza AI.</span>
              </label>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="rounded-lg bg-indigo-50 p-2 text-xs text-indigo-800">
              Punto di partenza tipico per «{WORK_TYPES.find((w) => w.id === workType)?.label}». Non è una misura: correggilo con chi fa il lavoro.
            </p>
            <label className="block"><span className="label">% automatizzabile ({auto})</span>
              <input type="range" min={0} max={100} step={5} className="w-full" value={auto} onChange={(e) => { setAuto(Math.min(+e.target.value, 100 - aug)); setFreed(null); }} />
            </label>
            <label className="block"><span className="label">% aumentabile ({aug})</span>
              <input type="range" min={0} max={100} step={5} className="w-full" value={aug} onChange={(e) => { setAug(Math.min(+e.target.value, 100 - auto)); setReinv(null); }} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label text-emerald-600">Ore liberate oggi</span>
                <input id="wz-freed" type="number" min={0} className="input" value={f} onChange={(e) => setFreed(Math.max(0, +e.target.value))} />
              </label>
              <label><span className="label text-sky-600">Ore potenziate oggi</span>
                <input id="wz-reinv" type="number" min={0} className="input" value={r} onChange={(e) => setReinv(Math.max(0, +e.target.value))} />
              </label>
            </div>
            <p className="text-xs text-slate-500">Suggerite: {fmt(sugFreed)} h e {fmt(sugReinv)} h, cioè metà del potenziale. Puoi partire da zero e salire man mano.</p>
            <label className="block"><span className="label">Dove vengono reinvestite le ore liberate</span>
              <select id="wz-dest" className="input" value={destination} onChange={(e) => setDestination(e.target.value as Destination)}>
                {DESTINATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Complessità</span>
                <select id="wz-cx" className="input" value={complexity} onChange={(e) => setComplexity(e.target.value as Complexity)}>
                  {(["low", "medium", "high"] as Complexity[]).map((c) => <option key={c} value={c}>{COMPLEXITY_LABEL[c]}</option>)}
                </select>
              </label>
              <label><span className="label">Rischio con l'AI</span>
                <select id="wz-risk" className="input" value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}>
                  {(Object.keys(RISK_LABEL) as RiskLevel[]).map((k) => <option key={k} value={k}>{RISK_LABEL[k]}</option>)}
                </select>
              </label>
            </div>
            <label className="block"><span className="label">Controllo umano richiesto</span>
              <input id="wz-ctl" className="input" value={control} onChange={(e) => setControl(e.target.value)} placeholder="Es. revisione del lead prima dell'invio" />
            </label>
            <label className="block"><span className="label">Tool di terze parti</span>
              <input id="wz-tools" className="input" value={tools} onChange={(e) => setTools(e.target.value)} />
            </label>
            <p className="text-xs text-slate-500">Blocker e micro-tool collegati si aggiungono dopo, dalla scheda dell'attività.</p>
          </div>
        )}

        <div className="flex justify-between">
          <button type="button" className="btn" onClick={step === 0 ? onClose : () => setStep(step - 1)}>{step === 0 ? "Annulla" : "Indietro"}</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>Avanti</button>
          ) : (
            <button type="button" className="btn-primary" onClick={create}>Crea attività</button>
          )}
        </div>
    </Dialog>
  );
}
