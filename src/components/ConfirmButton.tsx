import { useEffect, useState, type ReactNode } from "react";

/**
 * Conferma in-page: il primo click arma il pulsante, il secondo conferma.
 * Sostituisce confirm(), che nel visualizzatore di pagine non funziona.
 */
export default function ConfirmButton({
  onConfirm, children, className = "btn", confirmLabel = "Confermi?", title,
}: {
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  confirmLabel?: string;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      title={title}
      className={armed ? "btn !border-rose-500 !bg-rose-600 !text-white" : className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
