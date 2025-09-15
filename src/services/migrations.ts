type Database = any; // loose type to avoid dependency on sql.js types at build time
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

export const migrate11AddTrainingSource: Migration = (db) => {
  try {
    const info = db.exec(`PRAGMA table_info(training);`);
    const hasSource = Array.isArray(info) && info[0]?.values?.some((r: any[]) => r[1] === 'source');
    if (!hasSource) {
      db.run(`CREATE TABLE training_new (
        person_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        status TEXT CHECK(status IN ('Not trained','In training','Qualified')) NOT NULL DEFAULT 'Not trained',
        source TEXT CHECK(source IN ('manual','monthly')) NOT NULL DEFAULT 'manual',
        PRIMARY KEY (person_id, role_id),
        FOREIGN KEY (person_id) REFERENCES person(id),
        FOREIGN KEY (role_id) REFERENCES role(id)
      );`);
      db.run(`INSERT INTO training_new (person_id, role_id, status, source)
              SELECT person_id, role_id, status, 'manual' AS source FROM training;`);
      db.run(`DROP TABLE training;`);
      db.run(`ALTER TABLE training_new RENAME TO training;`);
    }
  } catch (e) {
    console.error('migrate11AddTrainingSource failed:', e);
    throw e;
  }
};

// 12. Add table for monthly default notes
export const migrate12AddMonthlyNotes: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS monthly_default_note (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      person_id INTEGER NOT NULL,
      note TEXT,
      UNIQUE(month, person_id),
      FOREIGN KEY (person_id) REFERENCES person(id)
    );`);
};

export const migrate13AddAvailabilityOverride: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS availability_override (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      avail TEXT CHECK(avail IN ('U','AM','PM','B')) NOT NULL,
      UNIQUE(person_id, date),
      FOREIGN KEY (person_id) REFERENCES person(id)
    );`);
};

export const migrate14AddSegmentAdjustment: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS segment_adjustment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condition_segment TEXT NOT NULL,
      target_segment TEXT NOT NULL,
      target_field TEXT CHECK(target_field IN ('start','end')) NOT NULL,
      baseline TEXT CHECK(baseline IN ('condition.start','condition.end','target.start','target.end')) NOT NULL,
      offset_minutes INTEGER NOT NULL DEFAULT 0
    );`);
  db.run(`INSERT INTO segment_adjustment (condition_segment,target_segment,target_field,baseline,offset_minutes) VALUES
      ('Lunch','AM','end','condition.start',0),
      ('Lunch','PM','start','condition.end',60),
      ('Early','PM','end','target.end',-60)
    `);
};

export const migrate15AddSegmentAdjustmentRole: Migration = (db) => {
  try {
    db.run(`ALTER TABLE segment_adjustment ADD COLUMN condition_role_id INTEGER REFERENCES role(id);`);
  } catch {}
};

export const migrate16AddCompetency: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS competency (
      person_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
      PRIMARY KEY (person_id, role_id),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);
};

export const migrate17AddPersonQuality: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS person_quality (
      person_id INTEGER PRIMARY KEY,
      work_capabilities INTEGER CHECK(work_capabilities BETWEEN 1 AND 5),
      work_habits INTEGER CHECK(work_habits BETWEEN 1 AND 5),
      spirituality INTEGER CHECK(spirituality BETWEEN 1 AND 5),
      dealings_with_others INTEGER CHECK(dealings_with_others BETWEEN 1 AND 5),
      health INTEGER CHECK(health BETWEEN 1 AND 5),
      dress_grooming INTEGER CHECK(dress_grooming BETWEEN 1 AND 5),
      attitude_safety INTEGER CHECK(attitude_safety BETWEEN 1 AND 5),
      response_counsel INTEGER CHECK(response_counsel BETWEEN 1 AND 5),
      training_ability INTEGER CHECK(training_ability BETWEEN 1 AND 5),
      potential_future_use INTEGER CHECK(potential_future_use BETWEEN 1 AND 5),
      FOREIGN KEY (person_id) REFERENCES person(id)
    );`);
};

// 18. Add skill catalog and person_skill ratings
export const migrate18AddSkillCatalog: Migration = (db) => {
  db.run(`CREATE TABLE IF NOT EXISTS skill (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  group_id INTEGER REFERENCES grp(id)
    );`);
  db.run(`CREATE TABLE IF NOT EXISTS person_skill (
      person_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
      PRIMARY KEY (person_id, skill_id),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (skill_id) REFERENCES skill(id)
    );`);
  // Optional order table to let admins manage display order
  db.run(`CREATE TABLE IF NOT EXISTS skill_order (
      skill_id INTEGER PRIMARY KEY,
      ordering INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (skill_id) REFERENCES skill(id)
    );`);
};

// 19. Add group assignment to skills for export grouping
export const migrate19AddSkillGroupId: Migration = (db) => {
  try {
    db.run(`ALTER TABLE skill ADD COLUMN group_id INTEGER REFERENCES grp(id);`);
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

export const migrate7SegmentRefs: Migration = (_db) => {
  // Skip this migration - we'll handle it in migration 8
  console.log('Migration 7 skipped - will be handled by migration 8');
};

// COMPLETELY REWRITTEN MIGRATION 8
export const migrate8FixSegmentConstraints: Migration = (db) => {
  console.log('Starting migration 8 - Fix segment constraints');
  
  // Clean up any old temporary tables from failed migrations
  const tempTables = ['assignment_old', 'monthly_default_old', 'monthly_default_day_old', 
                      'needs_baseline_old', 'needs_override_old',
                      'assignment_temp', 'monthly_default_temp', 'monthly_default_day_temp',
                      'needs_baseline_temp', 'needs_override_temp'];
  
  for (const tempTable of tempTables) {
    try {
      db.run(`DROP TABLE IF EXISTS ${tempTable};`);
    } catch (e) {
      console.log(`Could not drop ${tempTable}:`, e);
    }
  }

  // Function to check if a table needs migration
  const needsMigration = (tableName: string): boolean => {
    try {
      const sqlInfo = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}';`);
      const tableSql = sqlInfo[0]?.values?.[0]?.[0] as string || '';
      
      // Check for old-style column definitions or CHECK constraints
      if (tableSql.includes('CHECK(segment IN') || 
          tableSql.includes('CHECK (segment IN') ||
          tableSql.includes('am_role_id') ||
          tableSql.includes('lunch_role_id') ||
          tableSql.includes('pm_role_id') ||
          tableSql.includes('early_role_id')) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // 1. Fix assignment table
  if (needsMigration('assignment')) {
    console.log('Migrating assignment table...');
    try {
      // Check if it's the old column structure
      const info = db.exec(`PRAGMA table_info(assignment);`);
      const columns = info[0]?.values?.map((r: any[]) => String(r[1])) || [];
      
      if (columns.includes('am_role_id') || columns.includes('lunch_role_id') || columns.includes('pm_role_id')) {
        // Old structure with separate columns - not handling this case as it should have been migrated already
        console.log('Assignment table has old structure - skipping');
      } else {
        // New structure but with CHECK constraint - rebuild without constraint
        db.run(`CREATE TABLE assignment_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          person_id INTEGER NOT NULL,
          role_id INTEGER NOT NULL,
          segment TEXT NOT NULL,
          FOREIGN KEY (person_id) REFERENCES person(id),
          FOREIGN KEY (role_id) REFERENCES role(id)
        );`);
        
        // Copy data excluding the id column (it will be auto-generated)
        db.run(`INSERT INTO assignment_new (date, person_id, role_id, segment) 
                SELECT date, person_id, role_id, segment FROM assignment;`);
        db.run(`DROP TABLE assignment;`);
        db.run(`ALTER TABLE assignment_new RENAME TO assignment;`);
      }
    } catch (e) {
      console.error('Error migrating assignment table:', e);
    }
  }

  // 2. Fix monthly_default table
  if (needsMigration('monthly_default')) {
    console.log('Migrating monthly_default table...');
    try {
      const info = db.exec(`PRAGMA table_info(monthly_default);`);
      const columns = info[0]?.values?.map((r: any[]) => String(r[1])) || [];
      
      if (columns.includes('am_role_id')) {
        // Old structure - need to transform data
        console.log('Transforming old monthly_default structure...');
        
        db.run(`CREATE TABLE monthly_default_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month TEXT NOT NULL,
          person_id INTEGER NOT NULL,
          segment TEXT NOT NULL,
          role_id INTEGER NOT NULL,
          UNIQUE(month, person_id, segment),
          FOREIGN KEY (person_id) REFERENCES person(id),
          FOREIGN KEY (role_id) REFERENCES role(id)
        );`);
        
        // Get all old data
        const hasEarly = columns.includes('early_role_id');
        let selectCols = 'month, person_id, am_role_id, lunch_role_id, pm_role_id';
        if (hasEarly) selectCols += ', early_role_id';
        
        const oldData = db.exec(`SELECT ${selectCols} FROM monthly_default;`);
        const rows = oldData[0]?.values || [];
        
        for (const row of rows) {
          const [month, personId, am, lunch, pm, early] = row as any[];
          if (am != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_new (month, person_id, segment, role_id) VALUES (?,?,?,?)`, 
                   [month, personId, 'AM', am]);
          }
          if (lunch != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_new (month, person_id, segment, role_id) VALUES (?,?,?,?)`, 
                   [month, personId, 'Lunch', lunch]);
          }
          if (pm != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_new (month, person_id, segment, role_id) VALUES (?,?,?,?)`, 
                   [month, personId, 'PM', pm]);
          }
          if (hasEarly && early != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_new (month, person_id, segment, role_id) VALUES (?,?,?,?)`, 
                   [month, personId, 'Early', early]);
          }
        }
        
        db.run(`DROP TABLE monthly_default;`);
        db.run(`ALTER TABLE monthly_default_new RENAME TO monthly_default;`);
      } else {
        // New structure but with CHECK constraint
        db.run(`CREATE TABLE monthly_default_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month TEXT NOT NULL,
          person_id INTEGER NOT NULL,
          segment TEXT NOT NULL,
          role_id INTEGER NOT NULL,
          UNIQUE(month, person_id, segment),
          FOREIGN KEY (person_id) REFERENCES person(id),
          FOREIGN KEY (role_id) REFERENCES role(id)
        );`);
        
        // Copy data excluding the id column (it will be auto-generated)
        db.run(`INSERT INTO monthly_default_new (month, person_id, segment, role_id) 
                SELECT month, person_id, segment, role_id FROM monthly_default;`);
        db.run(`DROP TABLE monthly_default;`);
        db.run(`ALTER TABLE monthly_default_new RENAME TO monthly_default;`);
      }
    } catch (e) {
      console.error('Error migrating monthly_default table:', e);
    }
  }

  // 3. Fix monthly_default_day table
  if (needsMigration('monthly_default_day')) {
    console.log('Migrating monthly_default_day table...');
    try {
      const info = db.exec(`PRAGMA table_info(monthly_default_day);`);
      const columns = info[0]?.values?.map((r: any[]) => String(r[1])) || [];
      
      if (columns.includes('am_role_id')) {
        // Old structure - need to transform data
        console.log('Transforming old monthly_default_day structure...');
        
        db.run(`CREATE TABLE monthly_default_day_new (
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
        
        // Get all old data
        const hasEarly = columns.includes('early_role_id');
        let selectCols = 'month, person_id, weekday, am_role_id, lunch_role_id, pm_role_id';
        if (hasEarly) selectCols += ', early_role_id';
        
        const oldData = db.exec(`SELECT ${selectCols} FROM monthly_default_day;`);
        const rows = oldData[0]?.values || [];
        
        for (const row of rows) {
          const [month, personId, weekday, am, lunch, pm, early] = row as any[];
          if (am != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_day_new (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, 
                   [month, personId, weekday, 'AM', am]);
          }
          if (lunch != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_day_new (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, 
                   [month, personId, weekday, 'Lunch', lunch]);
          }
          if (pm != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_day_new (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, 
                   [month, personId, weekday, 'PM', pm]);
          }
          if (hasEarly && early != null) {
            db.run(`INSERT OR IGNORE INTO monthly_default_day_new (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)`, 
                   [month, personId, weekday, 'Early', early]);
          }
        }
        
        db.run(`DROP TABLE monthly_default_day;`);
        db.run(`ALTER TABLE monthly_default_day_new RENAME TO monthly_default_day;`);
      } else {
        // New structure but with CHECK constraint
        db.run(`CREATE TABLE monthly_default_day_new (
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
        
        // Copy data excluding the id column (it will be auto-generated)
        db.run(`INSERT INTO monthly_default_day_new (month, person_id, weekday, segment, role_id) 
                SELECT month, person_id, weekday, segment, role_id FROM monthly_default_day;`);
        db.run(`DROP TABLE monthly_default_day;`);
        db.run(`ALTER TABLE monthly_default_day_new RENAME TO monthly_default_day;`);
      }
    } catch (e) {
      console.error('Error migrating monthly_default_day table:', e);
    }
  }

  // 4. Fix needs_baseline table
  if (needsMigration('needs_baseline')) {
    console.log('Migrating needs_baseline table...');
    try {
      db.run(`CREATE TABLE needs_baseline_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        segment TEXT NOT NULL,
        required INTEGER NOT NULL DEFAULT 0,
        UNIQUE(group_id, role_id, segment)
      );`);
      
      // Copy data excluding the id column (it will be auto-generated)
      db.run(`INSERT INTO needs_baseline_new (group_id, role_id, segment, required) 
              SELECT group_id, role_id, segment, required FROM needs_baseline;`);
      db.run(`DROP TABLE needs_baseline;`);
      db.run(`ALTER TABLE needs_baseline_new RENAME TO needs_baseline;`);
    } catch (e) {
      console.error('Error migrating needs_baseline table:', e);
    }
  }

  // 5. Fix needs_override table
  if (needsMigration('needs_override')) {
    console.log('Migrating needs_override table...');
    try {
      db.run(`CREATE TABLE needs_override_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        segment TEXT NOT NULL,
        required INTEGER NOT NULL,
        UNIQUE(date, group_id, role_id, segment)
      );`);
      
      // Copy data excluding the id column (it will be auto-generated)
      db.run(`INSERT INTO needs_override_new (date, group_id, role_id, segment, required) 
              SELECT date, group_id, role_id, segment, required FROM needs_override;`);
      db.run(`DROP TABLE needs_override;`);
      db.run(`ALTER TABLE needs_override_new RENAME TO needs_override;`);
    } catch (e) {
      console.error('Error migrating needs_override table:', e);
    }
  }

  console.log('Migration 8 complete');
};

// 10. Backfill missing group colors/themes from config defaults for older DBs
export const migrate10BackfillGroupCustomColor: Migration = (db) => {
  try {
    // Ensure columns exist (defensive)
    try { db.run(`ALTER TABLE grp ADD COLUMN custom_color TEXT;`); } catch {}
    try { db.run(`ALTER TABLE grp ADD COLUMN theme TEXT;`); } catch {}

    // Get existing groups
    const res = db.exec(`SELECT id, name, theme, custom_color FROM grp;`);
    const rows: Array<{ id: number; name: string; theme: string | null; custom_color: string | null }> =
      (res[0]?.values || []).map((v: any[]) => ({ id: Number(v[0]), name: String(v[1]), theme: v[2] ?? null, custom_color: v[3] ?? null }));

    for (const g of rows) {
      const cfg = GROUPS[g.name as keyof typeof GROUPS];
      if (!cfg) continue;
      const nextTheme = g.theme ?? cfg.theme;
      const nextColor = g.custom_color ?? cfg.color;
      // Only write if something is missing to avoid clobbering user customizations
      if (g.theme == null || g.custom_color == null) {
        db.run(`UPDATE grp SET theme = COALESCE(theme, ?), custom_color = COALESCE(custom_color, ?) WHERE id = ?;`, [nextTheme, nextColor, g.id]);
      }
    }
  } catch (e) {
    console.error('migrate10BackfillGroupCustomColor failed:', e);
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
      source TEXT CHECK(source IN ('manual','monthly')) NOT NULL DEFAULT 'manual',
      PRIMARY KEY (person_id, role_id),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    // Create tables WITHOUT segment CHECK constraints
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
    // Ensure training table has 'source' column
    try {
      const info = db.exec(`PRAGMA table_info(training);`);
      const hasSource = Array.isArray(info) && info[0]?.values?.some((r: any[]) => r[1] === 'source');
      if (!hasSource) {
        // Recreate training with source column
        db.run(`CREATE TABLE training_new (
          person_id INTEGER NOT NULL,
          role_id INTEGER NOT NULL,
          status TEXT CHECK(status IN ('Not trained','In training','Qualified')) NOT NULL DEFAULT 'Not trained',
          source TEXT CHECK(source IN ('manual','monthly')) NOT NULL DEFAULT 'manual',
          PRIMARY KEY (person_id, role_id),
          FOREIGN KEY (person_id) REFERENCES person(id),
          FOREIGN KEY (role_id) REFERENCES role(id)
        );`);
        db.run(`INSERT INTO training_new (person_id, role_id, status, source)
                SELECT person_id, role_id, status, 'manual' AS source FROM training;`);
        db.run(`DROP TABLE training;`);
        db.run(`ALTER TABLE training_new RENAME TO training;`);
      }
    } catch {}

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
  8: migrate8FixSegmentConstraints,
  9: migrate8FixSegmentConstraints, // Run the same migration again as 9 to fix failed migration 8
  10: migrate10BackfillGroupCustomColor,
  11: migrate11AddTrainingSource,
  12: migrate12AddMonthlyNotes,
  13: migrate13AddAvailabilityOverride,
  14: migrate14AddSegmentAdjustment,
  15: migrate15AddSegmentAdjustmentRole,
  16: migrate16AddCompetency,
  17: migrate17AddPersonQuality,
  18: migrate18AddSkillCatalog,
  19: migrate19AddSkillGroupId,
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
      console.log(`Applying migration ${v}...`);
      try {
        migrations[v](db);
        db.run(
          `INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`,
          [String(v)]
        );
        console.log(`Migration ${v} completed successfully`);
        current = v;
      } catch (e) {
        console.error(`Migration ${v} failed:`, e);
        throw e;
      }
    }
  }
}

export default migrations;
