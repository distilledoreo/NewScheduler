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

const useStyles = makeStyles({
  root: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  col2: { gridColumn: "span 2" },
  col3: { gridColumn: "span 3" },
  col4: { gridColumn: "span 4" },
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
  const [date, setDate] = React.useState<string>(ymd(new Date()));
  const [avail, setAvail] = React.useState<Availability>("AM");
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

  function addOverride() {
    if (!sqlDb || personId == null || !date) return;
    setOverride(sqlDb, personId, date, avail);
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
      <div className={s.grid}>
        <Dropdown
          className={s.col4}
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
          className={s.col3}
          type="date"
          value={date}
          onChange={(_, d) => setDate(d.value)}
        />
        <Dropdown
          className={s.col2}
          value={avail}
          onOptionSelect={(_, d) => setAvail(d.optionValue as Availability)}
        >
          <Option value="AM">AM</Option>
          <Option value="PM">PM</Option>
          <Option value="B">B</Option>
          <Option value="U">U</Option>
        </Dropdown>
        <Button className={s.col3} onClick={addOverride} appearance="primary">
          Add / Update
        </Button>
      </div>
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

