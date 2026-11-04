import { useEffect, useRef } from "react";
import { googleClientId, loadGsi, sessionFromCredential, type GoogleSession } from "@/lib/googleAuth";

/** Pulsante ufficiale Google. Il token viene verificato dallo script, non dal browser. */
export default function GoogleSignInButton({ onCredential }: { onCredential: (session: GoogleSession) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const clientId = googleClientId();

  useEffect(() => {
    const host = hostRef.current;
    if (!clientId || !host) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            const session = sessionFromCredential(resp.credential);
            if (session) callbackRef.current(session);
          },
        });
        hostRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(hostRef.current, {
          theme: "outline",
          size: "medium",
          text: "signin_with",
          locale: "it",
          width: "280",
        });
      })
      .catch(() => {
        if (!cancelled && hostRef.current) {
          hostRef.current.textContent = "Impossibile caricare l'accesso Google.";
        }
      });
    return () => { cancelled = true; };
  }, [clientId]);

  if (!clientId) {
    return (
      <p className="text-sm text-amber-800">
        Manca il client ID OAuth. In locale mettilo in <code>.env.local</code> come <code>VITE_GOOGLE_CLIENT_ID</code>;
        su GitHub Pages va nella variabile Actions con lo stesso nome. I passi sono nel README.
      </p>
    );
  }
  return <div ref={hostRef} />;
}
