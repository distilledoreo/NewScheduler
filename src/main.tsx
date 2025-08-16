import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FluentProvider, teamsDarkTheme, teamsLightTheme } from "@fluentui/react-components";

const container = document.getElementById("root")!;
const root = createRoot(container);

const Root = () => {
  const [mode, setMode] = React.useState<"light" | "dark">("light");
  const toggleTheme = () => setMode(m => (m === "light" ? "dark" : "light"));
  const theme = mode === "light" ? teamsLightTheme : teamsDarkTheme;
  return (
    <FluentProvider theme={theme}>
      <App theme={mode} toggleTheme={toggleTheme} />
    </FluentProvider>
  );
};

root.render(<Root />);
