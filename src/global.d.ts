declare module "*.wasm" { const src: string; export default src; }

// Temporary type shim for packages without bundled types
declare module "react-grid-layout";
