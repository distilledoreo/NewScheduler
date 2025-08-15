import type { Database } from 'sql.js';
import { GROUPS, ROLE_SEED } from '../config/domain';

export type Migration = (db: Database) => void;

export const migrate3RenameBuffetToDiningRoom: Migration = (db) => {
  db.run(`UPDATE grp SET name='Dining Room' WHERE name='Buffet';`);
  db.run(
    `UPDATE role SET code='DR', name=REPLACE(name,'Buffet','Dining Room') WHERE group_id=(SELECT id FROM grp WHERE name='Dining Room') AND segments<>'["Lunch"]';`
  );
};

export const migrate4AddSegments: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS segment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      ordering INTEGER NOT NULL UNIQUE
    );`);
  db.run(`INSERT INTO segment (name, start_time, end_time, ordering) VALUES
      ('Early','06:20','07:20',0),
      ('AM','08:00','11:00',1),
      ('Lunch','11:00','13:00',2),
      ('PM','14:00','17:00',3)
    ON CONFLICT(name) DO NOTHING;`);
};

export const migrate5AddGroupTheme: Migration = (db) => {
  try {
    db.run(`ALTER TABLE grp RENAME COLUMN theme_color TO theme;`);
  } catch {}
  try {
    db.run(`ALTER TABLE grp ADD COLUMN custom_color TEXT;`);
  } catch {}
};

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
      theme TEXT,
      custom_color TEXT
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

    // Seed initial groups and roles
    for (const [name, cfg] of Object.entries(GROUPS)) {
      db.run(
        `INSERT INTO grp (name, theme, custom_color) VALUES (?,?,?) ON CONFLICT(name) DO NOTHING;`,
        [name, cfg.theme, cfg.color]
      );
    }
    for (const r of ROLE_SEED) {
      const gidRows = db.exec(`SELECT id FROM grp WHERE name=?`, [r.group]);
      const gid = gidRows[0]?.values?.[0]?.[0];
      if (gid !== undefined) {
        db.run(
          `INSERT INTO role (code, name, group_id, segments) VALUES (?,?,?,?) ON CONFLICT(code, name, group_id) DO NOTHING;`,
          [r.code, r.name, gid, JSON.stringify(r.segments)]
        );
      }
    }

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
  },
  3: migrate3RenameBuffetToDiningRoom,
  4: migrate4AddSegments,
  5: migrate5AddGroupTheme,
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
