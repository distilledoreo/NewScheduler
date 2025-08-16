import React, { useEffect, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Segment, SegmentRow } from "../services/segments";
import "../styles/scrollbar.css";
import PersonName from "./PersonName";
import { Button, Dropdown, Option, Tab, TabList, Input, tokens, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger, makeStyles, Badge } from "@fluentui/react-components";

const Grid = WidthProvider(GridLayout);

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
  const useStyles = makeStyles({
    root: { padding: "16px" },
    header: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "16px",
      marginBottom: "16px",
      [`@media (min-width: 1024px)`]: {
        flexDirection: "row",
        alignItems: "center",
      },
    },
    headerLeft: { display: "flex", alignItems: "center", gap: "8px" },
    headerRight: { display: "flex", flexWrap: "wrap", gap: "8px", marginLeft: "auto" },
    label: { fontSize: tokens.fontSizeBase300, color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap' },
    groupCard: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusMedium,
      boxShadow: tokens.shadow2,
      backgroundColor: tokens.colorNeutralBackground1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    },
    groupHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM} 0 ${tokens.spacingHorizontalM}`,
    },
    groupMeta: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
    rolesGrid: {
      flex: 1,
      display: 'grid',
      gap: tokens.spacingHorizontalS,
      padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
      overflow: 'auto',
    },
    roleCard: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderLeftWidth: '4px',
      borderRadius: tokens.borderRadiusMedium,
      backgroundColor: tokens.colorNeutralBackground1,
      padding: tokens.spacingHorizontalS,
    },
    roleHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacingVerticalXS,
    },
    assignmentsList: {
      listStyleType: 'none',
      padding: 0,
      margin: 0,
      maxHeight: '240px',
      overflow: 'auto',
      display: 'grid',
      rowGap: tokens.spacingVerticalXS,
    },
    assignmentItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: tokens.colorNeutralBackground2,
      borderRadius: tokens.borderRadiusSmall,
      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    },
    actionsRow: { display: 'flex', columnGap: tokens.spacingHorizontalS },
  });
  const s = useStyles();
  const seg: Segment = activeRunSegment;
  const [layout, setLayout] = useState<any[]>([]);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [moveContext, setMoveContext] = useState<{
    assignment: any;
    targets: Array<{ role: any; group: any }>;
  } | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<number | null>(null);

  useEffect(() => {
    setLayoutLoaded(false);
    const key = `layout:${seg}:${lockEmail || 'default'}`;
    let saved: any[] = [];
    try {
      const rows = all(`SELECT value FROM meta WHERE key=?`, [key]);
      if (rows[0] && rows[0].value) saved = JSON.parse(String(rows[0].value));
    } catch {}
    const byId = new Map(saved.map((l: any) => [l.i, l]));
    const merged = groups.map((g: any, idx: number) => {
      const roleCount = roleListForSegment(seg).filter((r) => r.group_id === g.id).length;
      const h = Math.max(2, roleCount + 1);
      return byId.get(String(g.id)) || { i: String(g.id), x: (idx % 4) * 3, y: Math.floor(idx / 4) * h, w: 3, h };
    });
    setLayout(merged);
    setLayoutLoaded(true);
  }, [groups, lockEmail, seg, roleListForSegment]);

  function handleLayoutChange(l: any[]) {
    setLayout(l);
    if (!layoutLoaded) return;
    const key = `layout:${seg}:${lockEmail || 'default'}`;
    try {
      const stmt = sqlDb.prepare(`INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)`);
      stmt.bind([key, JSON.stringify(l)]);
      stmt.step();
      stmt.free();
    } catch {}
  }

  const roles = roleListForSegment(seg);
  const assignedCountRows = all(
    `SELECT role_id, COUNT(*) as c FROM assignment WHERE date=? AND segment=? GROUP BY role_id`,
    [ymd(selectedDateObj), seg]
  );
  const assignedCountMap = new Map<number, number>(
    assignedCountRows.map((r: any) => [r.role_id, r.c])
  );
  const groupMap = new Map(groups.map((g: any) => [g.id, g]));
  const deficitRoles = roles
    .map((r: any) => {
      const assigned = assignedCountMap.get(r.id) || 0;
      const req = getRequiredFor(selectedDateObj, r.group_id, r.id, seg);
      return assigned < req ? { role: r, group: groupMap.get(r.group_id) } : null;
    })
    .filter(Boolean) as Array<{ role: any; group: any }>;

  function RoleCard({ group, role }: { group: any; role: any }) {
    const assigns = all(
      `SELECT a.id, p.first_name, p.last_name, p.id as person_id FROM assignment a JOIN person p ON p.id=a.person_id WHERE a.date=? AND a.role_id=? AND a.segment=? ORDER BY p.last_name,p.first_name`,
      [ymd(selectedDateObj), role.id, seg]
    );
    const trainedBefore = new Set([
      ...all(`SELECT person_id FROM training WHERE role_id=? AND status='Qualified'`, [role.id]).map(
        (r: any) => r.person_id
      ),
      ...all(
        `SELECT DISTINCT person_id FROM assignment WHERE role_id=? AND date < ?`,
        [role.id, ymd(selectedDateObj)]
      ).map((r: any) => r.person_id),
    ]);
    const opts = peopleOptionsForSegment(selectedDateObj, seg, role);

    const req = getRequiredFor(selectedDateObj, group.id, role.id, seg);
    const assignedCount = assigns.length;
    const status: 'under' | 'exact' | 'over' = assignedCount < req ? 'under' : assignedCount === req ? 'exact' : 'over';
    const accentColor = status === 'under'
      ? (isDark ? tokens.colorPaletteRedBackground2 : tokens.colorPaletteRedBackground3)
      : status === 'exact'
      ? (isDark ? tokens.colorPaletteGreenBackground2 : tokens.colorPaletteGreenBackground3)
      : (isDark ? tokens.colorPaletteYellowBackground2 : tokens.colorPaletteYellowBackground3);
    const isOverstaffed = assignedCount > req;

    function handleMove(a: any, targets: any[]) {
      if (!targets.length) return;
      setMoveContext({ assignment: a, targets });
      setMoveTargetId(null);
    }

    const [addSel, setAddSel] = useState<string[]>([]);

    return (
      <div className={s.roleCard} style={{ borderLeftColor: accentColor, ["--scrollbar-thumb" as any]: tokens.colorNeutralStroke1 }}>
        <div className={s.roleHeader}>
          <div style={{ fontWeight: 600 }}>{role.name}</div>
          <Badge appearance="tint" color={status === 'under' ? 'danger' : status === 'exact' ? 'success' : 'warning'}>
            {assignedCount}/{req}
          </Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: tokens.spacingVerticalXS }}>
          <Dropdown
            placeholder={canEdit ? "+ Add person…" : "Add person…"}
            disabled={!canEdit}
            selectedOptions={addSel}
            onOptionSelect={(_, data) => {
              const val = data.optionValue ?? '';
              if (!val) return;
              const pid = Number(val);
              const sel = opts.find((o) => o.id === pid);
              if (sel?.blocked) {
                alert("Blocked by time-off for this segment.");
                setAddSel([]);
                return;
              }
              addAssignment(selectedDate, pid, role.id, seg);
              setAddSel([]);
            }}
            style={{ width: "100%" }}
          >
            {opts.map((o) => (
              <Option
                key={o.id}
                value={String(o.id)}
                disabled={o.blocked}
              >
                {`${o.label}${o.blocked ? " (Time-off)" : ""}`}
              </Option>
            ))}
          </Dropdown>
        </div>
        <ul className={s.assignmentsList}>
          {assigns.map((a: any) => (
            <li key={a.id} className={s.assignmentItem}>
              <PersonName personId={a.person_id}>
                {a.last_name}, {a.first_name}
                {!trainedBefore.has(a.person_id) && " (Untrained)"}
              </PersonName>
              {canEdit && (
                <div className={s.actionsRow}>
                  {isOverstaffed && (
                    (() => {
                      const targets = deficitRoles.filter((d: any) => {
                        const opts = peopleOptionsForSegment(selectedDateObj, seg, d.role);
                        return opts.some(
                          (o) => o.id === a.person_id && !o.blocked
                        );
                      });
                      return targets.length ? (
                        <Button size="small" appearance="secondary" onClick={() => handleMove(a, targets)}>
                          Move
                        </Button>
                      ) : null;
                    })()
                  )}
                  <Button size="small" appearance="secondary" onClick={() => deleteAssignment(a.id)}>
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

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
          <span className={s.label}>Date</span>
          <Input
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

      <Grid
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={80}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
      >
        {groups.map((g: any) => {
          const rolesForGroup = roles.filter((r) => r.group_id === g.id);
          const groupNeedsMet = rolesForGroup.every((r: any) => {
            const assignedCount = assignedCountMap.get(r.id) || 0;
            const req = getRequiredFor(selectedDateObj, g.id, r.id, seg);
            return assignedCount >= req;
          });
          const groupAccent = groupNeedsMet
            ? (isDark ? tokens.colorPaletteGreenBackground2 : tokens.colorPaletteGreenBackground3)
            : (isDark ? tokens.colorPaletteRedBackground2 : tokens.colorPaletteRedBackground3);
          return (
            <div
              key={String(g.id)}
              className={s.groupCard}
              style={{ borderLeft: `4px solid ${groupAccent}`, ["--scrollbar-thumb" as any]: tokens.colorNeutralStroke1 }}
            >
              <div className={`${s.groupHeader} drag-handle`}>
                <span style={{ fontWeight: 600 }}>{g.name}</span>
                <span className={s.groupMeta}>Theme: {g.theme || '-'}</span>
                <span className={s.groupMeta}>Color: {g.custom_color || '-'}</span>
              </div>
              <div className={s.rolesGrid} style={{ gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))" }}>
                {rolesForGroup.map((r: any) => (
                  <RoleCard key={r.id} group={g} role={r} />
                ))}
              </div>
            </div>
          );
        })}
      </Grid>

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
                      {`${t.group.name} - ${t.role.name}`}
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

