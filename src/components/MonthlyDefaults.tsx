import { useEffect, useMemo, useState } from "react";
import { Input, Button, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Link, makeStyles, tokens, Dropdown, Option, Tooltip, Textarea, Badge } from "@fluentui/react-components";
import PeopleFiltersBar, { filterPeopleList, PeopleFiltersState, freshPeopleFilters } from "./filters/PeopleFilters";
import SmartSelect from "./controls/SmartSelect";
import PersonName from "./PersonName";
import { exportMonthOneSheetXlsx } from "../excel/export-one-sheet";
import { type Segment, type SegmentRow } from "../services/segments";
import { Note20Regular, Dismiss20Regular } from "@fluentui/react-icons";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type WeekdayKey = 1 | 2 | 3 | 4 | 5;
const WEEKDAY_ORDER: WeekdayKey[] = [1, 2, 3, 4, 5];

interface MonthlyDefaultsProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  copyFromMonth: string;
  setCopyFromMonth: (month: string) => void;
  people: any[];
  segments: SegmentRow[];
  monthlyDefaults: any[];
  monthlyOverrides: any[];
  monthlyNotes: any[];
  monthlyEditing: boolean;
  setMonthlyEditing: (v: boolean) => void;
  setMonthlyDefault: (personId: number, segment: Segment, roleId: number | null) => void;
  setWeeklyOverride: (personId: number, weekday: number, segment: Segment, roleId: number | null) => void;
  setMonthlyNote: (personId: number, note: string | null) => void;
  copyMonthlyDefaults: (fromMonth: string, toMonth: string) => void;
  applyMonthlyDefaults: (month: string) => Promise<void> | void;
  exportMonthlyDefaults: (month: string) => void;
  roleListForSegment: (segment: Segment) => any[];
  groups: any[];
  roles: any[];
  getRequiredFor: (date: Date, groupId: number, roleId: number, segment: Segment) => number;
}

export default function MonthlyDefaults({
  selectedMonth,
  setSelectedMonth,
  copyFromMonth,
  setCopyFromMonth,
  people,
  segments,
  monthlyDefaults,
  monthlyOverrides,
  monthlyNotes,
  monthlyEditing,
  setMonthlyEditing,
  setMonthlyDefault,
  setWeeklyOverride,
  setMonthlyNote,
  copyMonthlyDefaults,
  applyMonthlyDefaults,
  exportMonthlyDefaults,
  roleListForSegment,
  groups,
  roles,
  getRequiredFor,
}: MonthlyDefaultsProps) {
  const useStyles = makeStyles({
    root: {
      padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      boxSizing: 'border-box',
      rowGap: tokens.spacingVerticalM,
    },
    toolbar: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'end',
      gap: tokens.spacingHorizontalM,
      paddingBlockEnd: tokens.spacingVerticalS,
      minWidth: 0,
    },
    leftControls: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: tokens.spacingHorizontalS,
      alignItems: 'end',
    },
    rightActions: {
      display: 'flex',
      gap: tokens.spacingHorizontalS,
      alignItems: 'end',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    label: {
      fontSize: tokens.fontSizeBase300,
      color: tokens.colorNeutralForeground2,
    },
    field: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    },
    scroll: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflowX: 'auto',
      overflowY: 'auto',
      overscrollBehaviorX: 'contain',
    },
    inlineLink: {
      marginLeft: tokens.spacingHorizontalS,
      fontSize: tokens.fontSizeBase200,
    },
    dashboardPane: {
      position: 'fixed',
      bottom: tokens.spacingVerticalXL,
      right: tokens.spacingHorizontalXL,
      width: 'min(420px, calc(100vw - 32px))',
      maxHeight: '70vh',
      backgroundColor: tokens.colorNeutralBackground1,
      borderRadius: tokens.borderRadiusLarge,
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      boxShadow: tokens.shadow28,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 10,
    },
    dashboardHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
      columnGap: tokens.spacingHorizontalS,
    },
    dashboardHeading: {
      fontSize: tokens.fontSizeBase500,
      fontWeight: tokens.fontWeightSemibold,
    },
    dashboardMeta: {
      fontSize: tokens.fontSizeBase200,
      color: tokens.colorNeutralForeground3,
      marginTop: tokens.spacingVerticalXS,
    },
    dashboardContent: {
      padding: tokens.spacingHorizontalM,
      overflowY: 'auto',
      display: 'grid',
      gap: tokens.spacingVerticalM,
    },
    segmentCard: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusMedium,
      padding: tokens.spacingHorizontalM,
      display: 'grid',
      rowGap: tokens.spacingVerticalS,
      backgroundColor: tokens.colorNeutralBackground2,
    },
    segmentHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: tokens.spacingHorizontalS,
    },
    segmentTitle: {
      fontWeight: tokens.fontWeightSemibold,
      fontSize: tokens.fontSizeBase400,
    },
    roleRow: {
      borderRadius: tokens.borderRadiusMedium,
      padding: tokens.spacingHorizontalM,
      backgroundColor: tokens.colorNeutralBackground1,
      boxShadow: tokens.shadow4,
      display: 'grid',
      rowGap: tokens.spacingVerticalXS,
    },
    roleHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      columnGap: tokens.spacingHorizontalS,
      alignItems: 'baseline',
    },
    roleName: {
      fontWeight: tokens.fontWeightSemibold,
      fontSize: tokens.fontSizeBase300,
    },
    roleMeta: {
      fontSize: tokens.fontSizeBase200,
      color: tokens.colorNeutralForeground3,
    },
    metricsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: tokens.spacingHorizontalS,
      alignItems: 'stretch',
    },
    metricBlock: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: tokens.spacingVerticalXXS,
    },
    metricLabel: {
      fontSize: tokens.fontSizeBase200,
      color: tokens.colorNeutralForeground3,
    },
    metricValue: {
      fontSize: tokens.fontSizeBase400,
      fontWeight: tokens.fontWeightSemibold,
      fontVariantNumeric: 'tabular-nums',
    },
    metricHint: {
      fontSize: tokens.fontSizeBase200,
      color: tokens.colorNeutralForeground3,
    },
    weekdayChips: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: tokens.spacingHorizontalXS,
      marginTop: tokens.spacingVerticalXS,
    },
    weekdayChip: {
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacingHorizontalXXS,
      padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
      backgroundColor: tokens.colorNeutralBackground3,
      borderRadius: tokens.borderRadiusMedium,
      fontSize: tokens.fontSizeBase200,
      color: tokens.colorNeutralForeground2,
      fontVariantNumeric: 'tabular-nums',
    },
    emptyState: {
      padding: tokens.spacingVerticalL,
      textAlign: 'center',
      color: tokens.colorNeutralForeground3,
    },
  });
  const styles = useStyles();
  const segmentNames = useMemo(() => segments.map(s => s.name as Segment), [segments]);
  const [filters, setFilters] = useState<PeopleFiltersState>(() => freshPeopleFilters());
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [weekdayPerson, setWeekdayPerson] = useState<number | null>(null);
  const [notePerson, setNotePerson] = useState<number | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    if (!monthlyEditing) {
      setShowDashboard(false);
    }
  }, [monthlyEditing]);

  const dashboardData = useMemo(() => {
    const empty = {
      rows: [] as Array<{
        key: string;
        segment: Segment;
        roleId: number;
        roleName: string;
        groupName: string;
        requiredTotal: number;
        assignedTotal: number;
        requiredAvg: number;
        assignedAvg: number;
        weekdayBreakdown: Record<WeekdayKey, { requiredAvg: number; assignedAvg: number }>;
      }>,
      weekdayCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<WeekdayKey, number>,
      totalWeekdays: 0,
      monthLabel: '',
    };
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) {
      return empty;
    }
    const monthIndex = month - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) {
      return empty;
    }

    const weekdayCounts: Record<WeekdayKey, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const segmentOrder = new Map<Segment, number>(segmentNames.map((seg, idx) => [seg, idx]));
    const groupMap = new Map<number, any>(groups.map((g: any) => [g.id, g]));
    const roleMap = new Map<number, any>(roles.map((r: any) => [r.id, r]));
    const rolesByGroup = new Map<number, any[]>();
    for (const role of roles) {
      if (!rolesByGroup.has(role.group_id)) {
        rolesByGroup.set(role.group_id, []);
      }
      rolesByGroup.get(role.group_id)!.push(role);
    }

    type SummaryEntry = {
      key: string;
      groupId: number;
      roleId: number;
      segment: Segment;
      requiredTotal: number;
      assignedTotal: number;
      requiredByWeekday: Partial<Record<WeekdayKey, number>>;
      assignedByWeekday: Partial<Record<WeekdayKey, number>>;
    };

    const summaryMap = new Map<string, SummaryEntry>();
    const ensureEntry = (groupId: number, roleId: number, segment: Segment): SummaryEntry => {
      const key = `${groupId}|${roleId}|${segment}`;
      let entry = summaryMap.get(key);
      if (!entry) {
        entry = {
          key,
          groupId,
          roleId,
          segment,
          requiredTotal: 0,
          assignedTotal: 0,
          requiredByWeekday: {},
          assignedByWeekday: {},
        };
        summaryMap.set(key, entry);
      }
      return entry;
    };

    const defaultMap = new Map<string, number>();
    for (const def of monthlyDefaults) {
      if (def.role_id != null) {
        defaultMap.set(`${def.person_id}|${def.segment}`, def.role_id);
      }
    }
    const overrideMap = new Map<string, number>();
    for (const ov of monthlyOverrides) {
      if (ov.role_id != null) {
        overrideMap.set(`${ov.person_id}|${ov.weekday}|${ov.segment}`, ov.role_id);
      }
    }
    const personIds = new Set<number>();
    for (const def of monthlyDefaults) personIds.add(def.person_id);
    for (const ov of monthlyOverrides) personIds.add(ov.person_id);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      const weekday = dayOfWeek as WeekdayKey;
      weekdayCounts[weekday] += 1;

      for (const group of groups) {
        const groupRoles = rolesByGroup.get(group.id);
        if (!groupRoles) continue;
        for (const role of groupRoles) {
          const allowedSegments = Array.isArray(role.segments) ? (role.segments as Segment[]) : [];
          for (const seg of segmentNames) {
            if (!allowedSegments.includes(seg)) continue;
            const required = getRequiredFor(date, group.id, role.id, seg);
            if (required > 0) {
              const entry = ensureEntry(group.id, role.id, seg);
              entry.requiredTotal += required;
              entry.requiredByWeekday[weekday] = (entry.requiredByWeekday[weekday] ?? 0) + required;
            }
          }
        }
      }

      for (const personId of personIds) {
        for (const seg of segmentNames) {
          let roleId = overrideMap.get(`${personId}|${weekday}|${seg}`);
          if (roleId === undefined) {
            roleId = defaultMap.get(`${personId}|${seg}`);
          }
          if (roleId == null) continue;
          const role = roleMap.get(roleId);
          if (!role) continue;
          const allowedSegments = Array.isArray(role.segments) ? (role.segments as Segment[]) : [];
          if (!allowedSegments.includes(seg)) continue;
          const entry = ensureEntry(role.group_id, role.id, seg);
          entry.assignedTotal += 1;
          entry.assignedByWeekday[weekday] = (entry.assignedByWeekday[weekday] ?? 0) + 1;
        }
      }
    }

    const totalWeekdays = WEEKDAY_ORDER.reduce((sum, key) => sum + (weekdayCounts[key] || 0), 0);

    const rows = Array.from(summaryMap.values())
      .filter((entry) => entry.requiredTotal > 0 || entry.assignedTotal > 0)
      .map((entry) => {
        const role = roleMap.get(entry.roleId);
        const group = groupMap.get(entry.groupId);
        const breakdown = {} as Record<WeekdayKey, { requiredAvg: number; assignedAvg: number }>;
        for (const w of WEEKDAY_ORDER) {
          const occurrences = weekdayCounts[w] || 0;
          const requiredByDay = entry.requiredByWeekday[w] ?? 0;
          const assignedByDay = entry.assignedByWeekday[w] ?? 0;
          breakdown[w] = {
            requiredAvg: occurrences ? requiredByDay / occurrences : 0,
            assignedAvg: occurrences ? assignedByDay / occurrences : 0,
          };
        }
        return {
          key: entry.key,
          segment: entry.segment,
          roleId: entry.roleId,
          roleName: role?.name ?? `Role ${entry.roleId}`,
          groupName: group?.name ?? `Group ${entry.groupId}`,
          requiredTotal: entry.requiredTotal,
          assignedTotal: entry.assignedTotal,
          requiredAvg: totalWeekdays ? entry.requiredTotal / totalWeekdays : 0,
          assignedAvg: totalWeekdays ? entry.assignedTotal / totalWeekdays : 0,
          weekdayBreakdown: breakdown,
        };
      })
      .sort((a, b) => {
        const segIdxA = segmentOrder.get(a.segment) ?? 0;
        const segIdxB = segmentOrder.get(b.segment) ?? 0;
        if (segIdxA !== segIdxB) return segIdxA - segIdxB;
        if (a.groupName !== b.groupName) return a.groupName.localeCompare(b.groupName);
        return a.roleName.localeCompare(b.roleName);
      });

    const labelDate = new Date(year, monthIndex, 1);
    const monthLabel = Number.isNaN(labelDate.getTime())
      ? ''
      : labelDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    return { rows, weekdayCounts, totalWeekdays, monthLabel };
  }, [selectedMonth, monthlyDefaults, monthlyOverrides, segmentNames, groups, roles, getRequiredFor]);

  const formatAverage = (value: number) => {
    if (!Number.isFinite(value) || Math.abs(value) < 0.05) return "0";
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 0.05) return String(rounded);
    return value.toFixed(1);
  };

  const formatSigned = (value: number) => {
    if (!Number.isFinite(value) || Math.abs(value) < 0.05) return "0";
    const rounded = Math.round(Math.abs(value));
    const base = Math.abs(Math.abs(value) - rounded) < 0.05 ? String(rounded) : Math.abs(value).toFixed(1);
    return `${value > 0 ? "+" : "-"}${base}`;
  };

  const viewPeople = useMemo(() => {
    const filtered = filterPeopleList(people, filters);
    const sorted = [...filtered].sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (sortKey === "name") {
        av = `${a.last_name} ${a.first_name}`.toLowerCase();
        bv = `${b.last_name} ${b.first_name}`.toLowerCase();
      } else if (sortKey === "email") {
        av = a.email?.toLowerCase() ?? "";
        bv = b.email?.toLowerCase() ?? "";
      } else if (sortKey === "brother_sister") {
        av = a.brother_sister;
        bv = b.brother_sister;
      } else if (sortKey === "commuter") {
        av = a.commuter;
        bv = b.commuter;
      } else if (sortKey === "active") {
        av = a.active;
        bv = b.active;
      } else if (segmentNames.includes(sortKey as Segment)) {
        const defA = monthlyDefaults.find(d => d.person_id === a.id && d.segment === sortKey);
        const defB = monthlyDefaults.find(d => d.person_id === b.id && d.segment === sortKey);
        const segRoles = roleListForSegment(sortKey as Segment);
        av = defA ? segRoles.find(r => r.id === defA.role_id)?.name ?? "" : "";
        bv = defB ? segRoles.find(r => r.id === defB.role_id)?.name ?? "" : "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [people, monthlyDefaults, filters, sortKey, sortDir, segmentNames, roleListForSegment]);

  function WeeklyOverrideModal({ personId, onClose }: { personId: number; onClose: () => void }) {
    const person = people.find(p => p.id === personId);
    if (!person) return null;
    const weekdays = [1, 2, 3, 4, 5];
    const segNames = segmentNames;
    return (
      <Dialog open onOpenChange={(_, d)=>{ if(!d.open) onClose(); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Weekly Overrides - {person.first_name} {person.last_name}</DialogTitle>
            <DialogContent>
              <Table size="small" aria-label="Weekly overrides">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell></TableHeaderCell>
                    {weekdays.map(w => (
                      <TableHeaderCell key={w}>{WEEKDAYS[w - 1].slice(0, 3)}</TableHeaderCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segNames.map(seg => (
                    <TableRow key={seg}>
                      <TableCell>{seg}</TableCell>
                      {weekdays.map(w => {
                        const ov = monthlyOverrides.find(o => o.person_id === personId && o.weekday === w && o.segment === seg);
                        const options = roleListForSegment(seg);
                        return (
                          <TableCell key={w}>
                            <SmartSelect
                              options={[{ value: "", label: "(default)" }, ...options.map((r: any) => ({ value: String(r.id), label: r.name }))]}
                              value={ov?.role_id != null ? String(ov.role_id) : null}
                              onChange={(v) => {
                                const rid = v ? Number(v) : null;
                                setWeeklyOverride(personId, w, seg, rid);
                              }}
                              placeholder="(default)"
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }

  function NotesModal({ personId, onClose }: { personId: number; onClose: () => void }) {
    const person = people.find(p => p.id === personId);
    if (!person) return null;
    const noteObj = monthlyNotes.find(n => n.person_id === personId);
    const [text, setText] = useState<string>(noteObj?.note || "");
    return (
      <Dialog open onOpenChange={(_, d)=>{ if(!d.open) onClose(); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Notes - {person.first_name} {person.last_name}</DialogTitle>
            <DialogContent>
              <Textarea value={text} onChange={(_, d) => setText(d.value)} />
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => { setMonthlyNote(personId, text); onClose(); }}>Save</Button>
              <Button onClick={onClose}>Cancel</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.leftControls}>
          <div>
          <span className={styles.label}>Month</span>
          <Input className={styles.field} type="month" value={selectedMonth} onChange={(_, d) => setSelectedMonth(d.value)} />
          </div>
          <div>
          <span className={styles.label}>Copy From</span>
          <Input className={styles.field} type="month" value={copyFromMonth} onChange={(_, d) => setCopyFromMonth(d.value)} />
          </div>
          <div>
            <span className={styles.label}>Sort by</span>
            <Dropdown className={styles.field} selectedOptions={[sortKey]} onOptionSelect={(_, data) => setSortKey(data.optionValue as any)}>
          <Option value="name" text="Name">Name</Option>
          <Option value="email" text="Email">Email</Option>
          <Option value="brother_sister" text="B/S">B/S</Option>
          <Option value="commuter" text="Commute">Commute</Option>
          <Option value="active" text="Active">Active</Option>
          <Option value="avail_mon" text="Mon">Mon</Option>
          <Option value="avail_tue" text="Tue">Tue</Option>
          <Option value="avail_wed" text="Wed">Wed</Option>
          <Option value="avail_thu" text="Thu">Thu</Option>
          <Option value="avail_fri" text="Fri">Fri</Option>
          {segmentNames.map(seg => (
            <Option key={seg} value={seg} text={`${seg} Role`}>{`${seg} Role`}</Option>
          ))}
            </Dropdown>
          </div>
          <div>
            <span className={styles.label}>People filters</span>
            <PeopleFiltersBar state={filters} onChange={(next) => setFilters((s) => ({ ...s, ...next }))} />
          </div>
        </div>
        <div className={styles.rightActions}>
          <Button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>{sortDir === 'asc' ? 'Asc' : 'Desc'}</Button>
          <Button onClick={() => setMonthlyEditing(!monthlyEditing)}>{monthlyEditing ? 'Done' : 'Edit'}</Button>
          {monthlyEditing && (
            <Button
              appearance={showDashboard ? 'primary' : 'secondary'}
              onClick={() => setShowDashboard((prev) => !prev)}
            >
              {showDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
            </Button>
          )}
          <Button onClick={() => void applyMonthlyDefaults(selectedMonth)}>Apply to Month</Button>
          <Button onClick={() => copyMonthlyDefaults(copyFromMonth, selectedMonth)}>Copy</Button>
          <Button onClick={() => exportMonthlyDefaults(selectedMonth)}>Export HTML</Button>
          <Button onClick={() => exportMonthOneSheetXlsx(selectedMonth).catch((err) => alert(err.message))}>Export .xlsx</Button>
        </div>
      </div>
  <div className={styles.scroll}>
        <Table size="small" aria-label="Monthly defaults">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              {segmentNames.map((seg) => (
                <TableHeaderCell key={seg}>{seg}</TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {viewPeople.map((p: any) => {
              const note = monthlyNotes.find(n => n.person_id === p.id)?.note;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <PersonName personId={p.id}>
                      {p.last_name}, {p.first_name}
                    </PersonName>
                    {monthlyEditing && (
                      <Link appearance="subtle" className={styles.inlineLink} onClick={() => setWeekdayPerson(p.id)}>
                        Days{monthlyOverrides.some((o) => o.person_id === p.id) ? "*" : ""}
                      </Link>
                    )}
                    {(note || monthlyEditing) && (
                      <Tooltip content={note || "Add note"} relationship="description">
                        <Button size="small" appearance="subtle" icon={<Note20Regular />} onClick={() => setNotePerson(p.id)} />
                      </Tooltip>
                    )}
                  </TableCell>
                  {segmentNames.map((seg) => {
                    const def = monthlyDefaults.find(
                      (d) => d.person_id === p.id && d.segment === seg,
                    );
                    const options = roleListForSegment(seg);
                    return (
                      <TableCell key={seg}>
                        <SmartSelect
                          options={[{ value: "", label: "--" }, ...options.map((r: any) => ({ value: String(r.id), label: r.name }))]}
                          value={def?.role_id != null ? String(def.role_id) : null}
                          onChange={(v) => {
                            const rid = v ? Number(v) : null;
                            setMonthlyDefault(p.id, seg, rid);
                          }}
                          placeholder="--"
                          disabled={!monthlyEditing}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {monthlyEditing && showDashboard && (
        <div className={styles.dashboardPane}>
          <div className={styles.dashboardHeader}>
            <div>
              <div className={styles.dashboardHeading}>Monthly Coverage</div>
              <div className={styles.dashboardMeta}>
                {dashboardData.monthLabel
                  ? `${dashboardData.monthLabel} · ${dashboardData.totalWeekdays} weekdays`
                  : 'Select a month to see coverage insights'}
              </div>
              <div className={styles.weekdayChips}>
                {WEEKDAY_ORDER.map((w) => {
                  const count = dashboardData.weekdayCounts[w] ?? 0;
                  if (!count) return null;
                  return (
                    <span key={w} className={styles.weekdayChip}>
                      {WEEKDAYS[w - 1].slice(0, 3)} × {count}
                    </span>
                  );
                })}
              </div>
            </div>
            <Button
              appearance="subtle"
              icon={<Dismiss20Regular />}
              onClick={() => setShowDashboard(false)}
              aria-label="Close coverage dashboard"
            />
          </div>
          <div className={styles.dashboardContent}>
            {dashboardData.rows.length === 0 ? (
              <div className={styles.emptyState}>
                Monthly defaults will appear here once roles are assigned.
              </div>
            ) : (
              segmentNames
                .map((seg) => ({ segment: seg, rows: dashboardData.rows.filter((row) => row.segment === seg) }))
                .filter((entry) => entry.rows.length > 0)
                .map((entry) => (
                  <div key={entry.segment} className={styles.segmentCard}>
                    <div className={styles.segmentHeader}>
                      <div className={styles.segmentTitle}>{entry.segment}</div>
                      <Badge appearance="ghost">
                        {entry.rows.length} role{entry.rows.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    {entry.rows.map((row) => {
                      const diffAvg = row.assignedAvg - row.requiredAvg;
                      const diffMagnitude = Math.abs(diffAvg);
                      const diffLabel = diffMagnitude < 0.05 ? 'On target' : `${formatSigned(diffAvg)} avg`;
                      const diffColor = diffMagnitude < 0.05 ? 'informative' : diffAvg > 0 ? 'success' : 'danger';
                      const totalDiff = row.assignedTotal - row.requiredTotal;
                      const totalDiffLabel = totalDiff === 0 ? '0 diff' : `${totalDiff > 0 ? '+' : ''}${totalDiff} diff`;
                      return (
                        <div key={row.key} className={styles.roleRow}>
                          <div className={styles.roleHeader}>
                            <div>
                              <div className={styles.roleName}>{row.roleName}</div>
                              <div className={styles.roleMeta}>{row.groupName}</div>
                            </div>
                            <Badge appearance="outline" color={diffColor}>
                              {diffLabel}
                            </Badge>
                          </div>
                          <div className={styles.metricsRow}>
                            <div className={styles.metricBlock}>
                              <span className={styles.metricLabel}>Avg need</span>
                              <span className={styles.metricValue}>{formatAverage(row.requiredAvg)}</span>
                              <span className={styles.metricHint}>{row.requiredTotal} total</span>
                            </div>
                            <div className={styles.metricBlock}>
                              <span className={styles.metricLabel}>Avg defaults</span>
                              <span className={styles.metricValue}>{formatAverage(row.assignedAvg)}</span>
                              <span className={styles.metricHint}>{row.assignedTotal} total</span>
                            </div>
                            <div className={styles.metricBlock}>
                              <span className={styles.metricLabel}>Totals</span>
                              <span className={styles.metricValue}>
                                {row.assignedTotal}/{row.requiredTotal}
                              </span>
                              <span className={styles.metricHint}>{totalDiffLabel}</span>
                            </div>
                          </div>
                          <div className={styles.weekdayChips}>
                            {WEEKDAY_ORDER.map((w) => {
                              const occurrences = dashboardData.weekdayCounts[w] ?? 0;
                              if (!occurrences) return null;
                              const breakdown = row.weekdayBreakdown[w];
                              return (
                                <Tooltip
                                  key={w}
                                  content={`${occurrences} ${WEEKDAYS[w - 1]}${occurrences === 1 ? '' : 's'} this month`}
                                  relationship="description"
                                >
                                  <span className={styles.weekdayChip}>
                                    {WEEKDAYS[w - 1].slice(0, 3)} {formatAverage(breakdown.assignedAvg)}/
                                    {formatAverage(breakdown.requiredAvg)}
                                  </span>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
            )}
          </div>
        </div>
      )}
      {weekdayPerson !== null && (
        <WeeklyOverrideModal personId={weekdayPerson} onClose={() => setWeekdayPerson(null)} />
      )}
      {notePerson !== null && (
        <NotesModal personId={notePerson} onClose={() => setNotePerson(null)} />
      )}
    </div>
  );
}

