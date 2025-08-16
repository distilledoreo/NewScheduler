import React, { useEffect, useMemo, useState } from "react";
import { Input, Dropdown, Option, Button, Checkbox, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell, makeStyles, tokens, Toolbar, ToolbarButton, ToolbarDivider } from "@fluentui/react-components";
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
  const NAME_COL_PX = 240;
  const SEG_COL_PX = 160;
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
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacingVerticalS,
      paddingBlockEnd: tokens.spacingVerticalS,
      minWidth: 0,
    },
    controlsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      alignItems: 'stretch',
      gridAutoRows: 'minmax(40px, auto)',
      columnGap: tokens.spacingHorizontalS,
      rowGap: tokens.spacingVerticalS,
      minWidth: 0,
    },
    controlCell: {
      minWidth: 0,
      display: 'flex',
      alignItems: 'end',
      // let children shrink/grow within the grid cell
      '& > *': { maxWidth: '100%' },
    },
    full: {
      width: '100%',
    },
    segmentsWrap: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: tokens.spacingHorizontalS,
      rowGap: tokens.spacingVerticalXS,
      paddingBlockEnd: tokens.spacingVerticalXS,
      minWidth: 0,
    },
    monthRange: {
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacingHorizontalXS,
      flexWrap: 'wrap',
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
    stickyName: {
      position: 'sticky',
      left: '0px',
      zIndex: 3,
      backgroundColor: tokens.colorNeutralBackground1,
      boxShadow: `inset -1px 0 0 ${tokens.colorNeutralStroke2}`,
      width: `${NAME_COL_PX}px`,
      minWidth: `${NAME_COL_PX}px`,
      maxWidth: `${NAME_COL_PX}px`,
    },
    stickySeg: {
      position: 'sticky',
      left: `${NAME_COL_PX}px`,
      zIndex: 2,
      backgroundColor: tokens.colorNeutralBackground1,
      boxShadow: `inset -1px 0 0 ${tokens.colorNeutralStroke2}`,
      width: `${SEG_COL_PX}px`,
      minWidth: `${SEG_COL_PX}px`,
      maxWidth: `${SEG_COL_PX}px`,
    },
  });
  const styles = useStyles();
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
  if (!max || String(nm) > String(max)) max = nm;
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
    const options = roleListForSegment(seg);
    return (
      <Dropdown
        placeholder=""
        selectedOptions={def?.role_id != null ? [String(def.role_id)] : []}
        onOptionSelect={(_, data) => {
          const v = data.optionValue ?? data.optionText;
          const rid = v ? Number(v) : null;
          setMonthlyDefaultForMonth(month, personId, seg, rid);
          setDefs(all(`SELECT * FROM monthly_default`));
        }}
      >
        <Option value="" text=""></Option>
        {options.map((r: any) => (
          <Option key={r.id} value={String(r.id)} text={r.name}>{r.name}</Option>
        ))}
      </Dropdown>
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
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.controlsGrid}>
          <div className={styles.controlCell}>
            <Input className={styles.full} placeholder="Filter people..." value={filter} onChange={(_, data) => setFilter(data.value)} />
          </div>
          <div className={styles.controlCell}>
            <Dropdown className={styles.full} selectedOptions={[sortField]} onOptionSelect={(_, data) => setSortField(data.optionValue as any)}>
            <Option value="last" text="Last Name">Last Name</Option>
            <Option value="first" text="First Name">First Name</Option>
            <Option value="brother_sister" text="B/S">B/S</Option>
            <Option value="commuter" text="Commute">Commute</Option>
            <Option value="active" text="Active">Active</Option>
            <Option value="avail_mon" text="Mon">Mon</Option>
            <Option value="avail_tue" text="Tue">Tue</Option>
            <Option value="avail_wed" text="Wed">Wed</Option>
            <Option value="avail_thu" text="Thu">Thu</Option>
            <Option value="avail_fri" text="Fri">Fri</Option>
            {segmentNames.map((seg) => (
              <Option key={seg} value={seg} text={`${seg} Role`} />
            ))}
            </Dropdown>
          </div>
          <div className={styles.controlCell}>
            <Button onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}> {sortDir === "asc" ? "Asc" : "Desc"} </Button>
          </div>
          <div className={styles.controlCell}>
            <Dropdown className={styles.full} selectedOptions={[bsFilter]} onOptionSelect={(_, data) => setBsFilter(data.optionValue as string)}>
            <Option value="" text="All B/S">All B/S</Option>
            <Option value="Brother" text="Brother">Brother</Option>
            <Option value="Sister" text="Sister">Sister</Option>
            </Dropdown>
          </div>
          <div className={styles.controlCell}>
            <Dropdown className={styles.full} multiselect placeholder="All Groups" selectedOptions={groupFilter} onOptionSelect={(_, data) => setGroupFilter(data.selectedOptions as string[])}>
            {groups.map((g) => (
              <Option key={g.name} value={g.name} text={g.name}>{g.name}</Option>
            ))}
            </Dropdown>
          </div>
          <div className={styles.controlCell}>
            <Dropdown className={styles.full} selectedOptions={filterMonth ? [filterMonth] : []} onOptionSelect={(_, data) => setFilterMonth(data.optionValue as string)}>
            {months.map((m) => (
              <Option key={m} value={m} text={m}>{m}</Option>
            ))}
            </Dropdown>
          </div>
          <div className={styles.controlCell}>
            <Checkbox label="Active" checked={activeOnly} onChange={(_, data) => setActiveOnly(!!data.checked)} />
          </div>
          <div className={styles.controlCell}>
            <Checkbox label="Commuter" checked={commuterOnly} onChange={(_, data) => setCommuterOnly(!!data.checked)} />
          </div>
          <div className={styles.controlCell}>
            <Checkbox label="Edit past months" checked={editPast} onChange={(_, data) => setEditPast(!!data.checked)} />
          </div>
          <div className={`${styles.controlCell} ${styles.monthRange}`}>
            <span className={styles.label}>From</span>
            <Input type="month" value={startMonth} onChange={(_, d) => setStartMonth(d.value)} />
            <span className={styles.label}>To</span>
            <Input type="month" value={endMonth} onChange={(_, d) => setEndMonth(d.value)} />
          </div>
        </div>
        <div className={styles.segmentsWrap}>
          <span className={styles.label}>Segments:</span>
          {segmentNames.map((seg) => (
            <Checkbox key={seg} label={seg} checked={!!showSeg[seg]} onChange={(_, data) => setShowSeg({ ...showSeg, [seg]: !!data.checked })} />
          ))}
        </div>
      </div>
      <div className={styles.scroll}>
        <Table size="small" aria-label="Crew history">
          <TableHeader>
            <TableRow>
              <TableHeaderCell className={styles.stickyName}>
                Name
              </TableHeaderCell>
              <TableHeaderCell className={styles.stickySeg}>
                Segment
              </TableHeaderCell>
              {months.map((m) => (
                <TableHeaderCell key={m}>{m}</TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPeople.map((p) => {
              const segList = segs;
              return (
                <React.Fragment key={p.id}>
                  {segList.map((seg, idx) => (
                    <TableRow key={`${p.id}-${seg}`}>
                      {idx === 0 && (
                        <TableCell rowSpan={segList.length} className={styles.stickyName}>
                          <PersonName personId={p.id}>
                            {p.last_name}, {p.first_name}
                          </PersonName>
                        </TableCell>
                      )}
                      <TableCell className={styles.stickySeg}>{seg}</TableCell>
                      {months.map((m) => {
                        const { content, color } = cellData(m, p.id, seg);
                        return (
                          <TableCell key={m} style={{ backgroundColor: color }}>
                            {content}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

