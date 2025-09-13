import React, { useEffect, useState } from "react";
import { Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell, Dropdown, Option, makeStyles, tokens } from "@fluentui/react-components";
import PersonName from "./PersonName";

interface CompetencyTrackerProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  people: any[];
  roles: any[];
}

export default function CompetencyTracker({ all, run, people, roles }: CompetencyTrackerProps) {
  const [ratings, setRatings] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const rows = all(`SELECT person_id, role_id, rating FROM competency`);
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(`${r.person_id}|${r.role_id}`, r.rating);
    }
    setRatings(map);
  }, [all, people, roles]);

  function setRating(pid: number, rid: number, rating: number) {
    run(
      `INSERT INTO competency (person_id, role_id, rating) VALUES (?,?,?) ON CONFLICT(person_id, role_id) DO UPDATE SET rating=excluded.rating`,
      [pid, rid, rating]
    );
    setRatings(new Map(ratings).set(`${pid}|${rid}`, rating));
  }

  const useStyles = makeStyles({
    root: { padding: tokens.spacingHorizontalM },
    tableWrap: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusLarge,
      overflow: "auto",
      maxHeight: "60vh",
      width: "100%",
      boxShadow: tokens.shadow2,
    },
  });
  const s = useStyles();

  return (
    <div className={s.root}>
      <div className={s.tableWrap}>
        <Table aria-label="Competency table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Person</TableHeaderCell>
              {roles.map((r: any) => (
                <TableHeaderCell key={r.id}>{r.name}</TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell><PersonName personId={p.id}>{p.last_name}, {p.first_name}</PersonName></TableCell>
                {roles.map((r: any) => {
                  const key = `${p.id}|${r.id}`;
                  const rating = ratings.get(key);
                  return (
                    <TableCell key={r.id}>
                      <Dropdown
                        selectedOptions={rating ? [String(rating)] : []}
                        onOptionSelect={(_, data) => {
                          const v = Number(data.optionValue ?? data.optionText);
                          setRating(p.id, r.id, v);
                        }}
                      >
                        {[1,2,3,4,5].map(n => (
                          <Option key={n} value={String(n)}>{n}</Option>
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
    </div>
  );
}

