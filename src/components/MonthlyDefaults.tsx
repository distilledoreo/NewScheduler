import React, { useMemo, useState } from "react";
import { Input, Button, Checkbox, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Link, makeStyles, tokens, Toolbar, ToolbarButton, ToolbarDivider, Dropdown, Option, Tooltip, Textarea } from "@fluentui/react-components";
import SmartSelect from "./controls/SmartSelect";
import PersonName from "./PersonName";
import { exportMonthOneSheetXlsx } from "../excel/export-one-sheet";
import { type Segment, type SegmentRow } from "../services/segments";
import { Note20Regular } from "@fluentui/react-icons";

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
      '& > *': {
        minWidth: 0,
      },
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
  });
  const styles = useStyles();
  const segmentNames = useMemo(() => segments.map(s => s.name as Segment), [segments]);
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeOnly, setActiveOnly] = useState(false);
  const [commuterOnly, setCommuterOnly] = useState(false);
  const [weekdayPerson, setWeekdayPerson] = useState<number | null>(null);
  const [notePerson, setNotePerson] = useState<number | null>(null);

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
                        const options = roleListForSegment(seg);
                        const optionsKey = options.map((r: any) => `${r.id}:${r.name}`).join(',');
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
        <div>
          <span className={styles.label}>Month</span>
          <Input className={styles.field} type="month" value={selectedMonth} onChange={(_, d) => setSelectedMonth(d.value)} />
        </div>
        <Button onClick={() => void applyMonthlyDefaults(selectedMonth)}>Apply to Month</Button>
        <div>
          <span className={styles.label}>Copy From</span>
          <Input className={styles.field} type="month" value={copyFromMonth} onChange={(_, d) => setCopyFromMonth(d.value)} />
        </div>
        <Button onClick={() => copyMonthlyDefaults(copyFromMonth, selectedMonth)}>Copy</Button>
        <Button onClick={() => setMonthlyEditing(!monthlyEditing)}>{monthlyEditing ? 'Done' : 'Edit'}</Button>
        <Button onClick={() => exportMonthlyDefaults(selectedMonth)}>Export HTML</Button>
        <Button onClick={() => exportMonthOneSheetXlsx(selectedMonth).catch((err) => alert(err.message))}>Export .xlsx</Button>
        <Input className={styles.field} placeholder="Filter" value={filterText} onChange={(_, data) => setFilterText(data.value)} />
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
                    const optionsKey = options.map((r: any) => `${r.id}:${r.name}`).join(',');
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
      {weekdayPerson !== null && (
        <WeeklyOverrideModal personId={weekdayPerson} onClose={() => setWeekdayPerson(null)} />
      )}
      {notePerson !== null && (
        <NotesModal personId={notePerson} onClose={() => setNotePerson(null)} />
      )}
    </div>
  );
}

