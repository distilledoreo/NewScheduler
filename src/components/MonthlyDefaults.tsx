import React, { useMemo, useState } from "react";
import { Input, Dropdown, Option, Button, Checkbox, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Link, makeStyles, tokens, Toolbar, ToolbarButton, ToolbarDivider } from "@fluentui/react-components";
import PersonName from "./PersonName";
import { exportMonthOneSheetXlsx } from "../excel/export-one-sheet";
import { type Segment, type SegmentRow } from "../services/segments";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

interface MonthlyDefaultsProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  copyFromMonth: string;
  setCopyFromMonth: (month: string) => void;
  people: any[];
  segments: SegmentRow[];
  monthlyDefaults: any[];
  monthlyOverrides: any[];
  monthlyEditing: boolean;
  setMonthlyEditing: (v: boolean) => void;
  setMonthlyDefault: (personId: number, segment: Segment, roleId: number | null) => void;
  setWeeklyOverride: (personId: number, weekday: number, segment: Segment, roleId: number | null) => void;
  copyMonthlyDefaults: (fromMonth: string, toMonth: string) => void;
  applyMonthlyDefaults: (month: string) => void;
  exportMonthlyDefaults: (month: string) => void;
  roleListForSegment: (segment: Segment) => any[];
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
  monthlyEditing,
  setMonthlyEditing,
  setMonthlyDefault,
  setWeeklyOverride,
  copyMonthlyDefaults,
  applyMonthlyDefaults,
  exportMonthlyDefaults,
  roleListForSegment,
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      alignItems: 'end',
      gap: tokens.spacingHorizontalS,
      paddingBlockEnd: tokens.spacingVerticalS,
      minWidth: 0,
    },
    label: {
      fontSize: tokens.fontSizeBase300,
      color: tokens.colorNeutralForeground2,
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
  });
  const styles = useStyles();
  const segmentNames = useMemo(() => segments.map(s => s.name as Segment), [segments]);
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeOnly, setActiveOnly] = useState(false);
  const [commuterOnly, setCommuterOnly] = useState(false);
  const [weekdayPerson, setWeekdayPerson] = useState<number | null>(null);

  const viewPeople = useMemo(() => {
    let filtered = people.filter(p => {
      if (activeOnly && !p.active) return false;
      if (commuterOnly && !p.commuter) return false;
      if (filterText && !(p.first_name + " " + p.last_name).toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
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
  }, [people, monthlyDefaults, filterText, sortKey, sortDir, activeOnly, commuterOnly, segmentNames, roleListForSegment]);

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
                        return (
                          <TableCell key={w}>
                            <Dropdown
                              placeholder="(default)"
                              selectedOptions={ov?.role_id != null ? [String(ov.role_id)] : []}
                              onOptionSelect={(_, data) => {
                                const v = data.optionValue ?? data.optionText;
                                const rid = v ? Number(v) : null;
                                setWeeklyOverride(personId, w, seg, rid);
                              }}
                            >
                              <Option value="" text="(default)">(default)</Option>
                              {roleListForSegment(seg).map((r: any) => (
                                <Option key={r.id} value={String(r.id)}>{r.name}</Option>
                              ))}
                            </Dropdown>
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

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div>
          <span className={styles.label}>Month</span>
          <Input type="month" value={selectedMonth} onChange={(_, d) => setSelectedMonth(d.value)} />
        </div>
        <Button onClick={() => applyMonthlyDefaults(selectedMonth)}>Apply to Month</Button>
        <div>
          <span className={styles.label}>Copy From</span>
          <Input type="month" value={copyFromMonth} onChange={(_, d) => setCopyFromMonth(d.value)} />
        </div>
        <Button onClick={() => copyMonthlyDefaults(copyFromMonth, selectedMonth)}>Copy</Button>
        <Button onClick={() => setMonthlyEditing(!monthlyEditing)}>{monthlyEditing ? 'Done' : 'Edit'}</Button>
        <Button onClick={() => exportMonthlyDefaults(selectedMonth)}>Export HTML</Button>
        <Button onClick={() => exportMonthOneSheetXlsx(selectedMonth).catch((err) => alert(err.message))}>Export .xlsx</Button>
        <Input placeholder="Filter" value={filterText} onChange={(_, data) => setFilterText(data.value)} />
        <Dropdown selectedOptions={[sortKey]} onOptionSelect={(_, data) => setSortKey(data.optionValue as any)}>
          <Option value="name">Name</Option>
          <Option value="email">Email</Option>
          <Option value="brother_sister">B/S</Option>
          <Option value="commuter">Commute</Option>
          <Option value="active">Active</Option>
          <Option value="avail_mon">Mon</Option>
          <Option value="avail_tue">Tue</Option>
          <Option value="avail_wed">Wed</Option>
          <Option value="avail_thu">Thu</Option>
          <Option value="avail_fri">Fri</Option>
          {segmentNames.map(seg => (
            <Option key={seg} value={seg} text={`${seg} Role`} />
          ))}
        </Dropdown>
        <Button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>{sortDir === 'asc' ? 'Asc' : 'Desc'}</Button>
        <Checkbox label="Active" checked={activeOnly} onChange={(_, data) => setActiveOnly(!!data.checked)} />
        <Checkbox label="Commuter" checked={commuterOnly} onChange={(_, data) => setCommuterOnly(!!data.checked)} />
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
            {viewPeople.map((p: any) => (
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
                </TableCell>
                {segmentNames.map((seg) => {
                  const def = monthlyDefaults.find(
                    (d) => d.person_id === p.id && d.segment === seg,
                  );
                  return (
                    <TableCell key={seg}>
                      <Dropdown
                        placeholder="--"
                        selectedOptions={def?.role_id != null ? [String(def.role_id)] : []}
                        disabled={!monthlyEditing}
                        onOptionSelect={(_, data) => {
                          const v = data.optionValue ?? data.optionText;
                          const rid = v ? Number(v) : null;
                          setMonthlyDefault(p.id, seg, rid);
                        }}
                      >
                        <Option value="" text="--">--</Option>
                        {roleListForSegment(seg).map((r: any) => (
                          <Option key={r.id} value={String(r.id)}>{r.name}</Option>
                        ))}
                      </Dropdown>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {weekdayPerson !== null && (
        <WeeklyOverrideModal personId={weekdayPerson} onClose={() => setWeekdayPerson(null)} />
      )}
    </div>
  );
}

