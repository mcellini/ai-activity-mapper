const SESSION_KEY = "aam.password";
const LOCAL_KEY = "aam.password.saved";

export function loadPassword(): { password: string; remember: boolean } {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) return { password: saved, remember: true };
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session) return { password: session, remember: false };
  } catch {
    /* storage non disponibile */
  }
  return { password: "", remember: false };
}

/** Tiene la password per la scheda. Se remember, anche dopo la chiusura del browser. */
export function savePassword(password: string, remember: boolean) {
  try {
    sessionStorage.setItem(SESSION_KEY, password);
    if (remember) localStorage.setItem(LOCAL_KEY, password);
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

export function clearPassword() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}
