import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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

/** Definizione apribile con il tocco, il click o il mouse. Il passaggio del mouse vale solo dove esiste. */
export function Term({ k, children }: { k: keyof typeof GLOSSARY; children?: ReactNode }) {
  const g = GLOSSARY[k];
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!pinned) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  return (
    <span ref={rootRef} className="group relative inline-block">
      <button
        type="button"
        className="cursor-help border-b border-dotted border-slate-400 text-inherit"
        aria-expanded={pinned}
        aria-controls={tipId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPinned((open) => !open);
        }}
      >
        {children ?? g.label}
      </button>
      <span
        id={tipId}
        role="note"
        className={`absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-slate-700 shadow-lg ${pinned ? "block" : "hidden"} [@media(hover:hover)]:group-hover:block`}
      >
        <span className="mb-0.5 block font-semibold text-slate-900">{g.label}</span>
        {g.def}
      </span>
    </span>
  );
}
