// migrations.ts — complete file with a new v7 migration that backfills missing segments
// and hardens indexes so Monthly Defaults for "new" segments stick on old databases.
//
// Drop this in place of your existing migrations.ts. If you already have concrete
// implementations for v1–v6, keep them. These no-ops are here only so the file compiles
// standalone. Replace any of the placeholders with your actual earlier migrations.

// Lightweight DB type (works with better-sqlite3, expo-sqlite wrappers, and custom .run/.exec)
type DB = {
  exec?: (sql: string) => any;
  run?: (sql: string, ...params: any[]) => any;
  prepare?: (sql: string) => { run?: (...p: any[]) => any; all?: (...p: any[]) => any; get?: (...p: any[]) => any; };
};

export type Migration = (db: DB) => void;

// --- helpers -----------------------------------------------------------------
const tryExec = (db: DB, sql: string) => {
  try {
    if (typeof db.exec === 'function') return void db.exec(sql);
  } catch (_) {}
  try {
    if (typeof db.run === 'function') return void db.run(sql);
  } catch (_) {}
  try {
    if (typeof db.prepare === 'function') {
      const stmt = db.prepare(sql);
      if (stmt?.run) return void stmt.run();
      if (stmt?.all) return void stmt.all();
      if (stmt?.get) return void stmt.get();
    }
  } catch (_) {}
};

const tryGetScalar = (db: DB, sql: string, fallback: number = 0): number => {
  try {
    if (typeof (db as any).pragma === 'function') {
      // better-sqlite3 path
      const res: any = (db as any).pragma(sql, { simple: true });
      if (typeof res === 'number') return res;
    }
  } catch (_) {}
  try {
    if (typeof db.prepare === 'function') {
      const row = db.prepare(sql).get?.();
      if (row && typeof row === 'object') {
        const k = Object.keys(row)[0];
        const v = (row as any)[k];
        if (typeof v === 'number') return v;
      }
    }
  } catch (_) {}
  return fallback;
};

const setUserVersion = (db: DB, v: number) => tryExec(db, `PRAGMA user_version = ${v};`);
const getUserVersion = (db: DB) => tryGetScalar(db, 'PRAGMA user_version;', 0);

// --- existing migrations (placeholders) --------------------------------------
// NOTE: Replace these with your real v1–v6 if you have them in your project.
const noop: Migration = () => {};
export const migrate1_init: Migration = noop;
export const migrate2_moreStuff: Migration = noop;
export const migrate3_renameBuffetToDiningRoom: Migration = noop; // keep real impl if you have it
export const migrate4_addSegments: Migration = noop;              // keep real impl if you have it
export const migrate5_misc: Migration = noop;
export const migrate6_addExportGroup: Migration = noop;           // keep real impl if you have it

// --- NEW: v7 backfill + indexes + normalization ------------------------------
export const migrate7_backfillSegmentsAndIndexes: Migration = (db) => {
  // 0) Ensure segment master exists (will not override existing)
  tryExec(db, `CREATE TABLE IF NOT EXISTS segment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    start_time TEXT NOT NULL DEFAULT '08:00',
    end_time   TEXT NOT NULL DEFAULT '12:00',
    sort_order INTEGER NOT NULL DEFAULT 0
  );`);

  // 1) Harden unique indexes so upserts and lookups are deterministic
  tryExec(db, `CREATE UNIQUE INDEX IF NOT EXISTS ux_monthly_default
               ON monthly_default (month, person_id, segment);`);
  tryExec(db, `CREATE UNIQUE INDEX IF NOT EXISTS ux_monthly_default_day
               ON monthly_default_day (month, person_id, weekday, segment);`);
  tryExec(db, `CREATE UNIQUE INDEX IF NOT EXISTS ux_needs_baseline
               ON needs_baseline (group_id, role_id, segment);`);
  tryExec(db, `CREATE UNIQUE INDEX IF NOT EXISTS ux_needs_override
               ON needs_override (date, group_id, role_id, segment);`);

  // 2) Normalize obvious legacy labels and whitespace (safe no-ops if absent)
  tryExec(db, `UPDATE monthly_default     SET segment = TRIM(segment) WHERE segment LIKE ' %' OR segment LIKE '% ';`);
  tryExec(db, `UPDATE monthly_default_day SET segment = TRIM(segment) WHERE segment LIKE ' %' OR segment LIKE '% ';`);
  tryExec(db, `UPDATE needs_baseline      SET segment = TRIM(segment) WHERE segment LIKE ' %' OR segment LIKE '% ';`);
  tryExec(db, `UPDATE needs_override      SET segment = TRIM(segment) WHERE segment LIKE ' %' OR segment LIKE '% ';`);

  tryExec(db, `UPDATE monthly_default     SET segment='Early' WHERE LOWER(segment)='early shift';`);
  tryExec(db, `UPDATE monthly_default_day SET segment='Early' WHERE LOWER(segment)='early shift';`);
  tryExec(db, `UPDATE needs_baseline      SET segment='Early' WHERE LOWER(segment)='early shift';`);
  tryExec(db, `UPDATE needs_override      SET segment='Early' WHERE LOWER(segment)='early shift';`);
  tryExec(db, `UPDATE role SET segments = REPLACE(segments, '"Early Shift"', '"Early"')
               WHERE instr(segments, '"Early Shift"') > 0;`);

  // 3) Backfill missing segment names into the master from all referencing tables
  const backfillFrom = (table: string, col: string = 'segment') =>
    tryExec(db, `INSERT OR IGNORE INTO segment (name, start_time, end_time, sort_order)
                 SELECT DISTINCT ${col}, '08:00', '12:00', 999
                 FROM ${table}
                 WHERE ${col} IS NOT NULL AND TRIM(${col}) <> ''
                   AND ${col} NOT IN (SELECT name FROM segment);`);

  backfillFrom('monthly_default');
  backfillFrom('monthly_default_day');
  backfillFrom('needs_baseline');
  backfillFrom('needs_override');

  // 4) Ensure sort_order not null
  tryExec(db, `UPDATE segment SET sort_order = 999 WHERE sort_order IS NULL;`);
};

// --- registry & runner -------------------------------------------------------
export const migrations: Record<number, Migration> = {
  1: migrate1_init,
  2: migrate2_moreStuff,
  3: migrate3_renameBuffetToDiningRoom,
  4: migrate4_addSegments,
  5: migrate5_misc,
  6: migrate6_addExportGroup,
  7: migrate7_backfillSegmentsAndIndexes,
};

export const LATEST_MIGRATION = Math.max(...Object.keys(migrations).map(n => Number(n)));

export function runMigrations(db: DB) {
  // Prefer PRAGMA user_version if available; otherwise, run everything idempotently
  const current = getUserVersion(db);
  for (let v = current + 1; v <= LATEST_MIGRATION; v++) {
    const m = migrations[v as keyof typeof migrations];
    if (typeof m === 'function') {
      m(db);
      setUserVersion(db, v);
    }
  }
}

export default migrations;
