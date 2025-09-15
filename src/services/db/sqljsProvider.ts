import type { DbProvider, MutationOptions, QueryResult } from "./types";

export function makeSqlJsProvider(
  all: (sql: string, params?: any[]) => any[],
  run: (sql: string, params?: any[]) => void,
): DbProvider {
  return {
    async getPeople() {
      return { rows: all("SELECT * FROM person ORDER BY last_name, first_name") };
    },
    async getSkills() {
      return { rows: all("SELECT id, code, name, active, group_id FROM skill ORDER BY name") };
    },
    async getPersonSkills() {
      const rows = all("SELECT person_id, skill_id, rating FROM person_skill");
      return { rows: rows.map((r: any) => ({ personId: r.person_id, skillId: r.skill_id, rating: r.rating })) };
    },
    async getPersonQualities() {
      return { rows: all("SELECT * FROM person_quality") };
    },
    async upsertPersonSkill(personId: number, skillId: number, rating: number | null, _opts?: MutationOptions) {
      if (rating == null) run("DELETE FROM person_skill WHERE person_id=? AND skill_id=?", [personId, skillId]);
      else run(
        `INSERT INTO person_skill (person_id, skill_id, rating) VALUES (?,?,?)
         ON CONFLICT(person_id, skill_id) DO UPDATE SET rating=excluded.rating`,
        [personId, skillId, rating]
      );
    },
    async upsertPersonQuality(personId: number, key: string, rating: number | null, _opts?: MutationOptions) {
      if (rating == null) run(`UPDATE person_quality SET ${key}=NULL WHERE person_id=?`, [personId]);
      else run(
        `INSERT INTO person_quality (person_id, ${key}) VALUES (?, ?)
         ON CONFLICT(person_id) DO UPDATE SET ${key}=excluded.${key}`,
        [personId, rating]
      );
    },
    async createSkill(payload: { code: string; name: string; groupId: number }) {
      run("INSERT INTO skill (code, name, group_id, active) VALUES (?,?,?,1)", [payload.code, payload.name, payload.groupId]);
    },
    async updateSkill(id: number, patch: Partial<{ code: string; name: string; groupId: number; active: number }>) {
      const sets: string[] = []; const vals: any[] = [];
      if (patch.code != null) { sets.push("code=?"); vals.push(patch.code); }
      if (patch.name != null) { sets.push("name=?"); vals.push(patch.name); }
      if (patch.groupId != null) { sets.push("group_id=?"); vals.push(patch.groupId); }
      if (patch.active != null) { sets.push("active=?"); vals.push(patch.active); }
      if (sets.length) run(`UPDATE skill SET ${sets.join(",")} WHERE id=?`, [...vals, id]);
    },
    async deleteSkill(id: number) {
      run("DELETE FROM skill WHERE id=?", [id]);
    },
  };
}
