import type { Database } from 'sql.js';

export type Migration = (db: Database) => void;

const migrations: Record<number, Migration> = {
  1: (db) => {
    db.run(`PRAGMA journal_mode=WAL;`);
    db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`);
    db.run(`CREATE TABLE IF NOT EXISTS person (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      last_name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      work_email TEXT NOT NULL UNIQUE,
      brother_sister TEXT CHECK(brother_sister IN ('Brother','Sister')),
      commuter INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      avail_mon TEXT CHECK(avail_mon IN ('U','AM','PM','B')) DEFAULT 'U',
      avail_tue TEXT CHECK(avail_tue IN ('U','AM','PM','B')) DEFAULT 'U',
      avail_wed TEXT CHECK(avail_wed IN ('U','AM','PM','B')) DEFAULT 'U',
      avail_thu TEXT CHECK(avail_thu IN ('U','AM','PM','B')) DEFAULT 'U',
      avail_fri TEXT CHECK(avail_fri IN ('U','AM','PM','B')) DEFAULT 'U'
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS grp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      theme_color TEXT
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS role (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      segments TEXT NOT NULL,
      UNIQUE(code, name, group_id),
      FOREIGN KEY (group_id) REFERENCES grp(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS training (
      person_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('Not trained','In training','Qualified')) NOT NULL DEFAULT 'Not trained',
      PRIMARY KEY (person_id, role_id),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, -- YYYY-MM-DD
      person_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN ('Early','AM','Lunch','PM')) NOT NULL,
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS monthly_default (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL, -- YYYY-MM
      person_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN ('Early','AM','Lunch','PM')) NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS needs_baseline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN ('Early','AM','Lunch','PM')) NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      UNIQUE(group_id, role_id, segment)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS needs_override (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN ('Early','AM','Lunch','PM')) NOT NULL,
      required INTEGER NOT NULL,
      UNIQUE(date, group_id, role_id, segment)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS timeoff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      start_ts TEXT NOT NULL, -- ISO string
      end_ts TEXT NOT NULL,
      reason TEXT,
      source TEXT DEFAULT 'TeamsImport',
      FOREIGN KEY (person_id) REFERENCES person(id)
    );`);
  }
,
  2: (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS monthly_default_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      segment TEXT CHECK(segment IN ('Early','AM','Lunch','PM')) NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, weekday, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);
  }
 ,
  3: (db) => {
    const segmentCheck = "'Early','AM','Lunch','PM'";
    function recreate(name: string, createSql: string, columns: string) {
      db.run(`ALTER TABLE ${name} RENAME TO ${name}_old;`);
      db.run(createSql);
      db.run(`INSERT INTO ${name} (${columns}) SELECT ${columns} FROM ${name}_old;`);
      db.run(`DROP TABLE ${name}_old;`);
    }
    try {
      recreate(
        'assignment',
        `CREATE TABLE assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`,
        'id, date, person_id, role_id, segment'
      );
    } catch (e) {}
    try {
      recreate(
        'monthly_default',
        `CREATE TABLE monthly_default (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`,
        'id, month, person_id, segment, role_id'
      );
    } catch (e) {}
    try {
      recreate(
        'needs_baseline',
        `CREATE TABLE needs_baseline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      UNIQUE(group_id, role_id, segment)
    );`,
        'id, group_id, role_id, segment, required'
      );
    } catch (e) {}
    try {
      recreate(
        'needs_override',
        `CREATE TABLE needs_override (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      required INTEGER NOT NULL,
      UNIQUE(date, group_id, role_id, segment)
    );`,
        'id, date, group_id, role_id, segment, required'
      );
    } catch (e) {}
    try {
      recreate(
        'monthly_default_day',
        `CREATE TABLE monthly_default_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, weekday, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`,
        'id, month, person_id, weekday, segment, role_id'
      );
    } catch (e) {}
  }
};

export function addMigration(version: number, fn: Migration) {
  migrations[version] = fn;
}

export function applyMigrations(db: Database) {
  let current = 0;
  try {
    const rows = db.exec(`SELECT value FROM meta WHERE key='schema_version'`);
    if (rows && rows[0] && rows[0].values[0] && rows[0].values[0][0]) {
      current = parseInt(String(rows[0].values[0][0])) || 0;
    }
  } catch {
    // meta table may not exist yet
  }

  const versions = Object.keys(migrations).map(Number).sort((a, b) => a - b);
  for (const v of versions) {
    if (v > current) {
      migrations[v](db);
      db.run(
        `INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`,
        [String(v)]
      );
      current = v;
    }
  }
}

export default migrations;
