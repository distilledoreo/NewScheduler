import React, { useEffect, useState } from "react";
import { Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell, Dropdown, Option, makeStyles, tokens } from "@fluentui/react-components";

interface SkillTrackerProps {
  people: any[];
  roles: any[];
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
}

export default function SkillTracker({ people, roles, all, run }: SkillTrackerProps) {
  const [ratings, setRatings] = useState<Record<number, Record<number, number>>>({});

  useEffect(() => {
    try {
      const rows = all(`SELECT person_id, role_id, rating FROM competency`);
      const map: Record<number, Record<number, number>> = {};
      for (const r of rows) {
        if (!map[r.person_id]) map[r.person_id] = {};
        map[r.person_id][r.role_id] = r.rating;
      }
      setRatings(map);
    } catch {
      setRatings({});
    }
  }, [people, roles, all]);

  function setRating(personId: number, roleId: number, rating: number | null) {
    if (rating === null) {
      run(`DELETE FROM competency WHERE person_id=? AND role_id=?`, [personId, roleId]);
      setRatings(prev => {
        const next = { ...prev };
        if (next[personId]) {
          delete next[personId][roleId];
        }
        return { ...next };
      });
    } else {
      run(
        `INSERT INTO competency (person_id, role_id, rating) VALUES (?,?,?)
         ON CONFLICT(person_id, role_id) DO UPDATE SET rating=excluded.rating`,
        [personId, roleId, rating]
      );
      setRatings(prev => {
        const next = { ...prev };
        if (!next[personId]) next[personId] = {};
        next[personId][roleId] = rating;
        return { ...next };
      });
    }
  }

  const useStyles = makeStyles({
    root: {
      padding: tokens.spacingHorizontalM,
      display: "flex",
      flexDirection: "column",
      gap: tokens.spacingVerticalS,
    },
    title: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400 },
    tableWrap: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusLarge,
      overflow: "auto",
      maxHeight: "60vh",
    },
    cellDropdown: { width: "60px" },
  });
  const s = useStyles();

  return (
    <div className={s.root}>
      <div className={s.title}>Skill Competency Tracker</div>
      <div className={s.tableWrap}>
        <Table>
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
                <TableCell>
                  {p.last_name}, {p.first_name}
                </TableCell>
                {roles.map((r: any) => {
                  const rating = ratings[p.id]?.[r.id];
                  return (
                    <TableCell key={r.id}>
                      <Dropdown
                        className={s.cellDropdown}
                        selectedOptions={rating ? [String(rating)] : []}
                        onOptionSelect={(_, data) => {
                          const val = parseInt(String(data.optionValue ?? data.optionText));
                          if (!val) setRating(p.id, r.id, null);
                          else setRating(p.id, r.id, val);
                        }}
                      >
                        <Option value="">-</Option>
                        <Option value="1">1</Option>
                        <Option value="2">2</Option>
                        <Option value="3">3</Option>
                        <Option value="4">4</Option>
                        <Option value="5">5</Option>
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
