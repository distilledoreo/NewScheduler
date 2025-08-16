import * as React from "react";
import { Button, Tooltip, makeStyles, tokens, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Divider, Text, Switch } from "@fluentui/react-components";
import {
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
  section: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: tokens.spacingVerticalXS,
  },
  grow: { flex: 1, minHeight: 0, overflow: "hidden" },
  navScroll: { },
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
  status,
  activeTab,
  setActiveTab,
  themeName,
  setThemeName,
}: SideRailProps){
  const s = useStyles();
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const navRef = React.useRef<HTMLDivElement | null>(null);
  const [maxVisible, setMaxVisible] = React.useState<number>(5);

  const primaryNav: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "RUN", label: "Run", icon: <CalendarLtr20Regular /> },
    { key: "PEOPLE", label: "People", icon: <PeopleCommunity20Regular /> },
    { key: "NEEDS", label: "Needs", icon: <TableSimple20Regular /> },
    { key: "EXPORT", label: "Export", icon: <DocumentTable20Regular /> },
    { key: "MONTHLY", label: "Monthly", icon: <TableSimple20Regular /> },
  { key: "HISTORY", label: "History", icon: <History20Regular /> },
    { key: "ADMIN", label: "Admin", icon: <Settings20Regular /> },
  ];

  // Determine how many nav items fit dynamically; reserve space for More
  const visible = primaryNav.slice(0, maxVisible);
  const overflow = primaryNav.slice(maxVisible);

  React.useEffect(() => {
    const measure = () => {
      const rail = railRef.current;
      const nav = navRef.current;
      if (!rail || !nav) return;
      // Available height for nav area (rail height - fixed sections ~ top(title)+divider and bottom section height)
      const railRect = rail.getBoundingClientRect();
      const bottomSection = rail.querySelector('[data-rail-bottom]') as HTMLElement | null;
      const topSection = rail.querySelector('[data-rail-top]') as HTMLElement | null;
      const dividers = rail.querySelectorAll('hr');
      const bottomH = bottomSection ? bottomSection.offsetHeight : 0;
      const topH = topSection ? topSection.offsetHeight : 0;
      let dividerH = 0; dividers.forEach(d => dividerH += (d as HTMLElement).offsetHeight);
      const padding = 16; // rough extra
      const available = railRect.height - bottomH - topH - dividerH - padding;

      // Estimate per-item height using the first child (icon+label stack)
      const first = nav.firstElementChild as HTMLElement | null;
      const itemH = first ? first.offsetHeight + 6 : 48; // add gap
      const moreH = 36; // More button height
      if (itemH <= 0) return;
      const possible = Math.max(1, Math.floor((available - moreH) / itemH));
      setMaxVisible(Math.min(primaryNav.length, possible));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (railRef.current) ro.observe(railRef.current);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [primaryNav.length]);

  return (
    <aside className={s.root} aria-label="App navigation" ref={railRef}>
      <div className={`${s.section} ${s.grow}`} ref={navRef}>
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

  <div className={s.section} data-rail-bottom>
        <Switch checked={themeName === "dark"} onChange={(_, d)=> setThemeName(d.checked ? "dark" : "light")} label={themeName === 'dark' ? 'Dark' : 'Light'} />
      </div>
    </aside>
  );
}
