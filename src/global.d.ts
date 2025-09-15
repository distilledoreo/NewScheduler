declare module "*.wasm" { const src: string; export default src; }

// Temporary type shim for packages without bundled types
declare module "react-grid-layout";

interface ImportMetaEnv {
  readonly VITE_FEATURE_SP_TRAINING?: string;
  readonly VITE_AZURE_CLIENT_ID?: string;
  readonly VITE_AZURE_TENANT_ID?: string;
  readonly VITE_AZURE_AUTHORITY?: string;
  readonly VITE_AZURE_REDIRECT_URI?: string;
  readonly VITE_SHAREPOINT_SITE_ID?: string;
  readonly VITE_SHAREPOINT_SKILLS_LIST_ID?: string;
  readonly VITE_SHAREPOINT_PERSON_SKILLS_LIST_ID?: string;
  readonly VITE_SHAREPOINT_PERSON_QUALITIES_LIST_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
