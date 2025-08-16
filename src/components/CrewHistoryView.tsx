import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input, Dropdown, Option, Button, Checkbox } from "@fluentui/react-components";
import PersonName from "./PersonName";
import type { Segment } from "../services/segments";

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

interface CrewHistoryViewProps {
  sqlDb: any;
  monthlyDefaults: any[];
  segments: any[];
  people: any[];
  roles: any[];
  groups: any[];
  roleListForSegment: (segment: Segment) => any[];
  setMonthlyDefaultForMonth: (
    month: string,
    personId: number,
    segment: Segment,
    roleId: number | null,
  ) => void;
  all: (sql: string, params?: any[]) => any[];
}

export default function CrewHistoryView({
  sqlDb,
  monthlyDefaults,
  segments,
  people,
  roles,
  groups,
  roleListForSegment,
  setMonthlyDefaultForMonth,
  all,
}: CrewHistoryViewProps) {
  const [defs, setDefs] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const segmentNames = useMemo(
    () => segments.map((s) => s.name as Segment),
    [segments],
  );
  const [showSeg, setShowSeg] = useState<Record<string, boolean>>(
    () => Object.fromEntries(segmentNames.map((s) => [s, true])),
  );
  const [activeOnly, setActiveOnly] = useState(false);
  const [commuterOnly, setCommuterOnly] = useState(false);
  const [bsFilter, setBsFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>("last");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [editPast, setEditPast] = useState(false);

  useEffect(() => {
    if (sqlDb) {
      setDefs(all(`SELECT * FROM monthly_default`));
    }
  }, [sqlDb, monthlyDefaults]);

  const nextMonth = useMemo(() => {
    const now = new Date();
    const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${nm.getFullYear()}-${pad2(nm.getMonth() + 1)}`;
  }, []);

  useEffect(() => {
    if (startMonth && endMonth) return;
    let min: string | null = null;
    let max: string | null = null;
    defs.forEach((d: any) => {
      if (!min || d.month < min) min = d.month;
      if (!max || d.month > max) max = d.month;
    });
    const nm = nextMonth;
    if (!min) min = nm;
    if (!max || nm > max) max = nm;
    setStartMonth(min);
    setEndMonth(max);
  }, [defs, nextMonth, startMonth, endMonth]);

  const months = useMemo(() => {
    const arr: string[] = [];
    if (!startMonth || !endMonth) return arr;
    const [sy, sm] = startMonth.split("-").map(Number);
    const [ey, em] = endMonth.split("-").map(Number);
    let d = new Date(sy, sm - 1, 1);
    const end = new Date(ey, em - 1, 1);
    while (d <= end) {
      arr.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
      d.setMonth(d.getMonth() + 1);
    }
    return arr;
  }, [startMonth, endMonth]);

  useEffect(() => {
    if (months.length && !months.includes(filterMonth)) {
      setFilterMonth(months[0]);
    }
  }, [months, filterMonth]);

  const filteredPeople = useMemo(() => {
    const low = filter.toLowerCase();
    const monthsToCheck = filterMonth ? [filterMonth] : months;
    return people
      .filter((p: any) => !activeOnly || p.active)
      .filter((p: any) => !commuterOnly || p.commuter)
      .filter((p: any) => !bsFilter || p.brother_sister === bsFilter)
      .filter((p: any) => {
        if (groupFilter.length === 0) return true;
        return monthsToCheck.some((m) =>
          segmentNames.some((seg) => {
            const def = defs.find(
              (d) => d.month === m && d.person_id === p.id && d.segment === seg,
            );
            const role = roles.find((r) => r.id === def?.role_id);
            return role && groupFilter.includes(role.group_name);
          }),
        );
      })
      .filter((p: any) => {
        const roleNames = monthsToCheck.flatMap((m) =>
          segmentNames.map((seg) => {
            const def = defs.find(
              (d) => d.month === m && d.person_id === p.id && d.segment === seg,
            );
            const role = roles.find((r) => r.id === def?.role_id);
            return role?.name || "";
          }),
        );
        const text = [
          p.first_name,
          p.last_name,
          p.brother_sister || "",
          p.commuter ? "commuter" : "",
          p.active ? "active" : "",
          p.avail_mon,
          p.avail_tue,
          p.avail_wed,
          p.avail_thu,
          p.avail_fri,
          ...roleNames,
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(low);
      })
      .sort((a: any, b: any) => {
        let av: any;
        let bv: any;
        switch (sortField) {
          case "last":
            av = a.last_name;
            bv = b.last_name;
            break;
          case "first":
            av = a.first_name;
            bv = b.first_name;
            break;
          case "brother_sister":
            av = a.brother_sister || "";
            bv = b.brother_sister || "";
            break;
          case "commuter":
            av = a.commuter ? 1 : 0;
            bv = b.commuter ? 1 : 0;
            break;
          case "active":
            av = a.active ? 1 : 0;
            bv = b.active ? 1 : 0;
            break;
          case "avail_mon":
            av = a.avail_mon;
            bv = b.avail_mon;
            break;
          case "avail_tue":
            av = a.avail_tue;
            bv = b.avail_tue;
            break;
          case "avail_wed":
            av = a.avail_wed;
            bv = b.avail_wed;
            break;
          case "avail_thu":
            av = a.avail_thu;
            bv = b.avail_thu;
            break;
          case "avail_fri":
            av = a.avail_fri;
            bv = b.avail_fri;
            break;
          default:
            if (segmentNames.includes(sortField)) {
              const month = filterMonth || months[0];
              const defA = defs.find(
                (d) =>
                  d.month === month &&
                  d.person_id === a.id &&
                  d.segment === sortField,
              );
              const defB = defs.find(
                (d) =>
                  d.month === month &&
                  d.person_id === b.id &&
                  d.segment === sortField,
              );
              const roleA = roles.find((r) => r.id === defA?.role_id)?.name || "";
              const roleB = roles.find((r) => r.id === defB?.role_id)?.name || "";
              av = roleA;
              bv = roleB;
            } else {
              av = "";
              bv = "";
            }
            break;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [
    people,
    defs,
    roles,
    months,
    filter,
    activeOnly,
    commuterOnly,
    bsFilter,
    groupFilter,
    sortField,
    sortDir,
    filterMonth,
    segmentNames,
  ]);

  useEffect(() => {
    setShowSeg((prev) => {
      const next: Record<string, boolean> = {};
      segmentNames.forEach((s) => {
        next[s] = prev[s] ?? true;
      });
      return next;
    });
  }, [segmentNames]);

  const segs: Segment[] = segmentNames.filter((s) => showSeg[s]);

  function RoleSelect({
    month,
    personId,
    seg,
    def,
  }: {
    month: string;
    personId: number;
    seg: Segment;
    def: any;
  }) {
    const ref = useRef<HTMLSelectElement>(null);
    const options = roleListForSegment(seg);

    function showNames() {
      const sel = ref.current;
      if (!sel) return;
      Array.from(sel.options).forEach((o) => {
        const r = options.find((rr: any) => rr.id === Number(o.value));
        if (r) o.text = r.name;
      });
    }

    function showCode() {
      const sel = ref.current;
      if (!sel) return;
      const opt = Array.from(sel.options).find(
        (o) => Number(o.value) === Number(sel.value),
      );
      if (opt) {
        const r = options.find((rr: any) => rr.id === Number(opt.value));
        if (r) opt.text = r.code;
      }
    }

    useEffect(() => {
      showCode();
    }, [def?.role_id, options]);

    return (
      <select
        ref={ref}
        className="border rounded px-2 py-1 w-full"
        value={def?.role_id ?? ""}
        onFocus={showNames}
        onBlur={showCode}
        onChange={(e) => {
          const val = e.target.value;
          const rid = val === "" ? null : Number(val);
          setMonthlyDefaultForMonth(month, personId, seg, rid);
          setDefs(all(`SELECT * FROM monthly_default`));
          showCode();
        }}
      >
        <option value=""></option>
        {options.map((r: any) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    );
  }

  function cellData(month: string, personId: number, seg: Segment) {
    const def = defs.find(
      (d: any) => d.month === month && d.person_id === personId && d.segment === seg,
    );
    const role = roles.find((r: any) => r.id === def?.role_id);
    const color = role ? role.group_color : undefined;
    if (month === nextMonth || editPast) {
      return {
        content: (
          <RoleSelect
            month={month}
            personId={personId}
            seg={seg}
            def={def}
          />
        ),
        color,
      };
    }
    return { content: role?.code || "", color };
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Filter people..."
          value={filter}
          onChange={(_, data) => setFilter(data.value)}
        />
        <Dropdown
          selectedOptions={[sortField]}
          onOptionSelect={(_, data) => setSortField(data.optionValue as any)}
        >
          <Option value="last">Last Name</Option>
          <Option value="first">First Name</Option>
          <Option value="brother_sister">B/S</Option>
          <Option value="commuter">Commute</Option>
          <Option value="active">Active</Option>
          <Option value="avail_mon">Mon</Option>
          <Option value="avail_tue">Tue</Option>
          <Option value="avail_wed">Wed</Option>
          <Option value="avail_thu">Thu</Option>
          <Option value="avail_fri">Fri</Option>
          {segmentNames.map((seg) => (
            <Option key={seg} value={seg}>
              {seg} Role
            </Option>
          ))}
        </Dropdown>
        <Button onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
          {sortDir === "asc" ? "Asc" : "Desc"}
        </Button>
        <Dropdown
          selectedOptions={[bsFilter]}
          onOptionSelect={(_, data) => setBsFilter(data.optionValue as string)}
        >
          <Option value="">All B/S</Option>
          <Option value="Brother">Brother</Option>
          <Option value="Sister">Sister</Option>
        </Dropdown>
        <Dropdown
          multiselect
          placeholder="All Groups"
          selectedOptions={groupFilter}
          onOptionSelect={(_, data) => setGroupFilter(data.selectedOptions as string[])}
        >
          {groups.map((g) => (
            <Option key={g.name} value={g.name}>
              {g.name}
            </Option>
          ))}
        </Dropdown>
        <Dropdown
          selectedOptions={filterMonth ? [filterMonth] : []}
          onOptionSelect={(_, data) => setFilterMonth(data.optionValue as string)}
        >
          {months.map((m) => (
            <Option key={m} value={m}>
              {m}
            </Option>
          ))}
        </Dropdown>
        <Checkbox
          label="Active"
          checked={activeOnly}
          onChange={(_, data) => setActiveOnly(!!data.checked)}
        />
        <Checkbox
          label="Commuter"
          checked={commuterOnly}
          onChange={(_, data) => setCommuterOnly(!!data.checked)}
        />
        {segmentNames.map((seg) => (
          <Checkbox
            key={seg}
            label={seg}
            checked={!!showSeg[seg]}
            onChange={(_, data) =>
              setShowSeg({ ...showSeg, [seg]: !!data.checked })
            }
          />
        ))}
        <Checkbox
          label="Edit past months"
          checked={editPast}
          onChange={(_, data) => setEditPast(!!data.checked)}
        />
        <div className="flex items-center gap-1">
          <label className="text-sm">From</label>
          <input
            type="month"
            className="border rounded px-2 py-1 text-sm"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          />
          <label className="text-sm">To</label>
          <input
            type="month"
            className="border rounded px-2 py-1 text-sm"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm border border-slate-300 border-collapse">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left border border-slate-300">Name</th>
              <th className="p-2 text-left border border-slate-300">Segment</th>
              {months.map((m) => (
                <th key={m} className="p-2 text-left border border-slate-300">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPeople.map((p) => {
              const segList = segs;
              return (
                <React.Fragment key={p.id}>
                  {segList.map((seg, idx) => (
                    <tr
                      key={`${p.id}-${seg}`}
                      className="odd:bg-white even:bg-slate-50"
                    >
                      {idx === 0 && (
                        <td
                          className="p-2 border border-slate-300"
                          rowSpan={segList.length}
                        >
                          <PersonName personId={p.id}>
                            {p.last_name}, {p.first_name}
                          </PersonName>
                        </td>
                      )}
                      <td className="p-2 border border-slate-300">{seg}</td>
                      {months.map((m) => {
                        const { content, color } = cellData(m, p.id, seg);
                        return (
                          <td
                            key={m}
                            className="p-2 border border-slate-300"
                            style={{ backgroundColor: color }}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

