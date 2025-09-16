import { useEffect, useState, useMemo } from "react";
import {
  Dropdown,
  Option,
  makeStyles,
  tokens,
  Label,
  Tab,
  TabList,
  Card,
  CardHeader,
  Body1,
  Caption1,
  Subtitle2,
  Badge,
} from "@fluentui/react-components";
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

type RatingValue = 1 | 2 | 3 | 4 | 5;

type SkillStat = {
  skill: { id: number; code: string; name: string; active: number; group_id: number | null };
  total: number;
  rated: number;
  sum: number;
  avg: number | null;
  distribution: Record<RatingValue, number>;
  low: number;
  missing: number;
  coverage: number;
  needScore: number;
};

type QualityStat = {
  key: string;
  label: string;
  total: number;
  rated: number;
  sum: number;
  avg: number | null;
  distribution: Record<RatingValue, number>;
  low: number;
  missing: number;
  needScore: number;
};

const ratingPalette: Record<RatingValue, string> = {
  1: tokens.colorPaletteRedBackground3,
  2: tokens.colorPaletteDarkOrangeBackground2,
  3: tokens.colorPaletteMarigoldBackground2,
  4: tokens.colorPaletteLightGreenBackground2,
  5: tokens.colorPaletteGreenBackground2,
};

const viewTabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "skills", label: "Skill Matrix" },
  { key: "qualities", label: "Qualities" },
] as const;

const useTrainingStyles = makeStyles({
  root: {
    padding: tokens.spacingHorizontalM,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleArea: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  title: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase500,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  tabList: {
    marginLeft: "auto",
  },
  filters: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "stretch",
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
    backgroundColor: tokens.colorNeutralBackground1,
  },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  headerCell: {
    padding: tokens.spacingHorizontalS,
    textAlign: "center",
    backgroundColor: tokens.colorNeutralBackground2,
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  personCol: {
    position: "sticky",
    left: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    textAlign: "left",
    minWidth: "220px",
    maxWidth: "260px",
    width: "240px",
    boxShadow: `1px 0 0 ${tokens.colorNeutralStroke2}`,
  },
  skillCol: { minWidth: "80px", width: "80px" },
  cell: { padding: tokens.spacingHorizontalS, textAlign: "center" },
  cellDropdown: { width: "60px" },
  dashboard: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
  },
  metricGrid: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  metricCard: {
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  metricValue: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  metricCaption: {
    color: tokens.colorNeutralForeground3,
  },
  sectionsGrid: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalM,
    boxShadow: tokens.shadow2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    minHeight: "220px",
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  sectionDescription: {
    color: tokens.colorNeutralForeground3,
  },
  focusItem: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalXS} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  focusItemLast: {
    borderBottom: "none",
    paddingBottom: 0,
  },
  focusHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  focusMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  bar: {
    display: "flex",
    width: "100%",
    height: "12px",
    borderRadius: tokens.borderRadiusMedium,
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground3,
    boxShadow: `inset 0 0 0 1px ${tokens.colorNeutralStroke2}`,
  },
  barSegment: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundInverted,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "1",
  },
  barSegmentMuted: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground3,
  },
  focusFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
  },
  legend: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  legendDot: {
    width: "8px",
    height: "8px",
    borderRadius: tokens.borderRadiusCircular,
    display: "inline-block",
  },
  personCard: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  personName: {
    fontWeight: tokens.fontWeightSemibold,
  },
  personMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  personBadgeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
  },
  personGrid: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  personColumnTitle: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  emptyState: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    padding: tokens.spacingHorizontalM,
  },
});

export default function Training({
  people,
  roles,
  groups,
  all,
  run,
}: TrainingProps) {
  const [view, setView] = useState<"dashboard" | "skills" | "qualities">("dashboard");
  // ratings: person_id -> skill_id -> rating
  const [ratings, setRatings] = useState<Record<number, Record<number, number>>>({});
  const [skills, setSkills] = useState<Array<{ id:number; code:string; name:string; active:number; group_id:number|null }>>([]);
  const [qualities, setQualities] = useState<Record<number, Record<string, number>>>({});
  const [groupId, setGroupId] = useState<number | "">("");
  const [filters, setFilters] = useState<PeopleFiltersState>(() => freshPeopleFilters({ activeOnly: true }));
  const groupLabel = useMemo(() => {
    if (groupId === "") return "All Groups";
    const match = groups.find((g: any) => g.id === Number(groupId));
    return match ? match.name : "";
  }, [groupId, groups]);

  // Load skill catalog and person_skill ratings
  useEffect(() => {
    try {
  const skillRows = all(`SELECT id, code, name, active, group_id FROM skill WHERE active=1 ORDER BY name`);
  setSkills(skillRows.map((r:any)=>({ id:r.id, code:String(r.code), name:String(r.name), active:Number(r.active), group_id: r.group_id ?? null })));
      const rows = all(`SELECT person_id, skill_id, rating FROM person_skill`);
      const map: Record<number, Record<number, number>> = {};
      for (const r of rows) {
        if (!map[r.person_id]) map[r.person_id] = {};
        map[r.person_id][r.skill_id] = r.rating;
      }
      setRatings(map);
    } catch {
      setSkills([]);
      setRatings({});
    }
  }, [people, all]);

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

  function setRating(personId: number, skillId: number, rating: number | null) {
    if (rating === null) {
      run(`DELETE FROM person_skill WHERE person_id=? AND skill_id=?`, [personId, skillId]);
      setRatings((prev) => {
        const next = { ...prev };
        if (next[personId]) delete next[personId][skillId];
        return { ...next };
      });
    } else {
      run(
        `INSERT INTO person_skill (person_id, skill_id, rating) VALUES (?,?,?)
         ON CONFLICT(person_id, skill_id) DO UPDATE SET rating=excluded.rating`,
        [personId, skillId, rating]
      );
      setRatings((prev) => {
        const next = { ...prev };
        if (!next[personId]) next[personId] = {};
        next[personId][skillId] = rating;
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

  const s = useTrainingStyles();

  const filteredPeople = useMemo(() => filterPeopleList(people, filters), [people, filters]);
  const filteredRoles = roles.filter((r: any) => !groupId || r.group_id === groupId);
  void filteredRoles; // Roles used only in 'qualities' view for now
  const visibleSkills = useMemo(() => {
    if (!groupId) return skills;
    const gid = Number(groupId);
    return skills.filter(s => s.group_id == null || s.group_id === gid);
  }, [skills, groupId]);

  const avgFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [],
  );
  const percentFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    [],
  );

  const skillStats = useMemo<SkillStat[]>(() => {
    return visibleSkills.map((sk) => {
      const distribution: Record<RatingValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let rated = 0;
      let sum = 0;
      for (const person of filteredPeople) {
        const rating = ratings[person.id]?.[sk.id];
        if (rating) {
          rated += 1;
          sum += rating;
          if (rating >= 1 && rating <= 5) {
            distribution[rating as RatingValue] += 1;
          }
        }
      }
      const total = filteredPeople.length;
      const missing = total - rated;
      const avg = rated ? sum / rated : null;
      const low = distribution[1] + distribution[2];
      const coverage = total ? rated / total : 0;
      const needScore = total ? (low + missing * 0.5) / total : 0;
      return {
        skill: sk,
        total,
        rated,
        sum,
        avg,
        distribution,
        low,
        missing,
        coverage,
        needScore,
      };
    });
  }, [visibleSkills, filteredPeople, ratings]);

  const qualityStats = useMemo<QualityStat[]>(() => {
    return qualityDefs.map((q) => {
      const distribution: Record<RatingValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let rated = 0;
      let sum = 0;
      for (const person of filteredPeople) {
        const rating = qualities[person.id]?.[q.key];
        if (rating) {
          rated += 1;
          sum += rating;
          if (rating >= 1 && rating <= 5) {
            distribution[rating as RatingValue] += 1;
          }
        }
      }
      const total = filteredPeople.length;
      const missing = total - rated;
      const avg = rated ? sum / rated : null;
      const low = distribution[1] + distribution[2];
      const needScore = total ? (low + missing * 0.5) / total : 0;
      return {
        key: q.key,
        label: q.label,
        total,
        rated,
        sum,
        avg,
        distribution,
        low,
        missing,
        needScore,
      };
    });
  }, [filteredPeople, qualities]);

  const totalPossibleSkillRatings = filteredPeople.length * visibleSkills.length;
  const totalSkillRatings = skillStats.reduce((acc, stat) => acc + stat.rated, 0);
  const totalSkillSum = skillStats.reduce((acc, stat) => acc + stat.sum, 0);
  const overallSkillAverage = totalSkillRatings ? totalSkillSum / totalSkillRatings : null;
  const skillCoverage = totalPossibleSkillRatings ? totalSkillRatings / totalPossibleSkillRatings : 0;
  const missingSkillRatings = Math.max(totalPossibleSkillRatings - totalSkillRatings, 0);
  const lowSkillRatings = skillStats.reduce((acc, stat) => acc + stat.low, 0);

  const totalQualityRatings = qualityStats.reduce((acc, stat) => acc + stat.rated, 0);
  const totalQualitySum = qualityStats.reduce((acc, stat) => acc + stat.sum, 0);
  const overallQualityAverage = totalQualityRatings ? totalQualitySum / totalQualityRatings : null;

  const topSkillNeeds = useMemo(() => {
    return [...skillStats]
      .sort((a, b) => b.needScore - a.needScore)
      .slice(0, 5);
  }, [skillStats]);

  const skillStrengths = useMemo(() => {
    return [...skillStats]
      .filter((stat) => stat.rated > 0)
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
      .slice(0, 5);
  }, [skillStats]);

  const qualityNeeds = useMemo(() => {
    return [...qualityStats]
      .sort((a, b) => b.needScore - a.needScore)
      .slice(0, 4);
  }, [qualityStats]);

  const qualityStrengths = useMemo(() => {
    return [...qualityStats]
      .filter((stat) => stat.rated > 0)
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
      .slice(0, 4);
  }, [qualityStats]);

  const personSkillSummaries = useMemo(() => {
    if (visibleSkills.length === 0) return [] as Array<{
      person: any;
      rated: number;
      sum: number;
      avg: number | null;
      low: number;
      missing: number;
      focusScore: number;
    }>;
    return filteredPeople.map((person) => {
      let rated = 0;
      let sum = 0;
      let low = 0;
      let missing = 0;
      for (const sk of visibleSkills) {
        const rating = ratings[person.id]?.[sk.id];
        if (rating) {
          rated += 1;
          sum += rating;
          if (rating <= 2) low += 1;
        } else {
          missing += 1;
        }
      }
      const avg = rated ? sum / rated : null;
      const focusScore = visibleSkills.length
        ? (low * 2 + missing) / visibleSkills.length
        : 0;
      return { person, rated, sum, avg, low, missing, focusScore };
    });
  }, [filteredPeople, visibleSkills, ratings]);

  const peopleNeedingSupport = useMemo(() => {
    return [...personSkillSummaries]
      .filter((p) => p.focusScore > 0)
      .sort((a, b) => b.focusScore - a.focusScore)
      .slice(0, 3);
  }, [personSkillSummaries]);

  const peopleBrightSpots = useMemo(() => {
    return [...personSkillSummaries]
      .filter((p) => (p.avg ?? 0) > 0 && p.rated >= Math.max(1, Math.round(visibleSkills.length * 0.4)))
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
      .slice(0, 3);
  }, [personSkillSummaries, visibleSkills.length]);

  const formatAverage = (value: number | null) => (value == null ? "—" : avgFormatter.format(value));
  const formatPercent = (value: number) =>
    Number.isFinite(value) ? `${percentFormatter.format(value * 100)}%` : "—";

  const getNeedBadge = (score: number) => {
    if (score >= 0.6) return { color: "danger" as const, text: "High need" };
    if (score >= 0.35) return { color: "warning" as const, text: "Emerging need" };
    return { color: "success" as const, text: "On track" };
  };

  const getMomentumBadge = (avg: number | null, coverage: number) => {
    if ((avg ?? 0) >= 4.2 && coverage >= 0.7) {
      return { color: "success" as const, text: "Excelling" };
    }
    if ((avg ?? 0) >= 3.5 && coverage >= 0.5) {
      return { color: "informative" as const, text: "Solid progress" };
    }
    return { color: "warning" as const, text: "Needs data" };
  };

  const topSkillHighlight = topSkillNeeds.length ? topSkillNeeds[0] : null;

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.titleArea}>
          <div className={s.title}>Training</div>
          <div className={s.subtitle}>
            Understand readiness, surface coaching needs, and celebrate strengths.
          </div>
        </div>
        <TabList
          selectedValue={view}
          onTabSelect={(_, data) => setView(data.value as typeof view)}
          className={s.tabList}
        >
          {viewTabs.map((tab) => (
            <Tab key={tab.key} value={tab.key}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </div>
      <div className={s.filters}>
        <div className={s.groupCell}>
          <Label>{view === "qualities" ? "Role group" : "Skill group"}</Label>
          <Dropdown
            selectedOptions={groupId === "" ? [""] : [String(groupId)]}
            value={groupLabel}
            onOptionSelect={(_, data) => {
              const val = data.optionValue ? parseInt(String(data.optionValue)) : "";
              setGroupId(val as any);
            }}
          >
            <Option value="" text="All Groups">
              All Groups
            </Option>
            {groups.map((g: any) => (
              <Option key={g.id} value={String(g.id)} text={g.name}>
                {g.name}
              </Option>
            ))}
          </Dropdown>
        </div>
        <div className={s.grow}>
          <PeopleFiltersBar state={filters} onChange={(next) => setFilters((s) => ({ ...s, ...next }))} />
        </div>
      </div>
      {view === "dashboard" ? (
        <div className={s.dashboard}>
          <div className={s.metricGrid}>
            <Card className={s.metricCard}>
              <CardHeader
                header={<span className={s.metricValue}>{String(filteredPeople.length)}</span>}
                description={<Caption1 className={s.metricCaption}>People in view</Caption1>}
              />
              <Body1 className={s.metricCaption}>
                {visibleSkills.length
                  ? `${visibleSkills.length} skills selected`
                  : "Add skills to begin tracking"}
              </Body1>
            </Card>
            <Card className={s.metricCard}>
              <CardHeader
                header={<span className={s.metricValue}>{formatPercent(skillCoverage)}</span>}
                description={<Caption1 className={s.metricCaption}>Skill coverage</Caption1>}
              />
              <Body1 className={s.metricCaption}>
                Average rating {formatAverage(overallSkillAverage)}
              </Body1>
            </Card>
            <Card className={s.metricCard}>
              <CardHeader
                header={<span className={s.metricValue}>{String(lowSkillRatings)}</span>}
                description={<Caption1 className={s.metricCaption}>Low ratings (1-2)</Caption1>}
              />
              <Body1 className={s.metricCaption}>
                {String(missingSkillRatings)} unrated opportunities
              </Body1>
            </Card>
            <Card className={s.metricCard}>
              <CardHeader
                header={<span className={s.metricValue}>{formatAverage(overallQualityAverage)}</span>}
                description={<Caption1 className={s.metricCaption}>Quality pulse</Caption1>}
              />
              <Body1 className={s.metricCaption}>
                {topSkillHighlight
                  ? `Focus: ${topSkillHighlight.skill.name}`
                  : "Capture more feedback to unlock insights"}
              </Body1>
            </Card>
          </div>
          <div className={s.sectionsGrid}>
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <Subtitle2>Top training needs</Subtitle2>
                <Caption1 className={s.sectionDescription}>
                  Ordered by low ratings and missing skill coverage across the filtered team.
                </Caption1>
              </div>
              {topSkillNeeds.length ? (
                topSkillNeeds.map((stat, index) => {
                  const badge = getNeedBadge(stat.needScore);
                  const missingPct = stat.total ? (stat.missing / stat.total) * 100 : 0;
                  return (
                    <div
                      key={stat.skill.id}
                      className={`${s.focusItem}${index === topSkillNeeds.length - 1 ? ` ${s.focusItemLast}` : ""}`}
                    >
                      <div className={s.focusHeader}>
                        <span>{stat.skill.name}</span>
                        <span className={s.focusMeta}>
                          {formatAverage(stat.avg)} avg • {formatPercent(stat.coverage)} coverage
                        </span>
                      </div>
                      <div className={s.bar}>
                        {( [5, 4, 3, 2, 1] as RatingValue[]).map((lvl) => {
                          const count = stat.distribution[lvl];
                          const pct = stat.total ? (count / stat.total) * 100 : 0;
                          return (
                            <div
                              key={lvl}
                              className={s.barSegment}
                              style={{ width: `${pct}%`, backgroundColor: ratingPalette[lvl] }}
                            >
                              {pct >= 15 ? lvl : null}
                            </div>
                          );
                        })}
                        {stat.missing > 0 && (
                          <div
                            className={`${s.barSegment} ${s.barSegmentMuted}`}
                            style={{ width: `${missingPct}%` }}
                          >
                            {missingPct >= 15 ? "NR" : null}
                          </div>
                        )}
                      </div>
                      <div className={s.focusFooter}>
                        <Badge appearance="tint" color={badge.color}>{badge.text}</Badge>
                        <span className={s.focusMeta}>
                          {stat.low} low ratings • {stat.missing} unrated
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={s.emptyState}>No skill ratings available for the selected filters.</div>
              )}
              {topSkillNeeds.length ? (
                <div className={s.legend}>
                  {( [5, 4, 3, 2, 1] as RatingValue[]).map((lvl) => (
                    <span key={lvl}>
                      <span className={s.legendDot} style={{ backgroundColor: ratingPalette[lvl] }} /> {lvl}
                    </span>
                  ))}
                  <span>
                    <span className={s.legendDot} style={{ backgroundColor: tokens.colorNeutralBackground4 }} /> Unrated
                  </span>
                </div>
              ) : null}
            </section>
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <Subtitle2>Skill momentum</Subtitle2>
                <Caption1 className={s.sectionDescription}>
                  Celebrate where the team is trending strong and nearly ready to mentor.
                </Caption1>
              </div>
              {skillStrengths.length ? (
                skillStrengths.map((stat, index) => {
                  const badge = getMomentumBadge(stat.avg, stat.coverage);
                  const missingPct = stat.total ? (stat.missing / stat.total) * 100 : 0;
                  return (
                    <div
                      key={stat.skill.id}
                      className={`${s.focusItem}${index === skillStrengths.length - 1 ? ` ${s.focusItemLast}` : ""}`}
                    >
                      <div className={s.focusHeader}>
                        <span>{stat.skill.name}</span>
                        <span className={s.focusMeta}>
                          {formatAverage(stat.avg)} avg • {formatPercent(stat.coverage)} coverage
                        </span>
                      </div>
                      <div className={s.bar}>
                        {( [5, 4, 3, 2, 1] as RatingValue[]).map((lvl) => {
                          const count = stat.distribution[lvl];
                          const pct = stat.total ? (count / stat.total) * 100 : 0;
                          return (
                            <div
                              key={lvl}
                              className={s.barSegment}
                              style={{ width: `${pct}%`, backgroundColor: ratingPalette[lvl] }}
                            />
                          );
                        })}
                        {stat.missing > 0 && (
                          <div
                            className={`${s.barSegment} ${s.barSegmentMuted}`}
                            style={{ width: `${missingPct}%` }}
                          />
                        )}
                      </div>
                      <div className={s.focusFooter}>
                        <Badge appearance="tint" color={badge.color}>{badge.text}</Badge>
                        <span className={s.focusMeta}>{stat.rated} ratings captured</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={s.emptyState}>Rate a few skills to reveal strengths.</div>
              )}
            </section>
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <Subtitle2>Quality snapshot</Subtitle2>
                <Caption1 className={s.sectionDescription}>
                  Track core ministry qualities to guide mentoring conversations.
                </Caption1>
              </div>
              {qualityNeeds.length ? (
                qualityNeeds.map((stat, index) => {
                  const badge = getNeedBadge(stat.needScore);
                  const missingPct = stat.total ? (stat.missing / stat.total) * 100 : 0;
                  const coverage = stat.total ? stat.rated / stat.total : 0;
                  return (
                    <div
                      key={stat.key}
                      className={`${s.focusItem}${index === qualityNeeds.length - 1 ? ` ${s.focusItemLast}` : ""}`}
                    >
                      <div className={s.focusHeader}>
                        <span>{stat.label}</span>
                        <span className={s.focusMeta}>
                          {formatAverage(stat.avg)} avg • {formatPercent(coverage)} coverage
                        </span>
                      </div>
                      <div className={s.bar}>
                        {( [5, 4, 3, 2, 1] as RatingValue[]).map((lvl) => {
                          const count = stat.distribution[lvl];
                          const pct = stat.total ? (count / stat.total) * 100 : 0;
                          return (
                            <div
                              key={lvl}
                              className={s.barSegment}
                              style={{ width: `${pct}%`, backgroundColor: ratingPalette[lvl] }}
                            />
                          );
                        })}
                        {stat.missing > 0 && (
                          <div
                            className={`${s.barSegment} ${s.barSegmentMuted}`}
                            style={{ width: `${missingPct}%` }}
                          />
                        )}
                      </div>
                      <div className={s.focusFooter}>
                        <Badge appearance="tint" color={badge.color}>{badge.text}</Badge>
                        <span className={s.focusMeta}>{stat.missing} unrated · {stat.low} low</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={s.emptyState}>No quality feedback recorded yet.</div>
              )}
              {qualityStrengths.length ? (
                <div>
                  <Caption1 className={s.sectionDescription}>Consistent strengths</Caption1>
                  <div className={s.legend}>
                    {qualityStrengths.map((stat) => (
                      <span key={stat.key}>
                        {stat.label} • {formatAverage(stat.avg)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <Subtitle2>People insights</Subtitle2>
                <Caption1 className={s.sectionDescription}>
                  Quickly spot who needs support and who can help others grow.
                </Caption1>
              </div>
              <div className={s.personGrid}>
                <div>
                  <Caption1 className={s.personColumnTitle}>Priority coaching</Caption1>
                  {peopleNeedingSupport.length ? (
                    peopleNeedingSupport.map((item) => {
                      const badge = getNeedBadge(item.focusScore);
                      return (
                        <div key={item.person.id} className={s.personCard}>
                          <div className={s.personBadgeRow}>
                            <span className={s.personName}>
                              {item.person.last_name}, {item.person.first_name}
                            </span>
                            <Badge appearance="tint" color={badge.color}>{badge.text}</Badge>
                          </div>
                          <div className={s.personMeta}>
                            {formatAverage(item.avg)} avg • Rated {item.rated}/{visibleSkills.length || 1} skills
                          </div>
                          <div className={s.personMeta}>
                            {item.low} low ratings • {item.missing} unrated
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={s.emptyState}>No coaching needs detected yet.</div>
                  )}
                </div>
                <div>
                  <Caption1 className={s.personColumnTitle}>Bright spots</Caption1>
                  {peopleBrightSpots.length ? (
                    peopleBrightSpots.map((item) => {
                      const coverage = visibleSkills.length ? item.rated / visibleSkills.length : 0;
                      const badge = getMomentumBadge(item.avg, coverage);
                      return (
                        <div key={item.person.id} className={s.personCard}>
                          <div className={s.personBadgeRow}>
                            <span className={s.personName}>
                              {item.person.last_name}, {item.person.first_name}
                            </span>
                            <Badge appearance="tint" color={badge.color}>{badge.text}</Badge>
                          </div>
                          <div className={s.personMeta}>
                            {formatAverage(item.avg)} avg • Coverage {formatPercent(coverage)}
                          </div>
                          <div className={s.personMeta}>
                            {Math.max(item.rated - item.low, 0)} strong skills
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={s.emptyState}>Rate more skills to identify mentors.</div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
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
                            selectedOptions={rating != null ? [String(rating)] : [""]}
                            value={rating != null ? String(rating) : "-"}
                            onOptionSelect={(_, data) => {
                              const val = parseInt(String(data.optionValue ?? data.optionText));
                              if (!val) setRating(p.id, sk.id, null);
                              else setRating(p.id, sk.id, val);
                            }}
                          >
                            <Option value="" text="-">
                              -
                            </Option>
                            <Option value="1" text="1">
                              1
                            </Option>
                            <Option value="2" text="2">
                              2
                            </Option>
                            <Option value="3" text="3">
                              3
                            </Option>
                            <Option value="4" text="4">
                              4
                            </Option>
                            <Option value="5" text="5">
                              5
                            </Option>
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
                            selectedOptions={rating != null ? [String(rating)] : [""]}
                            value={rating != null ? String(rating) : "-"}
                            onOptionSelect={(_, data) => {
                              const val = parseInt(String(data.optionValue ?? data.optionText));
                              if (!val) setQuality(p.id, q.key, null);
                              else setQuality(p.id, q.key, val);
                            }}
                          >
                            <Option value="" text="-">
                              -
                            </Option>
                            <Option value="1" text="1">
                              1
                            </Option>
                            <Option value="2" text="2">
                              2
                            </Option>
                            <Option value="3" text="3">
                              3
                            </Option>
                            <Option value="4" text="4">
                              4
                            </Option>
                            <Option value="5" text="5">
                              5
                            </Option>
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
      )}
    </div>
  );
}

