import * as React from "react";
import { Button, Tooltip, makeStyles, tokens, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Divider, Text, Switch } from "@fluentui/react-components";
import {
  Add20Regular,
  FolderOpen20Regular,
  Save20Regular,
  SaveCopy20Regular,
  CalendarLtr20Regular,
  PeopleCommunity20Regular,
  TableSimple20Regular,
  DocumentTable20Regular,
  History20Regular,
  Settings20Regular,
  MoreVertical20Regular,
} from "@fluentui/react-icons";

export type TabKey = "RUN" | "PEOPLE" | "NEEDS" | "EXPORT" | "MONTHLY" | "HISTORY" | "ADMIN";

export interface SideRailProps {
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
  themeName: "light" | "dark";
  setThemeName: (t: "light" | "dark") => void;
}

const useStyles = makeStyles({
  root: {
    width: "80px",
    minWidth: 0,
    height: "100vh",
    position: "sticky",
    top: 0,
    padding: tokens.spacingVerticalS,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: tokens.spacingVerticalS,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
    boxSizing: "border-box",
  },
  appTitle: {
    fontWeight: tokens.fontWeightSemibold,
    textAlign: "center",
    fontSize: tokens.fontSizeBase300,
    paddingBlockEnd: tokens.spacingVerticalS,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: tokens.spacingVerticalXS,
  },
  grow: { flex: 1, minHeight: 0, overflow: "hidden" },
  navScroll: { overflowY: "auto", overflowX: "hidden", minHeight: 0 },
  item: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
    gap: tokens.spacingHorizontalXXS,
    cursor: "pointer",
    color: tokens.colorNeutralForeground2,
    userSelect: "none",
    
    
  },
  itemActive: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground1,
  },
  label: { fontSize: tokens.fontSizeBase200, lineHeight: "1", textAlign: "center" },
  moreButton: { width: "100%" },
});

function RailItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; }){
  const s = useStyles();
  return (
    <Tooltip content={label} relationship="label">
      <div className={`${s.item} ${active ? s.itemActive : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
        {icon}
        <span className={s.label}>{label}</span>
      </div>
    </Tooltip>
  );
}

export default function SideRail({
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
  themeName,
  setThemeName,
}: SideRailProps){
  const s = useStyles();

  const primaryNav: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "RUN", label: "Run", icon: <CalendarLtr20Regular /> },
    { key: "PEOPLE", label: "People", icon: <PeopleCommunity20Regular /> },
    { key: "NEEDS", label: "Needs", icon: <TableSimple20Regular /> },
    { key: "EXPORT", label: "Export", icon: <DocumentTable20Regular /> },
    { key: "MONTHLY", label: "Monthly", icon: <TableSimple20Regular /> },
  { key: "HISTORY", label: "History", icon: <History20Regular /> },
    { key: "ADMIN", label: "Admin", icon: <Settings20Regular /> },
  ];

  // Determine how many nav items fit; reserve space for More button
  const maxVisible = 5; // simple heuristic; can be made responsive later
  const visible = primaryNav.slice(0, maxVisible);
  const overflow = primaryNav.slice(maxVisible);

  return (
    <aside className={s.root} aria-label="App navigation">
      <div className={s.section}>
        <Text align="center" className={s.appTitle}>Sched</Text>
        <Tooltip content="New DB" relationship="label">
          <Button appearance="primary" icon={<Add20Regular />} onClick={createNewDb}>New</Button>
        </Tooltip>
        <Tooltip content="Open DB" relationship="label">
          <Button icon={<FolderOpen20Regular />} onClick={openDbFromFile}>Open</Button>
        </Tooltip>
        <Tooltip content="Save" relationship="label">
          <Button icon={<Save20Regular />} onClick={saveDb} disabled={!canSave}>Save</Button>
        </Tooltip>
        <Tooltip content="Save As" relationship="label">
          <Button icon={<SaveCopy20Regular />} onClick={saveDbAs} disabled={!sqlDb}>Save As</Button>
        </Tooltip>
      </div>

      <Divider />

      <div className={`${s.section} ${s.grow} ${s.navScroll}`}>
        {visible.map(it => (
          <RailItem key={it.key} icon={it.icon} label={it.label} active={activeTab===it.key} onClick={()=>setActiveTab(it.key)} />
        ))}

        {overflow.length > 0 && (
          <Menu>
            <MenuTrigger>
              <Button className={s.moreButton} icon={<MoreVertical20Regular />}>More</Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {overflow.map(it => (
                  <MenuItem key={it.key} onClick={()=>setActiveTab(it.key)}>
                    {it.label}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>

      <Divider />

      <div className={s.section}>
        <Switch checked={themeName === "dark"} onChange={(_, d)=> setThemeName(d.checked ? "dark" : "light")} label={themeName === 'dark' ? 'Dark' : 'Light'} />
        <Text size={200} title={status}>{status}</Text>
      </div>
    </aside>
  );
}
