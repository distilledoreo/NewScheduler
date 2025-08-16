import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";

const container = document.getElementById("root")!;
const root = createRoot(container);

const Root = () => {
  const [mode, setMode] = React.useState<"light" | "dark">("light");
  const toggleTheme = () => setMode(m => (m === "light" ? "dark" : "light"));
  const theme = mode === "light" ? webLightTheme : webDarkTheme;
  return (
    <FluentProvider theme={theme}>
      <App theme={mode} toggleTheme={toggleTheme} />
    </FluentProvider>
  );
};

root.render(<Root />);
