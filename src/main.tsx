import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { handleRedirect } from "./services/security/msal";

const container = document.getElementById("root")!;
const root = createRoot(container);

// Non-blocking: complete any MSAL redirects and set active account
handleRedirect().catch((e) => console.warn("MSAL redirect handling:", e));

root.render(<App />);
