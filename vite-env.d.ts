/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOCAL_ROUTING_HEURISTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
