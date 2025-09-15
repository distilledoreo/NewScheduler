declare module "*.wasm" { const src: string; export default src; }

// Temporary type shim for packages without bundled types
declare module "react-grid-layout";

// Vite Import Meta Env typings
interface ImportMetaEnv {
	readonly VITE_AAD_CLIENT_ID?: string;
	readonly VITE_AAD_TENANT_ID?: string;
	readonly VITE_AAD_SCOPES?: string; // comma-separated
	readonly VITE_SP_SITE_ID?: string;
	readonly VITE_SP_LIST_PEOPLE?: string;
	readonly VITE_SP_LIST_GROUPS?: string;
	readonly VITE_SP_LIST_ROLES?: string;
	readonly VITE_SP_LIST_SKILLS?: string;
	readonly VITE_SP_LIST_PERSON_SKILL?: string;
	readonly VITE_SP_LIST_PERSON_QUALITY?: string;
  // Feature flag to enable SharePoint/Graph provider
  readonly VITE_USE_SHAREPOINT?: string; // "true"/"1" to enable
}
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
