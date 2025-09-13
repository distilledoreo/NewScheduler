import React, { useEffect, useState } from "react";
import { Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell, Dropdown, Option } from "@fluentui/react-components";

interface CompetencyTrackerProps {
  people: any[];
  roles: any[];
  all: (sql: string, params?: any[], db?: any) => any[];
  run: (sql: string, params?: any[], db?: any) => void;
}

export default function CompetencyTracker({ people, roles, all, run }: CompetencyTrackerProps) {
  const [ratings, setRatings] = useState<Record<number, Record<number, number>>>({});

  useEffect(() => {
    try {
      const rows = all("SELECT person_id, role_id, score FROM competency", []);
      const map: Record<number, Record<number, number>> = {};
      for (const r of rows) {
        if (!map[r.person_id]) map[r.person_id] = {};
        map[r.person_id][r.role_id] = r.score;
      }
      setRatings(map);
    } catch {}
  }, [all, people, roles]);

  const setScore = (personId: number, roleId: number, score: number) => {
    setRatings(prev => {
      const next = { ...prev };
      if (!next[personId]) next[personId] = {};
      next[personId][roleId] = score;
      return next;
    });
    run(
      "INSERT INTO competency (person_id, role_id, score) VALUES (?,?,?) ON CONFLICT(person_id, role_id) DO UPDATE SET score=excluded.score",
      [personId, roleId, score]
    );
  };

  return (
    <div className="p-4 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Person</TableHeaderCell>
            {roles.map(r => (
              <TableHeaderCell key={r.id}>{r.name}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map(p => (
            <TableRow key={p.id}>
              <TableCell>{p.first_name} {p.last_name}</TableCell>
              {roles.map(r => (
                <TableCell key={r.id}>
                  <Dropdown
                    aria-label="Competency"
                    selectedOptions={ratings[p.id]?.[r.id] ? [String(ratings[p.id][r.id])] : []}
                    placeholder="-"
                    onOptionSelect={(e, data) => {
                      const val = parseInt(String(data.optionValue), 10);
                      if (!isNaN(val)) setScore(p.id, r.id, val);
                    }}
                  >
                    {[1,2,3,4,5].map(v => (
                      <Option key={v} value={String(v)}>{v}</Option>
                    ))}
                  </Dropdown>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

