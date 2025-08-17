import React, { useEffect, useState, useMemo, useCallback } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Segment, SegmentRow } from "../services/segments";
import "../styles/scrollbar.css";
import PersonName from "./PersonName";
import {
  Button,
  Dropdown,
  Option,
  Tab,
  TabList,
  Input,
  tokens,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  makeStyles,
  Badge,
  Card,
  CardHeader,
  CardPreview,
  Subtitle1,
  Body1,
  Caption1,
  Title3,
  Subtitle2,
  Tooltip,
} from "@fluentui/react-components";

const Grid = WidthProvider(GridLayout);
// Work around TS typing issues: cast WidthProvider result to any for JSX use
const GridWP: any = Grid;

// Styles moved outside the component to avoid recreating style objects on each render
const useStyles = makeStyles({
  root: {
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: "100%",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingHorizontalL,
    [`@media (min-width: 1024px)`]: {
      flexDirection: "row",
      alignItems: "center",
    },
  },
  headerLeft: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  headerRight: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginLeft: "auto" },
  label: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "nowrap",
  },
  groupCard: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupMeta: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  rolesGrid: {
    flex: 1,
    display: "grid",
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalM,
    overflow: "auto",
  },
  roleCard: {
    borderLeftWidth: "4px",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  roleHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalS,
  },
  assignmentsList: {
    listStyleType: "none",
    padding: 0,
    margin: 0,
    overflow: "auto",
    display: "grid",
    rowGap: tokens.spacingVerticalS,
  },
  assignmentItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusSmall,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    columnGap: tokens.spacingHorizontalM,
  },
  assignmentName: {
    flex: 1,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  actionsRow: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
});

interface DailyRunBoardProps {
  activeRunSegment: Segment;
  setActiveRunSegment: (seg: Segment) => void;
  groups: any[];
  segments: SegmentRow[];
  lockEmail: string;
  sqlDb: any | null;
  all: (sql: string, params?: any[], db?: any) => any[];
  roleListForSegment: (segment: Segment) => any[];
  selectedDate: string;
  selectedDateObj: Date;
  setSelectedDate: (date: string) => void;
  fmtDateMDY: (d: Date) => string;
  parseYMD: (s: string) => Date;
  ymd: (d: Date) => string;
  setShowNeedsEditor: (v: boolean) => void;
  canEdit: boolean;
  peopleOptionsForSegment: (
    date: Date,
    segment: Segment,
    role: any
  ) => Array<{ id: number; label: string; blocked: boolean }>;
  getRequiredFor: (
    date: Date,
    groupId: number,
    roleId: number,
    segment: Segment
  ) => number;
  addAssignment: (
    dateMDY: string,
    personId: number,
    roleId: number,
    segment: Segment
  ) => void;
  deleteAssignment: (id: number) => void;
  isDark: boolean;
}

export default function DailyRunBoard({
  activeRunSegment,
  setActiveRunSegment,
  groups,
  segments,
  lockEmail,
  sqlDb,
  all,
  roleListForSegment,
  selectedDate,
  selectedDateObj,
  setSelectedDate,
  fmtDateMDY,
  parseYMD,
  ymd,
  setShowNeedsEditor,
  canEdit,
  peopleOptionsForSegment,
  getRequiredFor,
  addAssignment,
  deleteAssignment,
  isDark,
}: DailyRunBoardProps) {
  // Height of each react-grid-layout row in pixels. Increase to make group cards taller.
  const RGL_ROW_HEIGHT = 110;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const s = useStyles();
  const seg: Segment = activeRunSegment;
  const [layout, setLayout] = useState<any[]>([]);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [moveContext, setMoveContext] = useState<{
    assignment: any;
  targets: Array<{ role: any; group: any; need: number }>;
  } | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<number | null>(null);

  const roles = useMemo(() => roleListForSegment(seg), [roleListForSegment, seg]);

  useEffect(() => {
    setLayoutLoaded(false);
    const key = `layout:${seg}:${lockEmail || "default"}`;
    let saved: any[] = [];
    try {
      const rows = all(`SELECT value FROM meta WHERE key=?`, [key]);
      if (rows[0] && rows[0].value) saved = JSON.parse(String(rows[0].value));
    } catch {}
    const byId = new Map(saved.map((l: any) => [l.i, l]));
    const merged = groups.map((g: any, idx: number) => {
      const rolesForGroup = roles.filter((r) => r.group_id === g.id);
      const roleCount = rolesForGroup.length;
      // Base height estimates number of role rows across ~3 columns plus header
      const baseH = Math.max(2, Math.ceil(roleCount / 3)) + 1;
      // Estimate extra rows based on additional required people beyond 1 per role
      const extraNeededSum = rolesForGroup.reduce((sum, r) => {
        const req = getRequiredFor(selectedDateObj, g.id, r.id, seg);
        return sum + Math.max(0, req - 1);
      }, 0);
      const extraRows = Math.ceil(extraNeededSum / 3);
      const h = baseH + extraRows;
      return (
        byId.get(String(g.id)) || {
          i: String(g.id),
          x: (idx % 4) * 3,
          y: Math.floor(idx / 4) * h,
          w: 3,
          h,
        }
      );
    });
    setLayout(merged);
    setLayoutLoaded(true);
  }, [groups, lockEmail, seg, roles, all, getRequiredFor, selectedDateObj]);

  function handleLayoutChange(l: any[]) {
    setLayout(l);
    if (!layoutLoaded) return;
    const key = `layout:${seg}:${lockEmail || "default"}`;
    try {
      const stmt = sqlDb.prepare(`INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)`);
      stmt.bind([key, JSON.stringify(l)]);
      stmt.step();
      stmt.free();
    } catch {}
  }

  const assignedCountMap = useMemo(() => {
    const rows = all(
      `SELECT role_id, COUNT(*) as c FROM assignment WHERE date=? AND segment=? GROUP BY role_id`,
      [ymd(selectedDateObj), seg]
    );
    return new Map<number, number>(rows.map((r: any) => [r.role_id, r.c]));
  }, [all, selectedDateObj, seg, ymd]);

  const groupMap = useMemo(() => new Map(groups.map((g: any) => [g.id, g])), [groups]);

  const deficitRoles = useMemo(() => {
    return (
      roles
        .map((r: any) => {
          const assigned = assignedCountMap.get(r.id) || 0;
          const req = getRequiredFor(selectedDateObj, r.group_id, r.id, seg);
          return assigned < req ? { role: r, group: groupMap.get(r.group_id) } : null;
        })
        .filter(Boolean) as Array<{ role: any; group: any }>
    );
  }, [roles, assignedCountMap, getRequiredFor, selectedDateObj, seg, groupMap]);

  // Precompute segment times for the selected date at top-level for reuse in move dialog
  const segTimesTop = useMemo(() => {
    const day = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
    const mk = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
    };
    const map: Record<string, { start: Date; end: Date }> = {};
    for (const srow of segments) {
      map[srow.name] = { start: mk(srow.start_time), end: mk(srow.end_time) };
    }
    // Detect Lunch/Early presence on date
    const rows = all(`SELECT DISTINCT segment FROM assignment WHERE date=?`, [ymd(selectedDateObj)]);
    const hasLunch = rows.some((r: any) => r.segment === "Lunch");
    const hasEarly = rows.some((r: any) => r.segment === "Early");
    const addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60000);
    if (hasLunch) {
      if (map["AM"] && map["Lunch"]) map["AM"].end = map["Lunch"].start;
      if (map["PM"] && map["Lunch"]) map["PM"].start = addMinutes(map["Lunch"].end, 60);
    }
    if (hasEarly && map["PM"]) {
      map["PM"].end = addMinutes(map["PM"].end, -60);
    }
    return map;
  }, [all, segments, selectedDateObj, ymd]);

  const segDurationMinutesTop = useMemo(() => {
    const st = segTimesTop[seg]?.start;
    const en = segTimesTop[seg]?.end;
    if (!st || !en || seg === "Early") return 0;
    return Math.max(0, Math.round((en.getTime() - st.getTime()) / 60000));
  }, [segTimesTop, seg]);

  // Compute effective assigned counts per role (exclude heavy time-off overlaps)
  const assignedEffectiveCountMap = useMemo(() => {
    const map = new Map<number, number>();
    const st = segTimesTop[seg]?.start;
    const en = segTimesTop[seg]?.end;
    if (!st || !en || seg === "Early") {
      // Fallback to raw counts
      for (const r of roles) map.set(r.id, assignedCountMap.get(r.id) || 0);
      return map;
    }
    const segStart = st.getTime();
    const segEnd = en.getTime();
    const half = Math.ceil((segEnd - segStart) / 2);
    const dayStart = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1, 0, 0, 0, 0);
    const timeOff = all(
      `SELECT person_id, start_ts, end_ts FROM timeoff WHERE NOT (? >= end_ts OR ? <= start_ts)`,
      [dayStart.toISOString(), dayEnd.toISOString()]
    ) as any[];
    const ovlByPerson = new Map<number, number>();
    for (const t of timeOff) {
      const s = new Date(t.start_ts).getTime();
      const e = new Date(t.end_ts).getTime();
      const ovl = Math.max(0, Math.min(e, segEnd) - Math.max(s, segStart));
      if (ovl <= 0) continue;
      const prev = ovlByPerson.get(t.person_id) || 0;
      ovlByPerson.set(t.person_id, prev + ovl);
    }
    const assigns = all(`SELECT person_id, role_id FROM assignment WHERE date=? AND segment=?`, [ymd(selectedDateObj), seg]) as any[];
    for (const r of roles) map.set(r.id, 0);
    for (const a of assigns) {
      const ovl = ovlByPerson.get(a.person_id) || 0;
      const heavy = ovl >= half;
      if (heavy) continue;
      map.set(a.role_id, (map.get(a.role_id) || 0) + 1);
    }
    return map;
  }, [all, roles, seg, segTimesTop, selectedDateObj, ymd, assignedCountMap]);

  const GroupCard = React.memo(function GroupCard({ group, isDraggable }: { group: any; isDraggable: boolean }) {
    const rolesForGroup = roles.filter((r) => r.group_id === group.id);
    const groupNeedsMet = rolesForGroup.every((r: any) => {
      const assignedCount = assignedCountMap.get(r.id) || 0;
      const req = getRequiredFor(selectedDateObj, group.id, r.id, seg);
      return assignedCount >= req;
    });
    const groupAccent = groupNeedsMet
      ? tokens.colorPaletteGreenBorderActive
      : tokens.colorPaletteRedBorderActive;
    return (
      <Card className={s.groupCard} style={{ borderColor: groupAccent }}>
        <CardHeader
          className={isDraggable ? "drag-handle" : ""}
          header={<Title3>{group.name}</Title3>}
          description={
            <Caption1 className={s.groupMeta}>
              {group.theme || "No Theme"}
            </Caption1>
          }
        />
        <div
          className={s.rolesGrid}
          style={{
            gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
            ["--scrollbar-thumb" as any]: tokens.colorNeutralStroke1,
          }}
        >
          {rolesForGroup.map((r: any) => (
            <RoleCard key={r.id} group={group} role={r} />
          ))}
        </div>
      </Card>
    );
  });

  const RoleCard = React.memo(function RoleCard({ group, role }: { group: any; role: any }) {
    const assigns = useMemo(
      () =>
        all(
          `SELECT a.id, p.first_name, p.last_name, p.id as person_id FROM assignment a JOIN person p ON p.id=a.person_id WHERE a.date=? AND a.role_id=? AND a.segment=? ORDER BY p.last_name,p.first_name`,
          [ymd(selectedDateObj), role.id, seg]
        ),
      [all, selectedDateObj, role.id, seg, ymd]
    );

    const trainedBefore = useMemo(() => {
      const qualified = all(
        `SELECT person_id FROM training WHERE role_id=? AND status='Qualified'`,
        [role.id]
      ).map((r: any) => r.person_id);
      // Treat monthly assignment history as implicit qualification for this role/segment
      const monthly = all(
        `SELECT DISTINCT person_id FROM monthly_default WHERE role_id=? AND segment=?
         UNION
         SELECT DISTINCT person_id FROM monthly_default_day WHERE role_id=? AND segment=?`,
        [role.id, seg, role.id, seg]
      ).map((r: any) => r.person_id);
      return new Set<number>([...qualified, ...monthly]);
    }, [all, role.id, seg]);

    const opts = useMemo(
      () => peopleOptionsForSegment(selectedDateObj, seg, role),
      [peopleOptionsForSegment, selectedDateObj, seg, role]
    );

    const sortedOpts = useMemo(() => {
      const normalize = (s: string) => s.replace(/\s*\(Untrained\)$/i, "");
      const arr = [...opts];
      arr.sort((a, b) => {
        const ta = trainedBefore.has(a.id) ? 1 : 0;
        const tb = trainedBefore.has(b.id) ? 1 : 0;
        if (ta !== tb) return tb - ta; // trained first
        return normalize(a.label).localeCompare(normalize(b.label));
      });
      return arr;
    }, [opts, trainedBefore]);

    // Calculate dynamic segment times (mimic App.segmentTimesForDate)
    const segTimes = useMemo(() => {
      const day = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
      const mk = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
      };
      const map: Record<string, { start: Date; end: Date }> = {};
      for (const srow of segments) {
        map[srow.name] = { start: mk(srow.start_time), end: mk(srow.end_time) };
      }
      // Detect Lunch/Early presence on date
      const rows = all(`SELECT DISTINCT segment FROM assignment WHERE date=?`, [ymd(selectedDateObj)]);
      const hasLunch = rows.some((r: any) => r.segment === "Lunch");
      const hasEarly = rows.some((r: any) => r.segment === "Early");
      const addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60000);
      if (hasLunch) {
        if (map["AM"] && map["Lunch"]) map["AM"].end = map["Lunch"].start;
        if (map["PM"] && map["Lunch"]) map["PM"].start = addMinutes(map["Lunch"].end, 60);
      }
      if (hasEarly && map["PM"]) {
        map["PM"].end = addMinutes(map["PM"].end, -60);
      }
      return map;
    }, [all, segments, selectedDateObj, ymd]);

    // Compute time-off overlap vs this segment; derive partial/heavy flags
    const overlapByPerson = useMemo(() => {
      if (seg === "Early") return new Map<number, { minutes: number; heavy: boolean; partial: boolean }>();
      const st = segTimes[seg]?.start;
      const en = segTimes[seg]?.end;
      const map = new Map<number, { minutes: number; heavy: boolean; partial: boolean }>();
      if (!st || !en) return map;
      const segStart = st.getTime();
      const segEnd = en.getTime();
      const segMinutes = Math.max(0, Math.round((segEnd - segStart) / 60000));

      // Fetch all timeoff entries overlapping this calendar day to minimize per-person queries
      const dayStart = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1, 0, 0, 0, 0);
      const rows = all(
        `SELECT person_id, start_ts, end_ts FROM timeoff WHERE NOT (? >= end_ts OR ? <= start_ts)`,
        [dayStart.toISOString(), dayEnd.toISOString()]
      );
      for (const r of rows as any[]) {
        const pid = r.person_id as number;
        const s = new Date(r.start_ts).getTime();
        const e = new Date(r.end_ts).getTime();
        const ovl = Math.max(0, Math.min(e, segEnd) - Math.max(s, segStart));
        if (ovl <= 0) continue;
        const prev = map.get(pid)?.minutes || 0;
        const minutes = prev + Math.round(ovl / 60000);
        const heavy = segMinutes > 0 && minutes >= Math.ceil(segMinutes / 2);
        const partial = minutes > 0 && !heavy;
        map.set(pid, { minutes, heavy, partial });
      }
      return map;
    }, [all, seg, segTimes, selectedDateObj]);

    const segDurationMinutes = useMemo(() => {
      if (seg === "Early") return 0;
      const st = segTimes[seg]?.start;
      const en = segTimes[seg]?.end;
      if (!st || !en) return 0;
      return Math.max(0, Math.round((en.getTime() - st.getTime()) / 60000));
    }, [seg, segTimes]);

    // Build status per role (under/exact/over) for the whole segment to evaluate current assignments
    const roleStatusById = useMemo(() => {
      const m = new Map<number, "under" | "exact" | "over">();
      for (const r of roles) {
        const eff = assignedEffectiveCountMap.get(r.id) || 0;
        const reqR = getRequiredFor(selectedDateObj, r.group_id, r.id, seg);
        const st = eff < reqR ? "under" : eff === reqR ? "exact" : "over";
        m.set(r.id, st);
      }
      return m;
    }, [roles, assignedEffectiveCountMap, getRequiredFor, selectedDateObj, seg]);

    // Map current person -> assigned role (if any) for this date+segment
    const personAssignedRoleMap = useMemo(() => {
      const rows = all(
        `SELECT person_id, role_id FROM assignment WHERE date=? AND segment=?`,
        [ymd(selectedDateObj), seg]
      ) as any[];
      const m = new Map<number, number>();
      for (const r of rows) if (!m.has(r.person_id)) m.set(r.person_id, r.role_id);
      return m;
    }, [all, selectedDateObj, seg, ymd]);

    const req = getRequiredFor(selectedDateObj, group.id, role.id, seg);
    // Effective count excludes "heavy" time-off overlaps
    const heavyCount = assigns.reduce((n, a) => n + (overlapByPerson.get(a.person_id)?.heavy ? 1 : 0), 0);
    const assignedEffective = assigns.length - heavyCount;
    const status: "under" | "exact" | "over" =
      assignedEffective < req ? "under" : assignedEffective === req ? "exact" : "over";
    const accentColor =
      status === "under"
        ? tokens.colorPaletteRedBorderActive
        : status === "exact"
        ? tokens.colorPaletteGreenBorderActive
        : tokens.colorPaletteYellowBorderActive;
  // Move action availability is handled per-person (blocked for heavy time-off), not by overstaffed status

    const handleMove = useCallback(
      (a: any) => {
        // Build full target list across all roles in this segment; prioritize deficits
        const allTargets: Array<{ role: any; group: any; need: number }> = [];
        for (const r of roles) {
          const candidateOpts = peopleOptionsForSegment(selectedDateObj, seg, r);
          const eligible = candidateOpts.some((o) => o.id === a.person_id && !o.blocked);
          if (!eligible) continue;
          const grp = groupMap.get(r.group_id);
          const req = getRequiredFor(selectedDateObj, r.group_id, r.id, seg);
          const eff = assignedEffectiveCountMap.get(r.id) || 0;
          const need = Math.max(0, req - eff);
          allTargets.push({ role: r, group: grp, need });
        }
        if (!allTargets.length) {
          alert("No eligible destinations for this person.");
          return;
        }
        // Sort: needs first (descending), then by group/role
        allTargets.sort((aT, bT) => {
          if (aT.need === 0 && bT.need > 0) return 1;
          if (aT.need > 0 && bT.need === 0) return -1;
          if (bT.need !== aT.need) return bT.need - aT.need;
          const ga = String(aT.group?.name || '');
          const gb = String(bT.group?.name || '');
          if (ga !== gb) return ga.localeCompare(gb);
          return String(aT.role.name).localeCompare(String(bT.role.name));
        });
        setMoveContext({ assignment: a, targets: allTargets });
        setMoveTargetId(null);
      },
      [roles, groupMap, peopleOptionsForSegment, selectedDateObj, seg, getRequiredFor, assignedEffectiveCountMap]
    );

    const [addSel, setAddSel] = useState<string[]>([]);
    const [openAdd, setOpenAdd] = useState(false);

    return (
      <Card
        className={s.roleCard}
        style={{
          borderLeftColor: accentColor,
          ["--scrollbar-thumb" as any]: tokens.colorNeutralStroke1,
        }}
      >
        <div className={s.roleHeader}>
          <Subtitle2>{role.name}</Subtitle2>
          <Badge
            appearance="tint"
            color={
              status === "under"
                ? "danger"
                : status === "exact"
                ? "success"
                : "warning"
            }
          >
            {assignedEffective}/{req}
          </Badge>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: tokens.spacingVerticalS,
          }}
        >
          <Dropdown
            placeholder={canEdit ? "+ Add person…" : "Add person…"}
            disabled={!canEdit}
            open={openAdd}
            onOpenChange={(_, d) => setOpenAdd(Boolean(d.open))}
            selectedOptions={addSel}
            onOptionSelect={(_, data) => {
              const val = data.optionValue ?? '';
              if (!val) return;
              const pid = Number(val);
              const info = overlapByPerson.get(pid);
              if (info?.heavy) {
                alert("Blocked by time off (major overlap) for this segment.");
                setAddSel([]);
                return;
              }
              addAssignment(selectedDate, pid, role.id, seg);
              setAddSel([]);
            }}
            style={{ width: "100%" }}
          >
            {openAdd &&
              sortedOpts.map((o) => {
                const info = overlapByPerson.get(o.id);
                const isHeavy = Boolean(info?.heavy);
                const isPartial = Boolean(info?.partial);
                const parts: string[] = [];
                if (isHeavy) parts.push("(Time-off)"); else if (isPartial) parts.push("(Partial Time-off)");
                // Warning if already assigned to a role that is at or below required (under/exact)
                const curRoleId = personAssignedRoleMap.get(o.id);
                const curStatus = curRoleId != null ? roleStatusById.get(curRoleId) : undefined;
                if (curStatus === "under" || curStatus === "exact") parts.push("(Assigned)");
                const suffix = parts.length ? ` ${parts.join(' ')}` : "";
                return (
                  <Option
                    key={o.id}
                    value={String(o.id)}
                    disabled={isHeavy}
                    text={`${o.label}${suffix}`}
                  >
                    {`${o.label}${suffix}`}
                  </Option>
                );
              })}
          </Dropdown>
        </div>
    <ul className={s.assignmentsList}>
      {assigns.map((a: any) => (
            <li key={a.id} className={s.assignmentItem}>
      <Body1 className={s.assignmentName}>
                <PersonName personId={a.person_id}>
                  {a.last_name}, {a.first_name}
                  {!trainedBefore.has(a.person_id) && " (Untrained)"}
                </PersonName>
        {(() => {
                  const info = overlapByPerson.get(a.person_id);
                  if (!info) return null;
                  const mins = info.minutes;
                  const pct = segDurationMinutes > 0 ? Math.round((mins / segDurationMinutes) * 100) : undefined;
                  const content = pct != null ? `Overlap: ${mins} min (${pct}%)` : `Overlap: ${mins} min`;
                  if (info.heavy) {
                    return (
                      <Tooltip content={content} relationship="label">
                        <Badge appearance="tint" color="danger" style={{ marginLeft: 8 }}>Time Off</Badge>
                      </Tooltip>
                    );
                  }
                  if (info.partial) {
                    return (
                      <Tooltip content={content} relationship="label">
                        <Badge appearance="tint" color="warning" style={{ marginLeft: 8 }}>Partial Time Off</Badge>
                      </Tooltip>
                    );
                  }
                  return null;
                })()}
      </Body1>
              {canEdit && (
                <div className={s.actionsRow}>
                  {!overlapByPerson.get(a.person_id)?.heavy && (
                    <Button size="small" appearance="secondary" onClick={() => handleMove(a)}>
                      Move
                    </Button>
                  )}
                  <Button size="small" appearance="secondary" onClick={() => deleteAssignment(a.id)}>
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    );
  });

  function confirmMove() {
    if (!moveContext || moveTargetId == null) return;
    const chosen = moveContext.targets.find((t) => t.role.id === moveTargetId);
    if (!chosen) return;
    if (
      !confirm(
        `Move ${moveContext.assignment.last_name}, ${moveContext.assignment.first_name} to ${chosen.group.name} - ${chosen.role.name}?`
      )
    )
      return;
    deleteAssignment(moveContext.assignment.id);
    addAssignment(selectedDate, moveContext.assignment.person_id, chosen.role.id, seg);
    setMoveContext(null);
    setMoveTargetId(null);
  }

  function cancelMove() {
    setMoveContext(null);
    setMoveTargetId(null);
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <label htmlFor="run-date-picker" style={{ display: "inline-block" }}>
            <Body1>
              <b>Date</b>
            </Body1>
          </label>
          <Input
            id="run-date-picker"
            type="date"
            value={ymd(selectedDateObj)}
            onChange={(_, data) => {
              const v = data.value;
              if (v) setSelectedDate(fmtDateMDY(parseYMD(v)));
            }}
          />
        </div>
        <div>
          <TabList
            selectedValue={activeRunSegment}
            onTabSelect={(_, data) => setActiveRunSegment(data.value as Segment)}
          >
            {segments.map((s) => (
              <Tab key={s.name} value={s.name}>
                {s.name}
              </Tab>
            ))}
          </TabList>
        </div>
        <div className={s.headerRight}>
          <Button appearance="secondary" onClick={() => setShowNeedsEditor(true)}>
            Edit Needs for This Day
          </Button>
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingHorizontalL }}>
          {groups.map((g: any) => (
            <GroupCard key={g.id} group={g} isDraggable={false} />
          ))}
        </div>
      ) : (
  <GridWP
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={RGL_ROW_HEIGHT}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
        >
          {groups.map((g: any) => (
            <div key={String(g.id)}>
              <GroupCard group={g} isDraggable={true} />
            </div>
          ))}
  </GridWP>
      )}

      {moveContext && (
        <Dialog open onOpenChange={(_, data) => { if (!data.open) cancelMove(); }}>
          <DialogTrigger>
            <span />
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Move {moveContext.assignment.last_name}, {moveContext.assignment.first_name}</DialogTitle>
              <DialogContent>
                <Dropdown
                  placeholder="Select destination"
                  selectedOptions={moveTargetId != null ? [String(moveTargetId)] : []}
                  onOptionSelect={(_, data) => {
                    const v = data.optionValue ?? data.optionText;
                    setMoveTargetId(v ? Number(v) : null);
                  }}
                  style={{ width: "100%" }}
                >
                  {moveContext.targets.map((t) => (
                    <Option key={t.role.id} value={String(t.role.id)}>
                      {`${t.group.name} - ${t.role.name}${t.need>0?` (need ${t.need})`:''}`}
                    </Option>
                  ))}
                </Dropdown>
              </DialogContent>
              <DialogActions>
                <Button onClick={cancelMove}>Cancel</Button>
                <Button appearance="primary" disabled={moveTargetId == null} onClick={confirmMove}>Move</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}

