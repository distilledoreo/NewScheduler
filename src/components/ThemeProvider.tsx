import React, { createContext, useContext, useEffect, useState } from "react";
import { FluentProvider, Theme, teamsLightTheme, teamsDarkTheme } from "@fluentui/react-components";

export type ThemeName = "light" | "dark";

interface ThemeContextValue {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    return (saved as ThemeName) || "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", themeName);
  }, [themeName]);

  const setThemeName = (name: ThemeName) => setThemeNameState(name);
  const toggleTheme = () => setThemeName(themeName === "light" ? "dark" : "light");

  const theme: Theme = themeName === "dark" ? teamsDarkTheme : teamsLightTheme;

  return (
    <ThemeContext.Provider value={{ themeName, setThemeName, toggleTheme }}>
      <FluentProvider theme={theme}>{children}</FluentProvider>
    </ThemeContext.Provider>
  );
}
