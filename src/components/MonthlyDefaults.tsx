import React, { useMemo, useState } from "react";
import { Input, Dropdown, Option, Button, Checkbox, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from "@fluentui/react-components";
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
      <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded shadow-lg p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Weekly Overrides - {person.first_name} {person.last_name}</div>
            <button className="text-slate-600 hover:text-slate-800" onClick={onClose}>Close</button>
          </div>
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-1"></th>
                {weekdays.map(w => (
                  <th key={w} className="p-1">{WEEKDAYS[w - 1].slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segNames.map(seg => (
                <tr key={seg}>
                  <td className="p-1 font-medium">{seg}</td>
                  {weekdays.map(w => {
                    const ov = monthlyOverrides.find(o => o.person_id === personId && o.weekday === w && o.segment === seg);
                    return (
                      <td key={w} className="p-1">
                        <select className="border rounded px-2 py-1" value={ov?.role_id ?? ''} onChange={(e) => {
                          const val = e.target.value;
                          const rid = val === '' ? null : Number(val);
                          setWeeklyOverride(personId, w, seg, rid);
                        }}>
                          <option value="">(default)</option>
                          {roleListForSegment(seg).map((r: any) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm">Month</label>
        <input type="month" className="border rounded px-2 py-1" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
        <button className="px-3 py-1 bg-slate-200 rounded text-sm" onClick={() => applyMonthlyDefaults(selectedMonth)}>Apply to Month</button>
        <input type="month" className="border rounded px-2 py-1" value={copyFromMonth} onChange={(e) => setCopyFromMonth(e.target.value)} />
        <button className="px-3 py-1 bg-slate-200 rounded text-sm" onClick={() => copyMonthlyDefaults(copyFromMonth, selectedMonth)}>
          Copy From Month
        </button>
        <button className="px-3 py-1 bg-slate-200 rounded text-sm" onClick={() => setMonthlyEditing(!monthlyEditing)}>{monthlyEditing ? 'Done' : 'Edit'}</button>
        <button className="px-3 py-1 bg-slate-200 rounded text-sm" onClick={() => exportMonthlyDefaults(selectedMonth)}>Export HTML</button>
        <button
          className="px-3 py-1 bg-slate-200 rounded text-sm"
          onClick={() =>
            exportMonthOneSheetXlsx(selectedMonth).catch((err) => alert(err.message))
          }
        >
          Export One Sheet (.xlsx)
        </button>
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
      <div className="overflow-auto">
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
                    <button
                      className="ml-2 text-xs text-slate-600 underline"
                      onClick={() => setWeekdayPerson(p.id)}
                    >
                      Days{monthlyOverrides.some((o) => o.person_id === p.id) ? "*" : ""}
                    </button>
                  )}
                </TableCell>
                {segmentNames.map((seg) => {
                  const def = monthlyDefaults.find(
                    (d) => d.person_id === p.id && d.segment === seg,
                  );
                  return (
                    <TableCell key={seg}>
                      <select
                        className="border rounded px-2 py-1 w-full"
                        value={def?.role_id ?? ""}
                        disabled={!monthlyEditing}
                        onChange={(e) => {
                          const val = e.target.value;
                          const rid = val === "" ? null : Number(val);
                          setMonthlyDefault(p.id, seg, rid);
                        }}
                      >
                        <option value="">--</option>
                        {roleListForSegment(seg).map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
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

