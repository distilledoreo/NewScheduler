import * as React from "react";
import { Button, Tooltip, makeStyles, tokens, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem } from "@fluentui/react-components";
import {
  CalendarLtr20Regular,
  CalendarDay20Regular,
  PeopleCommunity20Regular,
  TableSimple20Regular,
  DocumentTable20Regular,
  History20Regular,
  Settings20Regular,
  Share20Regular,
  MoreVertical20Regular,
  WeatherSunny20Regular,
  WeatherMoon20Regular,
} from "@fluentui/react-icons";
import "../styles/tooltip.css";

export type TabKey = "RUN" | "PEOPLE" | "SKILLS" | "NEEDS" | "EXPORT" | "MONTHLY" | "HISTORY" | "ADMIN";

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
    position: "fixed",
    top: 0,
    left: 0,
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

  type NavItem =
    | { type: "page"; key: TabKey; label: string; icon: React.ReactElement }
    | { type: "action"; id: "THEME"; label: string; icon: React.ReactElement; onClick: () => void };

  const baseNav: NavItem[] = [
    { type: "page", key: "RUN", label: "Run", icon: <CalendarDay20Regular /> },
    { type: "page", key: "PEOPLE", label: "People", icon: <PeopleCommunity20Regular /> },
    { type: "page", key: "SKILLS", label: "Skills", icon: <TableSimple20Regular /> },
    { type: "page", key: "NEEDS", label: "Needs", icon: <DocumentTable20Regular /> },
    { type: "page", key: "EXPORT", label: "Export", icon: <Share20Regular /> },
    { type: "page", key: "MONTHLY", label: "Monthly", icon: <CalendarLtr20Regular /> },
    { type: "page", key: "HISTORY", label: "History", icon: <History20Regular /> },
    { type: "page", key: "ADMIN", label: "Admin", icon: <Settings20Regular /> },
  ];

  const themeItem: NavItem = {
    type: "action",
    id: "THEME",
    label: themeName === "dark" ? "Dark" : "Light",
    icon: themeName === "dark" ? <WeatherMoon20Regular /> : <WeatherSunny20Regular />,
    onClick: () => setThemeName(themeName === "dark" ? "light" : "dark"),
  };

  const allItems: NavItem[] = [...baseNav, themeItem];

  // Determine how many items fit dynamically; reserve space for More only if needed
  const visible = allItems.slice(0, maxVisible);
  const overflow = allItems.slice(maxVisible);

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
  const firstItem = nav.querySelector(`.${s.item}`) as HTMLElement | null;
  const itemH = firstItem ? firstItem.offsetHeight + 6 : 56; // add gap
      const moreH = 36; // approx More button height
      if (itemH <= 0 || available <= 0) return;

      // First, try without reserving space for More
      const possibleNoMore = Math.floor(available / itemH);
      if (possibleNoMore >= allItems.length) {
        setMaxVisible(allItems.length);
        return;
      }

      // Otherwise, reserve space for More and recompute
      const possibleWithMore = Math.floor((available - moreH) / itemH);
      const clamped = Math.max(1, Math.min(allItems.length, possibleWithMore));
      setMaxVisible(clamped);
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
  }, [allItems.length]);

  return (
    <aside className={s.root} aria-label="App navigation" ref={railRef}>
      <div className={`${s.section} ${s.grow}`} ref={navRef}>
        {visible.map((it, idx) => {
          if (it.type === "page") {
            return (
              <RailItem
                key={`page-${it.key}`}
                icon={it.icon}
                label={it.label}
                active={activeTab === it.key}
                onClick={() => setActiveTab(it.key)}
              />
            );
          }
          // action (theme toggle)
          return (
            <Tooltip key={`action-${it.id}`} content={themeName === 'dark' ? 'Switch to Light' : 'Switch to Dark'} relationship="label">
              <div
                className={s.item}
                role="button"
                aria-label={themeName === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
                onClick={it.onClick}
              >
                {it.icon}
                <span className={s.label}>{it.label}</span>
              </div>
            </Tooltip>
          );
        })}

        {overflow.length > 0 && (
          <Menu>
            <MenuTrigger>
              <Button className={s.moreButton} icon={<MoreVertical20Regular />}>More</Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {overflow.map((it) => {
                  if (it.type === 'page') {
                    return (
                      <MenuItem key={`page-${it.key}`} onClick={() => setActiveTab(it.key)} icon={it.icon}>
                        {it.label}
                      </MenuItem>
                    );
                  }
                  return (
                    <MenuItem key={`action-${it.id}`} onClick={it.onClick} icon={it.icon}>
                      {themeName === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                    </MenuItem>
                  );
                })}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
    </aside>
  );
}
