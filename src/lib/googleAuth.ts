export interface GoogleSession {
  token: string;
  email: string;
  /** scadenza Unix, in secondi */
  exp: number;
}

const SESSION_KEY = "aam.googleSession";

interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
  disableAutoSelect: () => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** Il client ID è pubblico per disegno: non è un segreto e non autorizza da solo. */
export function googleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
}

export function decodeJwt(token: string): { email?: string; exp?: number } {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as { email?: string; exp?: number };
  } catch {
    return {};
  }
}

export function tokenUsable(session: GoogleSession | null, skewMs = 60_000): session is GoogleSession {
  if (!session?.token || !session.email || !session.exp) return false;
  return session.exp * 1000 - Date.now() > skewMs;
}

export function loadSession(): GoogleSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as GoogleSession;
    return tokenUsable(session) ? session : null;
  } catch {
    return null;
  }
}

export function storeSession(session: GoogleSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

let loading: Promise<void> | null = null;

export function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error("Google Identity Services non disponibile"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

export function sessionFromCredential(credential: string): GoogleSession | null {
  const claims = decodeJwt(credential);
  if (!claims.email || !claims.exp) return null;
  return { token: credential, email: claims.email, exp: claims.exp };
}

export function signOutGoogle() {
  storeSession(null);
  try {
    window.google?.accounts.id.disableAutoSelect();
  } catch {
    /* il pulsante può non essere stato inizializzato */
  }
}
