import type { ReactNode } from "react";

export const GLOSSARY: Record<string, { label: string; def: string }> = {
  baseline: {
    label: "Baseline",
    def: "Ore al mese che l'attività richiede oggi, senza AI. È il punto di partenza di ogni confronto.",
  },
  liberate: {
    label: "Ore liberate (automation)",
    def: "Ore al mese che spariscono davvero dall'attività perché le fa l'AI. È capacità che torna disponibile e che il team reinveste altrove: nuovi servizi, qualità, più capacità per i clienti.",
  },
  reinvestite: {
    label: "Ore potenziate (augmentation)",
    def: "Ore che restano sull'attività ma producono più qualità o più output grazie all'AI. Non liberano capacità.",
  },
  residuo: {
    label: "Potenziale residuo",
    def: "Ore che le percentuali dichiarate indicano come catturabili ma che oggi non lo sono ancora.",
  },
  nonAllocata: {
    label: "Da classificare",
    def: "Ore liberate di cui non è ancora stato indicato dove sono state reinvestite. Non sono ore inutilizzate: sono ore da classificare. Se restano senza una destinazione, il risparmio si legge come taglio di risorse.",
  },
  blocker: {
    label: "Blocker",
    def: "Ostacolo concreto (dati, licenze, policy, competenze) che impedisce di catturare il potenziale di una o più attività.",
  },
  confidenza: {
    label: "Confidenza",
    def: "Quanto è solido un numero: stima del team, misurato su ore reali, oppure validato dal lead.",
  },
  cattura: {
    label: "Cattura AI",
    def: "Quota del potenziale di liberazione che si assume realizzata negli scenari di staffing (0% = nessun effetto AI, 100% = tutto realizzato).",
  },
  scarto: {
    label: "Scarto vs atteso",
    def: "Ore reali meno ore attese con AI. Negativo significa che l'AI sta facendo meglio del previsto.",
  },
};

/** Termine con definizione al passaggio del mouse o al focus */
export function Term({ k, children }: { k: keyof typeof GLOSSARY; children?: ReactNode }) {
  const g = GLOSSARY[k];
  return (
    <span className="group relative inline-block cursor-help outline-none" tabIndex={0}>
      <span className="border-b border-dotted border-slate-400">{children ?? g.label}</span>
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-64 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-slate-700 shadow-lg group-hover:block group-focus:block">
        <span className="mb-0.5 block font-semibold text-slate-900">{g.label}</span>
        {g.def}
      </span>
    </span>
  );
}
