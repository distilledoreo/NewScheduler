export type SqlQueryAll = (sql: string, params?: any[]) => any[];
export type SqlExecute = (sql: string, params?: any[]) => void;

export interface TrainingSkill {
  id: number;
  code: string;
  name: string;
  active: number;
  groupId: number | null;
}

export interface PersonSkillRating {
  personId: number;
  skillId: number;
  rating: number;
}

export interface PersonQualitiesRecord {
  personId: number;
  values: Record<string, number>;
}

export interface DbProvider {
  readonly kind: "sqljs" | "graph-sharepoint";

  getTrainingSkills(): Promise<TrainingSkill[]>;

  getPersonSkillRatings(): Promise<PersonSkillRating[]>;

  setPersonSkillRating(
    personId: number,
    skillId: number,
    rating: number | null,
  ): Promise<void>;

  getPersonQualities(): Promise<PersonQualitiesRecord[]>;

  setPersonQuality(
    personId: number,
    key: string,
    rating: number | null,
  ): Promise<void>;
}
