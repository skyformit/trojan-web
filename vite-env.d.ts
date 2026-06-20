/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOCAL_ROUTING_HEURISTICS?: string;
  readonly VITE_ENABLE_GUIDED_ONBOARDING_FLOW?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
