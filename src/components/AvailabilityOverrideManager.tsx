import * as React from "react";
import {
  Button,
  Dropdown,
  Option,
  Input,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableBody,
  TableCell,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import {
  setOverride,
  deleteOverride,
  type Availability,
} from "../services/availabilityOverrides";

interface AvailabilityOverrideManagerProps {
  sqlDb: any;
  all: (sql: string, params?: any[]) => any[];
  refresh: () => void;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const res = new Date(d);
  res.setDate(d.getDate() - diff);
  return res;
}

const useStyles = makeStyles({
  root: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  personCol: { gridColumn: "span 4" },
  dateCol: { gridColumn: "span 3" },
  weekTable: { marginBottom: tokens.spacingVerticalM },
  tableWrap: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: "auto",
    maxHeight: "40vh",
  },
});

export default function AvailabilityOverrideManager({
  sqlDb,
  all,
  refresh,
}: AvailabilityOverrideManagerProps) {
  const s = useStyles();
  const people = React.useMemo(
    () =>
      all(
        `SELECT id, first_name, last_name FROM person WHERE active=1 ORDER BY last_name, first_name`
      ),
    [all]
  );
  const [personId, setPersonId] = React.useState<number | null>(
    people[0]?.id ?? null
  );
  const [weekDate, setWeekDate] = React.useState<string>(ymd(new Date()));
  const [weekAvail, setWeekAvail] = React.useState<Availability[]>([
    "B",
    "B",
    "B",
    "B",
    "B",
  ]);
  const [rev, setRev] = React.useState(0);

  const rows = React.useMemo(
    () =>
      all(
        `SELECT o.person_id, o.date, o.avail, p.first_name, p.last_name
         FROM availability_override o JOIN person p ON p.id=o.person_id
         ORDER BY o.date DESC`
      ),
    [all, rev]
  );

  React.useEffect(() => {
    if (personId == null) return;
    const start = startOfWeek(new Date(weekDate));
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    const res = all(
      `SELECT date, avail FROM availability_override WHERE person_id=? AND date BETWEEN ? AND ?`,
      [personId, ymd(start), ymd(end)]
    );
    const vals: Availability[] = ["B", "B", "B", "B", "B"];
    res.forEach((r: any) => {
      const idx = Math.floor(
        (new Date(r.date).getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (idx >= 0 && idx < 5) vals[idx] = r.avail as Availability;
    });
    setWeekAvail(vals);
  }, [personId, weekDate, all, rev]);

  function updateWeek() {
    if (!sqlDb || personId == null) return;
    const start = startOfWeek(new Date(weekDate));
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = ymd(d);
      const val = weekAvail[i];
      if (val === "B") {
        deleteOverride(sqlDb, personId, ds);
      } else {
        setOverride(sqlDb, personId, ds, val);
      }
    }
    setRev((r) => r + 1);
    refresh();
  }

  function removeOverride(pid: number, dt: string) {
    if (!sqlDb) return;
    deleteOverride(sqlDb, pid, dt);
    setRev((r) => r + 1);
    refresh();
  }

  return (
    <div className={s.root}>
      <div className={s.topRow}>
        <Dropdown
          className={s.personCol}
          value={personId != null ? String(personId) : ""}
          onOptionSelect={(_, d) => setPersonId(Number(d.optionValue))}
        >
          {people.map((p: any) => (
            <Option key={p.id} value={String(p.id)}>
              {p.first_name} {p.last_name}
            </Option>
          ))}
        </Dropdown>
        <Input
          className={s.dateCol}
          type="date"
          value={weekDate}
          onChange={(_, d) => setWeekDate(d.value)}
        />
      </div>
      <Table size="small" className={s.weekTable}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Mon</TableHeaderCell>
            <TableHeaderCell>Tue</TableHeaderCell>
            <TableHeaderCell>Wed</TableHeaderCell>
            <TableHeaderCell>Thu</TableHeaderCell>
            <TableHeaderCell>Fri</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            {weekAvail.map((v, i) => (
              <TableCell key={i}>
                <Dropdown
                  value={v}
                  onOptionSelect={(_, d) =>
                    setWeekAvail((vals) => {
                      const n = [...vals];
                      n[i] = d.optionValue as Availability;
                      return n;
                    })
                  }
                >
                  <Option value="U">Unavailable</Option>
                  <Option value="AM">AM</Option>
                  <Option value="PM">PM</Option>
                  <Option value="B">Both</Option>
                </Dropdown>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
      <Button onClick={updateWeek} appearance="primary" className={s.weekTable}>
        Update
      </Button>
      <div className={s.tableWrap}>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Person</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Avail</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={`${r.person_id}|${r.date}`}>
                <TableCell>
                  {r.first_name} {r.last_name}
                </TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.avail}</TableCell>
                <TableCell>
                  <Button
                    appearance="subtle"
                    onClick={() => removeOverride(r.person_id, r.date)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

