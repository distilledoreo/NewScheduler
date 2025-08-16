import React from "react";
import { Button, Tab, TabList, Tooltip, Spinner, Text, makeStyles, tokens } from "@fluentui/react-components";
import { useTheme } from "./ThemeProvider";

type TabKey = "RUN" | "PEOPLE" | "NEEDS" | "EXPORT" | "MONTHLY" | "HISTORY" | "ADMIN";

interface ToolbarProps {
  ready: boolean;
  sqlDb: any;
  canSave: boolean;
  createNewDb: () => void;
  openDbFromFile: () => void;
  saveDb: () => void;
  saveDbAs: () => void;
  status: string;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const useStyles = makeStyles({
  root: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  status: {
    color: tokens.colorNeutralForeground2,
    minWidth: 0,
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tabList: {
    marginLeft: "8px",
  }
});

export default function Toolbar({
  ready,
  sqlDb,
  canSave,
  createNewDb,
  openDbFromFile,
  saveDb,
  saveDbAs,
  status,
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
}: ToolbarProps) {
  const s = useStyles();
  const { themeName, toggleTheme } = useTheme();

  return (
    <div className={s.root}>
      <div className={s.left}>
        <Text weight="semibold">Scheduler</Text>
        {!sqlDb && <Tooltip content="No database loaded" relationship="label"><Spinner size="tiny" /></Tooltip>}
        <div style={{ display: "flex", gap: 8 }}>
          <Button appearance="primary" onClick={createNewDb}>New DB</Button>
          <Button onClick={openDbFromFile}>Open DB</Button>
          <Button onClick={saveDb} disabled={!canSave}>Save</Button>
          <Button onClick={saveDbAs} disabled={!sqlDb}>Save As</Button>
          <Button onClick={toggleTheme}>{theme === "light" ? "Dark" : "Light"} Mode</Button>
        </div>
      </div>

      <div className={s.tabList}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, data) => setActiveTab(data.value as TabKey)}
        >
          <Tab value="RUN">Daily Run</Tab>
          <Tab value="PEOPLE">People</Tab>
          <Tab value="NEEDS">Baseline Needs</Tab>
          <Tab value="EXPORT">Export Preview</Tab>
          <Tab value="MONTHLY">Monthly Defaults</Tab>
          <Tab value="HISTORY">Crew History</Tab>
          <Tab value="ADMIN">Admin</Tab>
        </TabList>
      </div>

      <Button onClick={toggleTheme} appearance="subtle">
        {themeName === "light" ? "Dark" : "Light"} theme
      </Button>
      <Text size={200} className={s.status}>{status}</Text>
    </div>
  );
}
