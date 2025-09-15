import { useEffect, useState, useMemo, useRef } from "react";
import { Button, Dropdown, Option, makeStyles, tokens, Label } from "@fluentui/react-components";
import PeopleFiltersBar, { filterPeopleList, PeopleFiltersState, freshPeopleFilters } from "./filters/PeopleFilters";
import { createDbProvider } from "../providers/factory";
import type { TrainingSkill } from "../providers/DbProvider";

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
  // ratings: person_id -> skill_id -> rating
  const [ratings, setRatings] = useState<Record<number, Record<number, number>>>({});
  const [skills, setSkills] = useState<TrainingSkill[]>([]);
  const [qualities, setQualities] = useState<Record<number, Record<string, number>>>({});
  const [groupId, setGroupId] = useState<number | "">("");
  const [filters, setFilters] = useState<PeopleFiltersState>(() => freshPeopleFilters({ activeOnly: true }));

  const queryAllRef = useRef(all);
  const runRef = useRef(run);

  useEffect(() => {
    queryAllRef.current = all;
  }, [all]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const provider = useMemo(
    () =>
      createDbProvider(
        (sql, params) => queryAllRef.current(sql, params),
        (sql, params) => runRef.current(sql, params),
      ),
    [],
  );

  // Load skill catalog and person_skill ratings
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const [skillRows, ratingRows] = await Promise.all([
          provider.getTrainingSkills(),
          provider.getPersonSkillRatings(),
        ]);
        if (disposed) return;
        setSkills(skillRows);
        const map: Record<number, Record<number, number>> = {};
        for (const rating of ratingRows) {
          if (!map[rating.personId]) map[rating.personId] = {};
          map[rating.personId][rating.skillId] = rating.rating;
        }
        setRatings(map);
      } catch (error) {
        console.error("Failed to load training data", error);
        if (!disposed) {
          setSkills([]);
          setRatings({});
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [people, provider]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const rows = await provider.getPersonQualities();
        if (disposed) return;
        const map: Record<number, Record<string, number>> = {};
        for (const row of rows) {
          map[row.personId] = row.values;
        }
        setQualities(map);
      } catch (error) {
        console.error("Failed to load person qualities", error);
        if (!disposed) setQualities({});
      }
    })();
    return () => {
      disposed = true;
    };
  }, [people, provider]);

  async function setRating(personId: number, skillId: number, rating: number | null) {
    try {
      await provider.setPersonSkillRating(personId, skillId, rating);
      if (rating === null) {
        setRatings((prev) => {
          const next = { ...prev };
          if (next[personId]) delete next[personId][skillId];
          return { ...next };
        });
      } else {
        setRatings((prev) => {
          const next = { ...prev };
          if (!next[personId]) next[personId] = {};
          next[personId][skillId] = rating;
          return { ...next };
        });
      }
    } catch (error) {
      console.error("Failed to update skill rating", error);
    }
  }

  async function setQuality(
    personId: number,
    key: string,
    rating: number | null,
  ) {
    try {
      await provider.setPersonQuality(personId, key, rating);
      if (rating === null) {
        setQualities((prev) => {
          const nextPerson: Record<string, number> = { ...(prev[personId] || {}) };
          delete nextPerson[key];
          return { ...prev, [personId]: nextPerson };
        });
      } else {
        setQualities((prev) => ({
          ...prev,
          [personId]: { ...(prev[personId] || {}), [key]: rating },
        }));
      }
    } catch (error) {
      console.error("Failed to update person quality", error);
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
      flexWrap: "wrap",
      width: "100%",
    },
    groupCell: {
      display: "grid",
      gap: tokens.spacingHorizontalXS,
      minWidth: "220px",
    },
    grow: { flex: 1, minWidth: "260px" },
    tableWrap: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusLarge,
      overflow: "auto",
      maxHeight: "60vh",
      width: "100%",
      boxShadow: tokens.shadow2,
    },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
    headerCell: {
      padding: tokens.spacingHorizontalS,
      textAlign: "center",
      backgroundColor: tokens.colorNeutralBackground2,
      position: 'sticky',
      top: 0,
      zIndex: 1,
    },
    personCol: { position: 'sticky', left: 0, backgroundColor: tokens.colorNeutralBackground1, textAlign: 'left', minWidth: '220px', maxWidth: '260px', width: '240px' },
    skillCol: { minWidth: '80px', width: '80px' },
    cell: { padding: tokens.spacingHorizontalS, textAlign: "center" },
    cellDropdown: { width: "60px" },
  });
  const s = useStyles();

  const filteredPeople = useMemo(() => filterPeopleList(people, filters), [people, filters]);
  const filteredRoles = roles.filter((r: any) => !groupId || r.group_id === groupId);
  void filteredRoles; // Roles used only in 'qualities' view for now
  const visibleSkills = useMemo(() => {
    if (!groupId) return skills;
    const gid = Number(groupId);
    return skills.filter(s => s.groupId == null || s.groupId === gid);
  }, [skills, groupId]);

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
        {view === 'skills' ? (
          <div className={s.groupCell}>
            <Label>Group (filters visible skills)</Label>
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
          </div>
        ) : (
          <div className={s.groupCell}>
            <Label>Role group</Label>
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
          </div>
        )}
        <div className={s.grow}>
          <PeopleFiltersBar state={filters} onChange={(next) => setFilters((s) => ({ ...s, ...next }))} />
        </div>
      </div>
      <div className={s.tableWrap}>
        {view === "skills" ? (
          <table className={s.table}>
            <thead>
              <tr>
                <th className={`${s.headerCell} ${s.personCol}`}>Person</th>
                {visibleSkills.map((sk: any) => (
                  <th key={sk.id} className={`${s.headerCell} ${s.skillCol}`}>
                    {sk.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPeople.map((p: any) => (
                <tr key={p.id}>
                  <td className={`${s.cell} ${s.personCol}`}>
                    {p.last_name}, {p.first_name}
                  </td>
                  {visibleSkills.map((sk: any) => {
                    const rating = ratings[p.id]?.[sk.id];
                    return (
                      <td key={sk.id} className={s.cell}>
                        <Dropdown
                          className={s.cellDropdown}
                          selectedOptions={rating ? [String(rating)] : []}
                          onOptionSelect={(_, data) => {
                            const val = parseInt(
                              String(data.optionValue ?? data.optionText),
                            );
                            if (!val) setRating(p.id, sk.id, null);
                            else setRating(p.id, sk.id, val);
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

