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

export const migrate6AddExportGroup: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS export_group (
      group_id INTEGER PRIMARY KEY,
      code TEXT NOT NULL,
      color TEXT NOT NULL,
      column_group TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES grp(id)
    );`);
  const seed = [
    { name: 'Veggie Room', code: 'VEG', color: 'FFD8E4BC', column_group: 'kitchen1' },
    { name: 'Bakery', code: 'BKRY', color: 'FFEAD1DC', column_group: 'kitchen1' },
    { name: 'Main Course', code: 'MC', color: 'FFF4CCCC', column_group: 'kitchen2' },
    { name: 'Receiving', code: 'RCVG', color: 'FFBDD7EE', column_group: 'kitchen2' },
    { name: 'Prepack', code: 'PREPACK', color: 'FFCCE5FF', column_group: 'kitchen2' },
    { name: 'Office', code: 'OFF', color: 'FFFFF2CC', column_group: 'kitchen2' },
    { name: 'Dining Room', code: 'DR', color: 'FFFFF2CC', column_group: 'dining' },
    { name: 'Machine Room', code: 'MR', color: 'FFD9D2E9', column_group: 'dining' },
  ];
  for (const s of seed) {
    const gidRows = db.exec(`SELECT id FROM grp WHERE name=?`, [s.name]);
    const gid = gidRows[0]?.values?.[0]?.[0];
    if (gid !== undefined) {
      db.run(
        `INSERT INTO export_group (group_id, code, color, column_group) VALUES (?,?,?,?) ON CONFLICT(group_id) DO NOTHING;`,
        [gid, s.code, s.color, s.column_group]
      );
    }
  }
};

export const migrate7SegmentRefs: Migration = (db) => {
  const rebuild = (
    table: string,
    createSql: string,
    columns: string
  ) => {
    const old = `${table}_old`;
    try {
      db.run(`ALTER TABLE ${table} RENAME TO ${old};`);
    } catch {
      return;
    }

    db.run(createSql);

    let migrated = false;
    try {
      db.run(
        `INSERT INTO ${table} (${columns}) SELECT ${columns} FROM ${old};`
      );
      migrated = true;
    } catch {
      const info = db.exec(`PRAGMA table_info(${old});`);
      const names = info[0]?.values?.map((r: any[]) => String(r[1])) || [];

      if (table === 'monthly_default' && names.includes('am_role_id')) {
        const hasEarly = names.includes('early_role_id');
        let select = `SELECT month, person_id, am_role_id, lunch_role_id, pm_role_id`;
        if (hasEarly) select += ', early_role_id';
        select += ` FROM ${old}`;
        const rows = db.exec(select);
        const vals = rows[0]?.values || [];
        for (const row of vals) {
          const [month, personId, am, lunch, pm, early] = row as any[];
          if (am != null) db.run(`INSERT INTO ${table} (month, person_id, segment, role_id) VALUES (?,?,?,?)`, [month, personId, 'AM', am]);
          if (lunch != null) db.run(`INSERT INTO ${table} (month, person_id, segment, role_id) VALUES (?,?,?,?)`, [month, personId, 'Lunch', lunch]);
          if (pm != null) db.run(`INSERT INTO ${table} (month, person_id, segment, role_id) VALUES (?,?,?,?)`, [month, personId, 'PM', pm]);
          if (hasEarly && early != null) db.run(`INSERT INTO ${table} (month, person_id, segment, role_id) VALUES (?,?,?,?)`, [month, personId, 'Early', early]);
        }
        migrated = true;
      } else if (table === 'monthly_default_day' && names.includes('am_role_id')) {
        const hasEarly = names.includes('early_role_id');
        let select = `SELECT month, person_id, weekday, am_role_id, lunch_role_id, pm_role_id`;
        if (hasEarly) select += ', early_role_id';
        select += ` FROM ${old}`;
        const rows = db.exec(select);
        const vals = rows[0]?.values || [];
        for (const row of vals) {
          const [month, personId, weekday, am, lunch, pm, early] = row as any[];
          if (am != null) db.run(`INSERT INTO ${table} (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, [month, personId, weekday, 'AM', am]);
          if (lunch != null) db.run(`INSERT INTO ${table} (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, [month, personId, weekday, 'Lunch', lunch]);
          if (pm != null) db.run(`INSERT INTO ${table} (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, [month, personId, weekday, 'PM', pm]);
          if (hasEarly && early != null) db.run(`INSERT INTO ${table} (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, [month, personId, weekday, 'Early', early]);
        }
        migrated = true;
      }
    }

    if (!migrated) {
      // If migration failed entirely, drop the new table and restore old
      db.run(`DROP TABLE ${table};`);
      db.run(`ALTER TABLE ${old} RENAME TO ${table};`);
      return;
    }

    db.run(`DROP TABLE ${old};`);
  };

  // Use TEXT without CHECK constraints to allow any segment name
  rebuild(
    'assignment',
    `CREATE TABLE assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`,
    'id, date, person_id, role_id, segment'
  );

  rebuild(
    'monthly_default',
    `CREATE TABLE monthly_default (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`,
    'id, month, person_id, segment, role_id'
  );

  rebuild(
    'monthly_default_day',
    `CREATE TABLE monthly_default_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      segment TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, weekday, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`,
    'id, month, person_id, weekday, segment, role_id'
  );

  rebuild(
    'needs_baseline',
    `CREATE TABLE needs_baseline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      UNIQUE(group_id, role_id, segment)
    );`,
    'id, group_id, role_id, segment, required'
  );

  rebuild(
    'needs_override',
    `CREATE TABLE needs_override (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      required INTEGER NOT NULL,
      UNIQUE(date, group_id, role_id, segment)
    );`,
    'id, date, group_id, role_id, segment, required'
  );
};

// NEW MIGRATION 8: Remove CHECK constraints from existing tables
export const migrate8RemoveSegmentConstraints: Migration = (db) => {
  // This migration specifically handles databases that still have CHECK constraints
  // preventing new segments from being saved
  
  const tablesToFix = [
    { name: 'assignment', hasId: true },
    { name: 'monthly_default', hasId: true },
    { name: 'monthly_default_day', hasId: true },
    { name: 'needs_baseline', hasId: true },
    { name: 'needs_override', hasId: true }
  ];

  for (const table of tablesToFix) {
    try {
      // Check if table has CHECK constraint on segment column
      const info = db.exec(`PRAGMA table_info(${table.name});`);
      const columns = info[0]?.values || [];
      
      // Find segment column and check for CHECK constraint
      let hasCheckConstraint = false;
      for (const col of columns) {
        const colName = String(col[1]);
        if (colName === 'segment') {
          // SQLite doesn't directly expose CHECK constraints in table_info,
          // but we can check the table's SQL definition
          const sqlInfo = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table.name}';`);
          const tableSql = sqlInfo[0]?.values?.[0]?.[0] as string || '';
          
          // Look for CHECK constraint on segment column
          if (tableSql.includes('CHECK(segment IN') || tableSql.includes('CHECK (segment IN')) {
            hasCheckConstraint = true;
            break;
          }
        }
      }

      if (hasCheckConstraint) {
        console.log(`Removing CHECK constraint from ${table.name}...`);
        
        // We need to rebuild the table without the CHECK constraint
        const tempName = `${table.name}_temp_fix`;
        
        // Get all column definitions
        const colDefs: string[] = [];
        const colNames: string[] = [];
        
        for (const col of columns) {
          const name = String(col[1]);
          const type = String(col[2]);
          const notNull = col[3] ? ' NOT NULL' : '';
          const defaultVal = col[4] != null ? ` DEFAULT ${col[4]}` : '';
          const pk = col[5] ? ' PRIMARY KEY AUTOINCREMENT' : '';
          
          colNames.push(name);
          
          // Remove CHECK constraint from segment column
          if (name === 'segment') {
            colDefs.push(`${name} TEXT${notNull}`);
          } else {
            colDefs.push(`${name} ${type}${notNull}${defaultVal}${pk}`);
          }
        }

        // Add foreign keys and unique constraints based on original table
        let constraints = '';
        if (table.name === 'assignment') {
          constraints = `, FOREIGN KEY (person_id) REFERENCES person(id), FOREIGN KEY (role_id) REFERENCES role(id)`;
        } else if (table.name === 'monthly_default') {
          constraints = `, UNIQUE(month, person_id, segment), FOREIGN KEY (person_id) REFERENCES person(id), FOREIGN KEY (role_id) REFERENCES role(id)`;
        } else if (table.name === 'monthly_default_day') {
          constraints = `, UNIQUE(month, person_id, weekday, segment), FOREIGN KEY (person_id) REFERENCES person(id), FOREIGN KEY (role_id) REFERENCES role(id)`;
        } else if (table.name === 'needs_baseline') {
          constraints = `, UNIQUE(group_id, role_id, segment)`;
        } else if (table.name === 'needs_override') {
          constraints = `, UNIQUE(date, group_id, role_id, segment)`;
        }

        // Create new table without CHECK constraint
        const createSql = `CREATE TABLE ${tempName} (${colDefs.join(', ')}${constraints});`;
        db.run(createSql);

        // Copy data
        const copyColumns = colNames.join(', ');
        db.run(`INSERT INTO ${tempName} (${copyColumns}) SELECT ${copyColumns} FROM ${table.name};`);

        // Drop old table and rename new one
        db.run(`DROP TABLE ${table.name};`);
        db.run(`ALTER TABLE ${tempName} RENAME TO ${table.name};`);
      }
    } catch (e) {
      console.error(`Error fixing ${table.name}:`, e);
      // Continue with other tables even if one fails
    }
  }
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

    // Note: For new databases, we create tables without CHECK constraints on segment
    db.run(`CREATE TABLE IF NOT EXISTS assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS monthly_default (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS needs_baseline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      UNIQUE(group_id, role_id, segment)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS needs_override (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT NOT NULL,
      required INTEGER NOT NULL,
      UNIQUE(date, group_id, role_id, segment)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS timeoff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      start_ts TEXT NOT NULL,
      end_ts TEXT NOT NULL,
      reason TEXT,
      source TEXT DEFAULT 'TeamsImport',
      FOREIGN KEY (person_id) REFERENCES person(id)
    );`);
  },
  2: (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS monthly_default_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      segment TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, weekday, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);
  },
  3: migrate3RenameBuffetToDiningRoom,
  4: migrate4AddSegments,
  5: migrate5AddGroupTheme,
  6: migrate6AddExportGroup,
  7: migrate7SegmentRefs,
  8: migrate8RemoveSegmentConstraints,
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
