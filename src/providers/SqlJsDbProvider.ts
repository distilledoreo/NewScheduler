import type {
  DbProvider,
  PersonQualitiesRecord,
  PersonSkillRating,
  SqlExecute,
  SqlQueryAll,
  TrainingSkill,
} from "./DbProvider";

export class SqlJsDbProvider implements DbProvider {
  public readonly kind = "sqljs" as const;

  constructor(
    private readonly queryAll: SqlQueryAll,
    private readonly execute: SqlExecute,
  ) {}

  async getTrainingSkills(): Promise<TrainingSkill[]> {
    const rows = this.queryAll(
      `SELECT id, code, name, active, group_id FROM skill WHERE active=1 ORDER BY name`,
    );
    return rows.map((row: any) => ({
      id: Number(row.id),
      code: String(row.code ?? ""),
      name: String(row.name ?? ""),
      active: Number(row.active ?? 0),
      groupId: row.group_id ?? null,
    }));
  }

  async getPersonSkillRatings(): Promise<PersonSkillRating[]> {
    const rows = this.queryAll(`SELECT person_id, skill_id, rating FROM person_skill`);
    return rows.map((row: any) => ({
      personId: Number(row.person_id),
      skillId: Number(row.skill_id),
      rating: Number(row.rating),
    }));
  }

  async setPersonSkillRating(
    personId: number,
    skillId: number,
    rating: number | null,
  ): Promise<void> {
    if (rating === null) {
      this.execute(`DELETE FROM person_skill WHERE person_id=? AND skill_id=?`, [personId, skillId]);
      return;
    }
    this.execute(
      `INSERT INTO person_skill (person_id, skill_id, rating) VALUES (?,?,?)
       ON CONFLICT(person_id, skill_id) DO UPDATE SET rating=excluded.rating`,
      [personId, skillId, rating],
    );
  }

  async getPersonQualities(): Promise<PersonQualitiesRecord[]> {
    const rows = this.queryAll(`SELECT * FROM person_quality`);
    return rows.map((row: any) => {
      const { person_id, ...rest } = row;
      const values: Record<string, number> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value == null) continue;
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) values[key] = numeric;
      }
      return { personId: Number(person_id), values };
    });
  }

  async setPersonQuality(
    personId: number,
    key: string,
    rating: number | null,
  ): Promise<void> {
    if (rating === null) {
      this.execute(`UPDATE person_quality SET ${key}=NULL WHERE person_id=?`, [personId]);
      return;
    }
    this.execute(
      `INSERT INTO person_quality (person_id, ${key}) VALUES (?, ?)
       ON CONFLICT(person_id) DO UPDATE SET ${key}=excluded.${key}`,
      [personId, rating],
    );
  }
}

export function createSqlJsDbProvider(all: SqlQueryAll, run: SqlExecute): SqlJsDbProvider {
  return new SqlJsDbProvider(all, run);
}
