export interface QueryResult<T = any> {
  rows: T[];
  etag?: string;
}

export interface MutationOptions {
  ifMatch?: string; // ETag for optimistic concurrency
}

export interface DbProvider {
  // Reads
  getPeople(): Promise<QueryResult>;
  getSkills(): Promise<QueryResult>;
  getPersonSkills(): Promise<QueryResult<{ personId: number; skillId: number; rating: number }>>;
  getPersonQualities(): Promise<QueryResult<Record<string, any>>>;

  // Writes
  upsertPersonSkill(
    personId: number,
    skillId: number,
    rating: number | null,
    opts?: MutationOptions
  ): Promise<void>;
  upsertPersonQuality(
    personId: number,
    key: string,
    rating: number | null,
    opts?: MutationOptions
  ): Promise<void>;
  createSkill(payload: { code: string; name: string; groupId: number }): Promise<void>;
  updateSkill(
    id: number,
    patch: Partial<{ code: string; name: string; groupId: number; active: number }>,
    opts?: MutationOptions
  ): Promise<void>;
  deleteSkill(id: number): Promise<void>;
}
