import React, { useEffect, useState, useMemo } from "react";
import { Button, Dropdown, Option, makeStyles, tokens } from "@fluentui/react-components";
import PeopleFiltersBar, { filterPeopleList, PeopleFiltersState, freshPeopleFilters } from "./filters/PeopleFilters";

interface TrainingProps {
  people: any[];
  roles: any[];
  groups: any[];
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
}

const qualityDefs = [
  { key: "work_capabilities", label: "Work Capabilities & Skills" },
  { key: "work_habits", label: "Work Habits" },
  { key: "spirituality", label: "Spirituality" },
  { key: "dealings_with_others", label: "Dealings with Others" },
  { key: "health", label: "Health" },
  { key: "dress_grooming", label: "Dress & Grooming" },
  { key: "attitude_safety", label: "Attitude Toward Safety" },
  { key: "response_counsel", label: "Response to Counsel" },
  { key: "training_ability", label: "Training Ability" },
  { key: "potential_future_use", label: "Potential/Future Use" },
];

export default function Training({
  people,
  roles,
  groups,
  all,
  run,
}: TrainingProps) {
  const [view, setView] = useState<"skills" | "qualities">("skills");
  const [ratings, setRatings] = useState<Record<number, Record<number, number>>>({});
  const [qualities, setQualities] = useState<Record<number, Record<string, number>>>({});
  const [groupId, setGroupId] = useState<number | "">("");
  const [filters, setFilters] = useState<PeopleFiltersState>(() => freshPeopleFilters({ activeOnly: true }));

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

  useEffect(() => {
    try {
      const rows = all(`SELECT * FROM person_quality`);
      const map: Record<number, Record<string, number>> = {};
      for (const r of rows) {
        const { person_id, ...rest } = r;
        map[person_id] = rest;
      }
      setQualities(map);
    } catch {
      setQualities({});
    }
  }, [people, all]);

  function setRating(
    personId: number,
    roleId: number,
    rating: number | null,
  ) {
    if (rating === null) {
      run(`DELETE FROM competency WHERE person_id=? AND role_id=?`, [
        personId,
        roleId,
      ]);
      setRatings((prev) => {
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
        [personId, roleId, rating],
      );
      setRatings((prev) => {
        const next = { ...prev };
        if (!next[personId]) next[personId] = {};
        next[personId][roleId] = rating;
        return { ...next };
      });
    }
  }

  function setQuality(
    personId: number,
    key: string,
    rating: number | null,
  ) {
    if (rating === null) {
      run(`UPDATE person_quality SET ${key}=NULL WHERE person_id=?`, [
        personId,
      ]);
      setQualities((prev) => {
        const nextPerson: Record<string, number> = { ...(prev[personId] || {}) };
        delete nextPerson[key];
        return { ...prev, [personId]: nextPerson };
      });
    } else {
      run(
        `INSERT INTO person_quality (person_id, ${key}) VALUES (?, ?)
         ON CONFLICT(person_id) DO UPDATE SET ${key}=excluded.${key}`,
        [personId, rating],
      );
      setQualities((prev) => ({
        ...prev,
        [personId]: { ...(prev[personId] || {}), [key]: rating },
      }));
    }
  }

  const useStyles = makeStyles({
    root: {
      padding: tokens.spacingHorizontalM,
      display: "flex",
      flexDirection: "column",
      gap: tokens.spacingVerticalS,
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400 },
    filters: {
      display: "flex",
      gap: tokens.spacingHorizontalS,
      alignItems: "center",
    },
    tableWrap: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusLarge,
      overflow: "auto",
      maxHeight: "60vh",
      width: "100%",
      boxShadow: tokens.shadow2,
    },
    table: { width: "100%", borderCollapse: "collapse" },
    headerCell: {
      padding: tokens.spacingHorizontalS,
      textAlign: "left",
      backgroundColor: tokens.colorNeutralBackground2,
    },
    cell: { padding: tokens.spacingHorizontalS, textAlign: "center" },
    cellDropdown: { width: "60px" },
  });
  const s = useStyles();

  const filteredPeople = useMemo(() => filterPeopleList(people, filters), [people, filters]);
  const filteredRoles = roles.filter(
    (r: any) => !groupId || r.group_id === groupId,
  );

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>Training</div>
        <div>
          <Button
            appearance={view === "skills" ? "primary" : "secondary"}
            onClick={() => setView("skills")}
          >
            Skills
          </Button>
          <Button
            appearance={view === "qualities" ? "primary" : "secondary"}
            onClick={() => setView("qualities")}
          >
            Qualities
          </Button>
        </div>
      </div>
      <div className={s.filters}>
        <Dropdown
          selectedOptions={groupId === "" ? [] : [String(groupId)]}
          onOptionSelect={(_, data) => {
            const val = data.optionValue ? parseInt(String(data.optionValue)) : "";
            setGroupId(val as any);
          }}
        >
          <Option value="">All Groups</Option>
          {groups.map((g: any) => (
            <Option key={g.id} value={String(g.id)}>
              {g.name}
            </Option>
          ))}
        </Dropdown>
        <PeopleFiltersBar state={filters} onChange={(next) => setFilters((s) => ({ ...s, ...next }))} />
      </div>
      <div className={s.tableWrap}>
        {view === "skills" ? (
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.headerCell}>Person</th>
                {filteredRoles.map((r: any) => (
                  <th key={r.id} className={s.headerCell}>
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPeople.map((p: any) => (
                <tr key={p.id}>
                  <td className={s.cell}>
                    {p.last_name}, {p.first_name}
                  </td>
                  {filteredRoles.map((r: any) => {
                    const rating = ratings[p.id]?.[r.id];
                    return (
                      <td key={r.id} className={s.cell}>
                        <Dropdown
                          className={s.cellDropdown}
                          selectedOptions={rating ? [String(rating)] : []}
                          onOptionSelect={(_, data) => {
                            const val = parseInt(
                              String(data.optionValue ?? data.optionText),
                            );
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
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.headerCell}>Person</th>
                {qualityDefs.map((q) => (
                  <th key={q.key} className={s.headerCell}>
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPeople.map((p: any) => (
                <tr key={p.id}>
                  <td className={s.cell}>
                    {p.last_name}, {p.first_name}
                  </td>
                  {qualityDefs.map((q) => {
                    const rating = qualities[p.id]?.[q.key];
                    return (
                      <td key={q.key} className={s.cell}>
                        <Dropdown
                          className={s.cellDropdown}
                          selectedOptions={rating ? [String(rating)] : []}
                          onOptionSelect={(_, data) => {
                            const val = parseInt(
                              String(data.optionValue ?? data.optionText),
                            );
                            if (!val) setQuality(p.id, q.key, null);
                            else setQuality(p.id, q.key, val);
                          }}
                        >
                          <Option value="">-</Option>
                          <Option value="1">1</Option>
                          <Option value="2">2</Option>
                          <Option value="3">3</Option>
                          <Option value="4">4</Option>
                          <Option value="5">5</Option>
                        </Dropdown>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

