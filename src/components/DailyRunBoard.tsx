import React, { useEffect, useState, useMemo } from "react";
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
} from "@fluentui/react-components";

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      maxHeight: "240px",
      overflow: "auto",
      display: "grid",
      rowGap: tokens.spacingVerticalXS,
    },
    assignmentItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: tokens.colorNeutralBackground2,
      borderRadius: tokens.borderRadiusSmall,
      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    },
    actionsRow: {
      display: "flex",
      columnGap: tokens.spacingHorizontalS,
    },
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
      const roleCount = roles.filter((r) => r.group_id === g.id).length;
      const h = Math.max(2, Math.ceil(roleCount / 2)) + 1;
      return (
        byId.get(String(g.id)) || {
          i: String(g.id),
          x: (idx % 3) * 4,
          y: Math.floor(idx / 3) * h,
          w: 4,
          h,
        }
      );
    });
    setLayout(merged);
    setLayoutLoaded(true);
  }, [groups, lockEmail, seg, roles, all]);

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
    const assignedCountRows = all(
      `SELECT role_id, COUNT(*) as c FROM assignment WHERE date=? AND segment=? GROUP BY role_id`,
      [ymd(selectedDateObj), seg]
    );
    return new Map<number, number>(
      assignedCountRows.map((r: any) => [r.role_id, r.c])
    );
  }, [all, ymd, selectedDateObj, seg]);

  const groupMap = useMemo(
    () => new Map(groups.map((g: any) => [g.id, g])),
    [groups]
  );

  const deficitRoles = useMemo(
    () =>
      roles
        .map((r: any) => {
          const assigned = assignedCountMap.get(r.id) || 0;
          const req = getRequiredFor(selectedDateObj, r.group_id, r.id, seg);
          return assigned < req
            ? { role: r, group: groupMap.get(r.group_id) }
            : null;
        })
        .filter(Boolean) as Array<{ role: any; group: any }>,
    [roles, assignedCountMap, getRequiredFor, selectedDateObj, seg, groupMap]
  );

  function GroupCard({ group, isDraggable }: { group: any; isDraggable: boolean }) {
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
          header={
            <Body1>
              <b>{group.name}</b>
            </Body1>
          }
          description={
            <Caption1 className={s.groupMeta}>
              {group.theme || "No Theme"}
            </Caption1>
          }
        />
        <div
          className={s.rolesGrid}
          style={{
            gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
            ["--scrollbar-thumb" as any]: tokens.colorNeutralStroke1,
          }}
        >
          {rolesForGroup.map((r: any) => (
            <RoleCard key={r.id} group={group} role={r} />
          ))}
        </div>
      </Card>
    );
  }

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
    const status: "under" | "exact" | "over" =
      assignedCount < req ? "under" : assignedCount === req ? "exact" : "over";
    const accentColor =
      status === "under"
        ? tokens.colorPaletteRedBorderActive
        : status === "exact"
        ? tokens.colorPaletteGreenBorderActive
        : tokens.colorPaletteYellowBorderActive;
    const isOverstaffed = assignedCount > req;

    function handleMove(a: any, targets: any[]) {
      if (!targets.length) return;
      setMoveContext({ assignment: a, targets });
      setMoveTargetId(null);
    }

    const [addSel, setAddSel] = useState<string[]>([]);

    return (
      <Card
        className={s.roleCard}
        style={{
          borderLeftColor: accentColor,
          ["--scrollbar-thumb" as any]: tokens.colorNeutralStroke1,
        }}
      >
        <div className={s.roleHeader}>
          <Subtitle1>{role.name}</Subtitle1>
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
            {assignedCount}/{req}
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
                text={`${o.label}${o.blocked ? " (Time-off)" : ""}`}
              >
                {`${o.label}${o.blocked ? " (Time-off)" : ""}`}
              </Option>
            ))}
          </Dropdown>
        </div>
        <ul className={s.assignmentsList}>
          {assigns.map((a: any) => (
            <li key={a.id} className={s.assignmentItem}>
              <Body1>
                <PersonName personId={a.person_id}>
                  {a.last_name}, {a.first_name}
                  {!trainedBefore.has(a.person_id) && " (Untrained)"}
                </PersonName>
              </Body1>
              {canEdit && (
                <div className={s.actionsRow}>
                  {isOverstaffed &&
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
                  }
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
          <Title3 as="label" htmlFor="run-date-picker">
            Date
          </Title3>
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
        <Grid
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={80}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
        >
          {groups.map((g: any) => (
            <div key={String(g.id)}>
              <GroupCard group={g} isDraggable={true} />
            </div>
          ))}
        </Grid>
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

