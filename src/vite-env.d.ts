/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEETS_URL?: string;
  /** Client ID OAuth pubblico (non è un segreto): serve a Google Identity Services */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
