import React, { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { applyMigrations } from "./services/migrations";
import { SEGMENTS, GROUPS, ROLE_SEED, baseSegmentTimes, earlyTimes } from "./config/domain";
import type { Segment } from "./config/domain";

const Grid = WidthProvider(GridLayout);

/*
MVP: Pure-browser scheduler for Microsoft Teams Shifts
- Data stays local via File System Access API + sql.js (WASM) SQLite
- Single-editor model (soft lock stored in DB). No multi-user concurrency.
- Views: Daily Run Board, Needs vs Coverage, Export Preview
- Features: Create/Open/Save DB, People editor, Needs baseline + date overrides,
            Assignments with rules, Import Time-Off from Teams XLSX, Export to Shifts XLSX

IMPORTANT: To avoid Rollup bundling Node-only modules (fs), we **do not import `xlsx` from NPM**.
We dynamically load the browser ESM build from SheetJS CDN at runtime.

Runtime deps (loaded via CDN):
  - sql.js (WASM) via jsDelivr
  - xlsx ESM via SheetJS CDN (no Node `fs`)

Tailwind classes used for styling. This file is a single React component export.
*/

// Types
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

// Helpers
function fmtDateMDY(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function fmtTime24(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function cloneDate(d: Date) { return new Date(d.getTime()); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function parseMDY(str: string): Date {
  // expects M/D/YYYY
  const [m, d, y] = str.split("/").map((s) => parseInt(s.trim(), 10));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return dt;
}

function parseYMD(str: string): Date {
  // expects YYYY-MM-DD
  const [y, m, d] = str.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function weekdayName(d: Date): Weekday | "Weekend" {
  const n = d.getDay(); // 0 Sun .. 6 Sat
  switch (n) {
    case 1: return "Monday";
    case 2: return "Tuesday";
    case 3: return "Wednesday";
    case 4: return "Thursday";
    case 5: return "Friday";
    default: return "Weekend";
  }
}

// SQL.js
let SQL: any = null; // sql.js module

// XLSX (browser ESM via CDN only)
const XLSX_URL = "https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs";
async function loadXLSX(){
  // Prevent bundlers from trying to pre-bundle the module
  // @ts-ignore
  const mod = await import(/* @vite-ignore */ XLSX_URL);
  return mod as any;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [sqlDb, setSqlDb] = useState<any | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const [lockEmail, setLockEmail] = useState<string>("");
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => fmtDateMDY(new Date()));
  const [exportStart, setExportStart] = useState<string>(() => fmtDateMDY(new Date()));
  const [exportEnd, setExportEnd] = useState<string>(() => fmtDateMDY(new Date()));
  const [activeTab, setActiveTab] = useState<"RUN" | "PEOPLE" | "NEEDS" | "EXPORT" | "MONTHLY" | "HISTORY">("RUN");
  // Allow selecting Early in Daily Run board
  const [activeRunSegment, setActiveRunSegment] = useState<Segment>("AM");

  // Diagnostics
  const [diag, setDiag] = useState<{passed:number;failed:number;details:string[]}|null>(null);

  // People cache for quick UI (id -> record)
  const [people, setPeople] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
    });
  const [monthlyDefaults, setMonthlyDefaults] = useState<any[]>([]);
  const [monthlyEditing, setMonthlyEditing] = useState(false);

  // UI: simple dialogs
  const [showBaselineEditor, setShowBaselineEditor] = useState(false);

  useEffect(() => {
    if (sqlDb) loadMonthlyDefaults(selectedMonth);
  }, [sqlDb, selectedMonth]);

  // Load sql.js
  useEffect(() => {
    (async () => {
      try {
        // @ts-ignore
        const initSqlJs = (await import("sql.js")).default;
        // Configure to load WASM files from public directory
        SQL = await initSqlJs({ 
          locateFile: (file: string) => `/sql-wasm/${file}`
        });
        setReady(true);
      } catch (error) {
        console.error("Failed to initialize sql.js:", error);
        setStatus("Failed to initialize database engine. Please refresh the page.");
      }
    })();
  }, []);

  // DB helpers
  function exec(sql: string, params: any[] = [], db = sqlDb) {
    if (!db) throw new Error("DB not open");
    return db.exec(sql, params);
  }
  function run(sql: string, params: any[] = [], db = sqlDb) {
    if (!db) throw new Error("DB not open");
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
  }
  function all(sql: string, params: any[] = [], db = sqlDb) {
    if (!db) throw new Error("DB not open");
    const stmt = db.prepare(sql);
    const rows: any[] = [];
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  async function createNewDb() {
    if (!SQL) return;
    const db = new SQL.Database();
    applyMigrations(db);
    const segmentCheck = SEGMENTS.map(s => `'${s}'`).join(',');
    // Schema
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
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS monthly_default (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL, -- YYYY-MM
      person_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      role_id INTEGER NOT NULL,
      UNIQUE(month, person_id, segment),
      FOREIGN KEY (person_id) REFERENCES person(id),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS needs_baseline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      UNIQUE(group_id, role_id, segment)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS needs_override (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
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

    // Seed groups
    Object.entries(GROUPS).forEach(([name, cfg]) => {
      const stmt = db.prepare(`INSERT INTO grp (name, theme_color) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET theme_color=excluded.theme_color;`);
      stmt.bind([name, cfg.theme]);
      stmt.step();
      stmt.free();
    });

    // Seed roles
    ROLE_SEED.forEach((r) => {
      const gid = db.exec(`SELECT id FROM grp WHERE name=$name`, { $name: r.group })[0]?.values?.[0]?.[0];
      if (!gid) return;
      const stmt = db.prepare(`INSERT OR IGNORE INTO role (code, name, group_id, segments) VALUES (?,?,?,?)`);
      stmt.bind([r.code, r.name, gid, JSON.stringify(r.segments)]);
      stmt.step();
      stmt.free();
    });

    // Soft lock cleared
    db.run(`INSERT OR REPLACE INTO meta (key,value) VALUES ('lock','{}')`);

    setSqlDb(db);
    setStatus("New DB created (unsaved). Use Save As to write a .db file.");
    refreshCaches(db);
  }

  async function openDbFromFile() {
    try {
      // Ask user for SQLite DB
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: "SQLite DB", accept: { "application/octet-stream": [".db", ".sqlite"] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buf));
      const segmentCheck = SEGMENTS.map(s => `'${s}'`).join(',');

      applyMigrations(db);
      db.run(`CREATE TABLE IF NOT EXISTS monthly_default (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        person_id INTEGER NOT NULL,
        segment TEXT CHECK(segment IN (${segmentCheck})) NOT NULL,
        role_id INTEGER NOT NULL,
        UNIQUE(month, person_id, segment),
        FOREIGN KEY (person_id) REFERENCES person(id),
        FOREIGN KEY (role_id) REFERENCES role(id)
      );`);

      // Check soft lock
      let lockJson = {} as any;
      try {
        const rows = db.exec(`SELECT value FROM meta WHERE key='lock'`);
        if (rows && rows[0] && rows[0].values[0] && rows[0].values[0][0]) {
          lockJson = JSON.parse(String(rows[0].values[0][0]));
        }
      } catch {}

      if (lockJson && lockJson.active) {
        setLockedBy(lockJson.email || "unknown");
        setSqlDb(db);
        fileHandleRef.current = handle;
        setStatus(`DB is locked by ${lockJson.email}. You can browse but cannot edit. (Per your policy: never force; make a copy if needed.)`);
      } else {
        // Ask for editor email to lock
        const email = prompt("Enter your Work Email to take the edit lock:") || "";
        if (!email) {
          alert("Lock required to edit. Opening read-only.");
          setLockedBy("(read-only)");
        } else {
          const stmt = db.prepare(`INSERT OR REPLACE INTO meta (key,value) VALUES ('lock', ?) `);
          stmt.bind([JSON.stringify({ active: true, email, ts: new Date().toISOString() })]);
          stmt.step();
          stmt.free();
          setLockEmail(email);
          setLockedBy(email);
        }
        setSqlDb(db);
        fileHandleRef.current = handle;
        setStatus(`Opened ${file.name}`);
      }
      refreshCaches(db);
    } catch (e:any) {
      console.error(e);
      alert(e?.message || "Open failed");
    }
  }

  async function saveDbAs() {
    if (!sqlDb) return;
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: `teams-shifts-${Date.now()}.db`,
      types: [{ description: "SQLite DB", accept: { "application/octet-stream": [".db"] } }],
    });
    await writeDbToHandle(handle);
    fileHandleRef.current = handle;
  }

  async function saveDb() {
    if (!sqlDb) return;
    if (!fileHandleRef.current) return saveDbAs();
    await writeDbToHandle(fileHandleRef.current);
  }

  async function writeDbToHandle(handle: FileSystemFileHandle) {
    const data = sqlDb.export();
    const writable = await (handle as any).createWritable();
    await writable.write(data);
    await writable.close();
    setStatus("Saved.");
  }

  function refreshCaches(db = sqlDb) {
    if (!db) return;
    const g = all(`SELECT id,name,theme_color FROM grp ORDER BY name`, [], db);
    setGroups(g);
    const r = all(`SELECT r.id, r.code, r.name, r.group_id, r.segments, g.name as group_name FROM role r JOIN grp g ON g.id=r.group_id ORDER BY g.name, r.name`, [], db);
    setRoles(r.map(x => ({ ...x, segments: JSON.parse(x.segments) })));
    const p = all(`SELECT * FROM person WHERE active=1 ORDER BY last_name, first_name`, [], db);
    setPeople(p);
  }

  // People CRUD minimal
  function addPerson(rec: any) {
    run(
      `INSERT INTO person (last_name, first_name, work_email, brother_sister, commuter, active, avail_mon, avail_tue, avail_wed, avail_thu, avail_fri)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        rec.last_name?.trim()||"",
        rec.first_name?.trim()||"",
        rec.work_email?.trim()||"",
        rec.brother_sister||null,
        rec.commuter?1:0,
        rec.active?1:1,
        rec.avail_mon||'U', rec.avail_tue||'U', rec.avail_wed||'U', rec.avail_thu||'U', rec.avail_fri||'U'
      ]
    );
    refreshCaches();
  }

  function updatePerson(rec:any){
    run(
      `UPDATE person SET last_name=?, first_name=?, work_email=?, brother_sister=?, commuter=?, active=?, avail_mon=?, avail_tue=?, avail_wed=?, avail_thu=?, avail_fri=? WHERE id=?`,
      [rec.last_name, rec.first_name, rec.work_email, rec.brother_sister, rec.commuter?1:0, rec.active?1:0, rec.avail_mon, rec.avail_tue, rec.avail_wed, rec.avail_thu, rec.avail_fri, rec.id]
    );
    refreshCaches();
  }

  function deletePerson(id:number){
    run(`DELETE FROM person WHERE id=?`,[id]);
    refreshCaches();
  }

  // Assignments
  function listAssignmentsForDate(dateMDY: string) {
    const d = parseMDY(dateMDY); const dYMD = ymd(d);
    const rows = all(`SELECT a.id, a.date, a.person_id, a.role_id, a.segment,
                             p.first_name, p.last_name, p.work_email,
                             r.name as role_name, r.code as role_code, r.group_id,
                             g.name as group_name
                      FROM assignment a
                      JOIN person p ON p.id=a.person_id
                      JOIN role r ON r.id=a.role_id
                      JOIN grp g  ON g.id=r.group_id
                      WHERE a.date=?
                      ORDER BY g.name, r.name, p.last_name, p.first_name`, [dYMD]);
    return rows;
  }

  function addAssignment(dateMDY: string, personId: number, roleId: number, segment: Segment) {
    // Weekend guard
    const d = parseMDY(dateMDY);
    if (weekdayName(d) === "Weekend") { alert("Weekends are ignored. Pick a weekday."); return; }

    // Time-off block enforcement
    if (segment !== "Early") {
      const blocked = isSegmentBlockedByTimeOff(personId, d, segment as Exclude<Segment,'Early'>);
      if (blocked) { alert("Time-off overlaps this segment. Blocked."); return; }
    }

    run(`INSERT INTO assignment (date, person_id, role_id, segment) VALUES (?,?,?,?)`, [ymd(d), personId, roleId, segment]);
    refreshCaches();
  }

  function deleteAssignment(id:number){ run(`DELETE FROM assignment WHERE id=?`,[id]); refreshCaches(); }

  function isSegmentBlockedByTimeOff(personId: number, date: Date, segment: Exclude<Segment, "Early">): boolean {
    // For UI adding, any overlap => return true (spec Q34 = Block)
    const intervals = listTimeOffIntervals(personId, date);
    if (intervals.length === 0) return false;
    const segTimes = baseSegmentTimes(date, /*hasLunch*/true, /*hasEarly*/false);
    const window = segment === "AM" ? segTimes.AM : segment === "Lunch" ? segTimes.Lunch : segTimes.PM;
    const start = window.start.getTime();
    const end = window.end.getTime();
    return intervals.some(({start: s, end: e}) => Math.max(s.getTime(), start) < Math.min(e.getTime(), end));
  }

  function listTimeOffIntervals(personId: number, date: Date): Array<{start: Date; end: Date; reason?: string}> {
    const startDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0,0,0,0);
    const endDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23,59,59,999);
    const rows = all(`SELECT start_ts, end_ts, reason FROM timeoff WHERE person_id=?`, [personId]);
    return rows
      .map((r) => ({ start: new Date(r.start_ts), end: new Date(r.end_ts), reason: r.reason }))
      .filter((r) => r.end >= startDay && r.start <= endDay)
      .map((r) => ({ start: r.start < startDay ? startDay : r.start, end: r.end > endDay ? endDay : r.end, reason: r.reason }));
  }

  // Monthly default assignments
  function loadMonthlyDefaults(month: string) {
    if (!sqlDb) return;
    const rows = all(`SELECT * FROM monthly_default WHERE month=?`, [month]);
    setMonthlyDefaults(rows);
  }

  function setMonthlyDefault(personId: number, segment: Segment, roleId: number | null) {
    if (!sqlDb) return;
    if (roleId) {
      run(`INSERT INTO monthly_default (month, person_id, segment, role_id) VALUES (?,?,?,?)
           ON CONFLICT(month, person_id, segment) DO UPDATE SET role_id=excluded.role_id`,
          [selectedMonth, personId, segment, roleId]);
    } else {
      run(`DELETE FROM monthly_default WHERE month=? AND person_id=? AND segment=?`,
          [selectedMonth, personId, segment]);
    }
    loadMonthlyDefaults(selectedMonth);
  }

  function setMonthlyDefaultForMonth(month: string, personId: number, segment: Segment, roleId: number | null) {
    if (!sqlDb) return;
    if (roleId) {
      run(`INSERT INTO monthly_default (month, person_id, segment, role_id) VALUES (?,?,?,?)
           ON CONFLICT(month, person_id, segment) DO UPDATE SET role_id=excluded.role_id`,
          [month, personId, segment, roleId]);
    } else {
      run(`DELETE FROM monthly_default WHERE month=? AND person_id=? AND segment=?`,
          [month, personId, segment]);
    }
  }

  function copyMonthlyDefaults(fromMonth: string, toMonth: string) {
    if (!sqlDb) return;
    const rows = all(`SELECT person_id, segment, role_id FROM monthly_default WHERE month=?`, [fromMonth]);
    for (const row of rows) {
      run(
        `INSERT INTO monthly_default (month, person_id, segment, role_id) VALUES (?,?,?,?)
         ON CONFLICT(month, person_id, segment) DO UPDATE SET role_id=excluded.role_id`,
        [toMonth, row.person_id, row.segment, row.role_id]
      );
    }
    loadMonthlyDefaults(toMonth);
    setStatus(`Copied monthly defaults from ${fromMonth}.`);
  }

  function applyMonthlyDefaults(month: string) {
    if (!sqlDb) return;
    const [y,m] = month.split('-').map(n=>parseInt(n,10));
    const days = new Date(y, m, 0).getDate();
    for (const def of monthlyDefaults) {
      const person = people.find(p=>p.id===def.person_id);
      if (!person) continue;
      for (let day=1; day<=days; day++) {
        const d = new Date(y, m-1, day);
        const wd = weekdayName(d);
        if (wd === 'Weekend') continue;
        const availField = wd === 'Monday'? 'avail_mon' : wd === 'Tuesday'? 'avail_tue' : wd === 'Wednesday'? 'avail_wed' : wd === 'Thursday'? 'avail_thu' : 'avail_fri';
        const avail = person[availField];
        let ok = false;
  if (def.segment === 'Early') ok = avail === 'AM' || avail === 'B';
  else if (def.segment === 'AM') ok = avail === 'AM' || avail === 'B';
        else if (def.segment === 'PM') ok = avail === 'PM' || avail === 'B';
        else if (def.segment === 'Lunch') ok = avail === 'AM' || avail === 'PM' || avail === 'B';
        if (!ok) continue;
  if (def.segment !== 'Early' && isSegmentBlockedByTimeOff(person.id, d, def.segment as Exclude<Segment,'Early'>)) continue;
        run(`INSERT OR REPLACE INTO assignment (date, person_id, role_id, segment) VALUES (?,?,?,?)`,
            [ymd(d), def.person_id, def.role_id, def.segment]);
      }
    }
    refreshCaches();
    setStatus('Applied monthly defaults.');
  }

  // Needs
  function getRequiredFor(date: Date, groupId: number, roleId: number, segment: Segment): number {
    const dY = ymd(date);
    const ov = all(`SELECT required FROM needs_override WHERE date=? AND group_id=? AND role_id=? AND segment=?`, [dY, groupId, roleId, segment]);
    if (ov.length) return ov[0].required;
    const bl = all(`SELECT required FROM needs_baseline WHERE group_id=? AND role_id=? AND segment=?`, [groupId, roleId, segment]);
    return bl.length ? bl[0].required : 0;
  }

  function setRequired(date: Date | null, groupId: number, roleId: number, segment: Segment, required: number) {
    if (date) {
      run(`INSERT INTO needs_override (date, group_id, role_id, segment, required) VALUES (?,?,?,?,?)
           ON CONFLICT(date, group_id, role_id, segment) DO UPDATE SET required=excluded.required`,
          [ ymd(date), groupId, roleId, segment, required ]);
    } else {
      run(`INSERT INTO needs_baseline (group_id, role_id, segment, required) VALUES (?,?,?,?)
           ON CONFLICT(group_id, role_id, segment) DO UPDATE SET required=excluded.required`,
          [ groupId, roleId, segment, required ]);
    }
    refreshCaches();
  }

  // Time-Off Import (from Teams XLSX)
  async function importTimeOffXlsx(file: File) {
    try {
      const XLSX = await loadXLSX();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      // Expected columns: Member, Work Email, Start Date, Start Time, End Date, End Time, Time Off Reason
      // Build case-insensitive email map from current people
      const peopleEmailMap = new Map<string, number>(); // normalized email -> person_id
      for (const p of people) {
        if (p.work_email) peopleEmailMap.set(String(p.work_email).trim().toLowerCase(), p.id);
      }

      // Helper: find email column (support a few variants)
      const headerCandidates = [
        'Work Email','Email','Work Email Address','Primary Email','User Email'
      ];
      const sample = rows[0] || {};
      let emailHeader = headerCandidates.find(h => Object.prototype.hasOwnProperty.call(sample, h));
      if (!emailHeader) emailHeader = 'Work Email'; // fallback

      function parseTime(str:string, defaultHH:number, defaultMM:number){
        const raw = str.trim();
        if (!raw) return { h: defaultHH, m: defaultMM };
        // Accept formats: HH:MM, H:MM, HH:MM AM, HH:MM PM, H AM, HPM
        const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (ampmMatch){
          let h = parseInt(ampmMatch[1],10);
          const m = ampmMatch[2]?parseInt(ampmMatch[2],10):0;
          const ap = ampmMatch[3].toUpperCase();
          if (ap==='PM' && h<12) h+=12; if (ap==='AM' && h===12) h=0;
          return { h, m };
        }
        const simple = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (simple){
          return { h: parseInt(simple[1],10), m: parseInt(simple[2],10) };
        }
        // e.g. 900 or 930
        const compact = raw.match(/^(\d{3,4})$/);
        if (compact){
          const num = compact[1];
          const h = parseInt(num.slice(0, num.length-2),10);
          const m = parseInt(num.slice(-2),10);
          return { h, m };
        }
        return { h: defaultHH, m: defaultMM };
      }

      // Diagnostics collection
      let count = 0, skippedNoEmail = 0, skippedNoMatch = 0;
      const unmatchedEmails = new Set<string>();
      const now = new Date();

      for (const r of rows) {
        const rawEmail = String(r[emailHeader] || '').trim();
        if (!rawEmail) { skippedNoEmail++; continue; }
        const normEmail = rawEmail.toLowerCase();
        const pid = peopleEmailMap.get(normEmail);
        if (!pid) { skippedNoMatch++; unmatchedEmails.add(normEmail); continue; }

        // Date sources: Start Date / End Date (M/D/YYYY). Accept if Excel exported Date objects -> convert via XLSX to string already.
        const sd = String(r['Start Date']||'').trim();
        const ed = String(r['End Date']||sd).trim();
        if (!sd) { // cannot parse without start date
          skippedNoMatch++; continue;
        }
        let startDate: Date, endDate: Date;
        try { startDate = parseMDY(sd); } catch { skippedNoMatch++; continue; }
        try { endDate = parseMDY(ed); } catch { endDate = new Date(startDate.getTime()); }

        const stRaw = String(r['Start Time']||'00:00');
        const etRaw = String(r['End Time']||'23:59');
        const st = parseTime(stRaw, 0, 0);
        const et = parseTime(etRaw, 23, 59);
        startDate.setHours(st.h, st.m, 0, 0);
        endDate.setHours(et.h, et.m, 0, 0);
        if (endDate < startDate) {
          // Guard against inverted times: swap or clamp to same day end
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // default 1h
        }
        // Optional: clamp absurdly long ranges (> 1 year)
        if (endDate.getTime() - startDate.getTime() > 1000*60*60*24*366) {
          endDate = new Date(startDate.getTime() + 1000*60*60*8); // clamp to a work day
        }
        const reason = String(r['Time Off Reason']||'');
        try {
          run(`INSERT INTO timeoff (person_id, start_ts, end_ts, reason) VALUES (?,?,?,?)`, [pid, startDate.toISOString(), endDate.toISOString(), reason]);
          count++;
        } catch (e:any) {
          console.warn('Insert failed for row', r, e);
        }
      }

      // Compose status message with limited unmatched preview
      const unmatchedPreview = Array.from(unmatchedEmails).slice(0, 5).join(', ');
      const extra = unmatchedEmails.size > 5 ? ` (+${unmatchedEmails.size-5} more)` : '';
      const msgParts = [
        `Imported ${count} time-off rows` ,
        `Skipped ${skippedNoEmail} (missing email)`,
        `Skipped ${skippedNoMatch} (no match)`
      ];
      if (unmatchedEmails.size) msgParts.push(`Unmatched examples: ${unmatchedPreview}${extra}`);
      setStatus(msgParts.join('. ') + '.');
      if (count === 0 && unmatchedEmails.size) {
        console.info('Unmatched email set (first 50):', Array.from(unmatchedEmails).slice(0,50));
      }
      if (count === 0) {
        // Guidance hint
        setTimeout(()=>setStatus(s => s + ' Tip: Ensure People records use the same emails (case-insensitive) as the spreadsheet.'), 50);
      }
    } catch (e:any) {
      console.error(e); alert("Time-off import failed: " + (e?.message||e));
    }
  }

  // Export to Shifts XLSX
  async function exportShifts() {
    if (!sqlDb) { alert("Open a DB first"); return; }
    const XLSX = await loadXLSX();
    const start = parseMDY(exportStart);
    const end = parseMDY(exportEnd);
    if (end < start) { alert("End before start"); return; }

    const rows: any[] = [];
    let d = new Date(start.getTime());
    while (d <= end) {
      if (weekdayName(d) !== "Weekend") {
        const dYMD = ymd(d);
        const assigns = all(`SELECT a.id, a.person_id, a.role_id, a.segment,
                                    p.first_name, p.last_name, p.work_email,
                                    r.name as role_name, r.code as role_code, r.group_id,
                                    g.name as group_name
                             FROM assignment a
                             JOIN person p ON p.id=a.person_id
                             JOIN role r ON r.id=a.role_id
                             JOIN grp g  ON g.id=r.group_id
                             WHERE a.date=?`, [dYMD]);

        // Figure Lunch/Early flags per person-day
        const byPerson = new Map<number, { hasLunch: boolean; hasEarly: boolean }>();
        for (const a of assigns) {
          const s: Segment = a.segment;
          const cur = byPerson.get(a.person_id) || { hasLunch: false, hasEarly: false };
          if (s === "Lunch") cur.hasLunch = true;
          if (s === "Early") cur.hasEarly = true;
          byPerson.set(a.person_id, cur);
        }

        for (const a of assigns) {
          const pkey = byPerson.get(a.person_id) || { hasLunch: false, hasEarly: false };
          const times = baseSegmentTimes(d, pkey.hasLunch, pkey.hasEarly);
          let windows: Array<{ start: Date; end: Date; label: string; group: string }>=[];
          if (a.segment === "Early") {
            const et = earlyTimes(d);
            windows = [{ start: et.start, end: et.end, label: a.role_name, group: "Dining Room" /* Breakfast group fixed */ }];
          } else if (a.segment === "AM") {
            windows = [{ start: times.AM.start, end: times.AM.end, label: a.role_name, group: a.group_name }];
          } else if (a.segment === "Lunch") {
            windows = [{ start: times.Lunch.start, end: times.Lunch.end, label: a.role_name, group: a.group_name }];
          } else if (a.segment === "PM") {
            windows = [{ start: times.PM.start, end: times.PM.end, label: a.role_name, group: a.group_name }];
          }

          // Apply time-off partial splitting rule
          const intervals = listTimeOffIntervals(a.person_id, d);
          for (const w of windows) {
            const split = subtractIntervals(w.start, w.end, intervals);
            for (const s of split) rows.push(makeShiftRow(a, d, s.start, s.end));
          }
        }
      }
      d = addMinutes(d, 24*60);
    }

    // Build XLSX
    const header = [
      "Member","Work Email","Group","Start Date","Start Time","End Date","End Time","Theme Color","Custom Label","Unpaid Break (minutes)","Notes","Shared"
    ];
    const aoa = [header, ...rows.map(r => [
      r.member,
      r.workEmail,
      r.group,
      r.startDate,
      r.startTime,
      r.endDate,
      r.endTime,
      r.themeColor,
      r.customLabel,
      r.unpaidBreak,
      r.notes,
      r.shared,
    ])];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shifts");

    const blob = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName: `teams-shifts-export_${exportStart.replaceAll("/","-")}_${exportEnd.replaceAll("/","-")}.xlsx`,
      types: [{ description: "Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
    });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(blob);
    await writable.close();
    setStatus(`Exported ${rows.length} rows.`);
  }

  function subtractIntervals(start: Date, end: Date, offs: Array<{start: Date; end: Date}>): Array<{start: Date; end: Date}> {
    // Returns array of non-overlapping sub-intervals of [start,end) with offs removed
    let segments = [{ start, end }];
    for (const off of offs) {
      const next: typeof segments = [];
      for (const s of segments) {
        if (off.end <= s.start || off.start >= s.end) { next.push(s); continue; }
        // overlap exists
        if (off.start > s.start) next.push({ start: s.start, end: new Date(Math.min(off.start.getTime(), s.end.getTime())) });
        if (off.end < s.end) next.push({ start: new Date(Math.max(off.end.getTime(), s.start.getTime())), end: s.end });
      }
      segments = next.filter(x => x.end > x.start);
    }
    return segments.filter(x => x.end > x.start);
  }

  function makeShiftRow(a: any, date: Date, start: Date, end: Date) {
    const member = `${a.last_name}, ${a.first_name}`; // Last, First
    const workEmail = a.work_email;
    // Group logic: Breakfast forces Dining Room, otherwise from role
    const group = (a.segment === "Early") ? "Dining Room" : a.group_name;
    const themeColor = GROUPS[group]?.theme || "";
    const customLabel = a.role_name; // per user: Plain Name
    const unpaidBreak = 0; // per user
    const notes = ""; // per user
    const shared = "2. Not Shared"; // per user

    return {
      member,
      workEmail,
      group,
      startDate: fmtDateMDY(start),
      startTime: fmtTime24(start),
      endDate: fmtDateMDY(end),
      endTime: fmtTime24(end),
      themeColor,
      customLabel,
      unpaidBreak,
      notes,
      shared,
    };
  }

  // === Diagnostics (Self-tests) ===
  function runDiagnostics(){
    const details: string[] = [];
    let passed = 0, failed = 0;
    function assert(cond:boolean, msg:string){ if(cond){ passed++; details.push(`✅ ${msg}`);} else { failed++; details.push(`❌ ${msg}`);} }

    // Test 1: base times (no lunch, no early)
    const d1 = new Date(2025,0,6); // Mon
    const t1 = baseSegmentTimes(d1,false,false);
    assert(t1.AM.start.getHours()===8 && t1.AM.end.getHours()===12, "AM 08:00–12:00 without Lunch");
    assert(t1.PM.start.getHours()===13 && t1.PM.end.getHours()===17, "PM 13:00–17:00 without Lunch");

    // Test 2: with Lunch
    const t2 = baseSegmentTimes(d1,true,false);
    assert(t2.AM.end.getHours()===11 && t2.Lunch.end.getHours()===13, "Lunch day AM=11:00 end, Lunch ends 13:00");
    assert(t2.PM.start.getHours()===14 && t2.PM.end.getHours()===17, "Lunch day PM 14:00–17:00");

    // Test 3: Lunch + Early shortens PM to 16:00
    const t3 = baseSegmentTimes(d1,true,true);
    assert(t3.PM.end.getHours()===16, "Early+Lunch → PM ends 16:00");

    // Test 4: subtractIntervals simple split
    const s = new Date(2025,0,6,8,0); const e = new Date(2025,0,6,12,0);
    const off1s = new Date(2025,0,6,9,30); const off1e = new Date(2025,0,6,10,30);
    const split = subtractIntervals(s,e,[{start:off1s,end:off1e}]);
    assert(split.length===2, "Subtract creates two segments when TO splits the window");
    assert(split[0].end.getHours()===9 && split[0].end.getMinutes()===30, "First segment ends at 09:30");
    assert(split[1].start.getHours()===10 && split[1].start.getMinutes()===30, "Second segment starts at 10:30");

    // Test 5: Early times
    const et = earlyTimes(d1);
    assert(et.start.getHours()===6 && et.start.getMinutes()===20 && et.end.getHours()===7 && et.end.getMinutes()===20, "Early 06:20–07:20");

    setDiag({passed,failed,details});
  }

  // UI helpers
  const canEdit = !!sqlDb && !!lockedBy && lockedBy !== "(read-only)";
  const selectedDateObj = useMemo(()=>parseMDY(selectedDate),[selectedDate]);

  function peopleOptionsForSegment(date: Date, segment: Segment, role: any) {
    // Active people only
    const wd = weekdayName(date);
    const availField = wd === 'Monday' ? 'avail_mon' : wd === 'Tuesday' ? 'avail_tue' : wd === 'Wednesday' ? 'avail_wed' : wd === 'Thursday' ? 'avail_thu' : 'avail_fri';
    const rows = all(`SELECT * FROM person WHERE active=1 ORDER BY last_name, first_name`);

    return rows.map((p: any) => {
      const avail = p[availField] as 'U'|'AM'|'PM'|'B';
      let warn = '';

      if (segment === 'Early') {
        // Treat Early like needing AM availability or Both
        if (!(avail === 'AM' || avail === 'B')) warn = '(Availability warning)';
      } else if ((segment === 'AM' && !(avail === 'AM' || avail === 'B')) ||
                 (segment === 'PM' && !(avail === 'PM' || avail === 'B')) ||
                 (segment === 'Lunch' && !(avail === 'AM' || avail === 'PM' || avail === 'B'))) {
        warn = '(Availability warning)';
      }

      // Training status warning (only if role actually covers this segment)
      const tr = all(`SELECT status FROM training WHERE person_id=? AND role_id=?`, [p.id, role.id])[0];
      if (!warn && tr && tr.status !== 'Qualified') {
        warn = tr.status === 'In training' ? '(In training)' : '(Not trained)';
      }

      // Time-off block detection
      let blocked = false;
      if (segment === 'Early') {
        const intervals = listTimeOffIntervals(p.id, date);
        if (intervals.length) {
          const et = earlyTimes(date);
          const es = et.start.getTime(); const ee = et.end.getTime();
          blocked = intervals.some(iv => Math.max(iv.start.getTime(), es) < Math.min(iv.end.getTime(), ee));
        }
      } else {
        blocked = isSegmentBlockedByTimeOff(p.id, date, segment as Exclude<Segment,'Early'>);
      }

      return { id: p.id, label: `${p.last_name}, ${p.first_name} ${warn}`.trim(), blocked };
    });
  }

  function roleListForSegment(segment: Segment) {
    return roles.filter((r) => (r.segments as Segment[]).includes(segment));
  }

  function assignmentsByGroupRole(dateMDY: string, segment: Segment) {
    const arr = listAssignmentsForDate(dateMDY).filter((a) => a.segment === segment);
    const map: Record<string, { role: any; group: any; items: any[] }> = {};
    for (const a of arr) {
      const key = `${a.group_name}__${a.role_name}`;
      if (!map[key]) map[key] = { role: { id: a.role_id, name: a.role_name }, group: { id: a.group_id, name: a.group_name }, items: [] };
      map[key].items.push(a);
    }
    return map;
  }

  function countAssigned(dateMDY: string, groupId: number, roleId: number, segment: Segment) {
    const dYMD = ymd(parseMDY(dateMDY));
    const rows = all(`SELECT COUNT(*) as c FROM assignment WHERE date=? AND segment=? AND role_id=?`, [dYMD, segment, roleId]);
    return rows[0]?.c || 0;
  }

  function RequiredCell({date, group, role, segment}:{date:Date|null; group:any; role:any; segment:Segment}){
    const req = date ? getRequiredFor(date, group.id, role.id, segment) : (all(`SELECT required FROM needs_baseline WHERE group_id=? AND role_id=? AND segment=?`, [group.id, role.id, segment])[0]?.required||0);
    const [val,setVal] = useState<number>(req);
    useEffect(()=>setVal(req),[req]);
    return (
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          className="flex-1 min-w-0 border rounded px-2 py-1 text-sm" 
          value={val} 
          min={0} 
          onChange={(e)=>setVal(parseInt(e.target.value||'0',10))} 
        />
        <button 
          className="px-2 py-1 bg-blue-600 text-white rounded text-sm whitespace-nowrap hover:bg-blue-700" 
          onClick={()=>setRequired(date, group.id, role.id, segment, val)}
        >
          Save
        </button>
      </div>
    );
  }

  // UI components
  function Toolbar(){
    return (
      <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-white sticky top-0 z-20">
        <div className="flex flex-wrap items-center gap-2">
          <button className="px-3 py-2 bg-slate-900 text-white rounded text-sm" onClick={createNewDb} disabled={!ready}>New DB</button>
          <button className="px-3 py-2 bg-slate-800 text-white rounded text-sm" onClick={openDbFromFile} disabled={!ready}>Open DB</button>
          <button className="px-3 py-2 bg-emerald-700 text-white rounded text-sm" onClick={saveDb} disabled={!sqlDb}>Save</button>
          <button className="px-3 py-2 bg-emerald-800 text-white rounded text-sm" onClick={saveDbAs} disabled={!sqlDb}>Save As</button>
        </div>
        <div className="mx-2 text-sm text-slate-600 flex-1 min-w-0 truncate">{status}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={`px-3 py-2 rounded text-sm ${activeTab==='RUN'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('RUN')}>Daily Run</button>
          <button className={`px-3 py-2 rounded text-sm ${activeTab==='PEOPLE'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('PEOPLE')}>People</button>
          <button className={`px-3 py-2 rounded text-sm ${activeTab==='NEEDS'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('NEEDS')}>Needs vs Coverage</button>
          <button className={`px-3 py-2 rounded text-sm ${activeTab==='EXPORT'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('EXPORT')}>Export Preview</button>
          <button className={`px-3 py-2 rounded text-sm ${activeTab==='MONTHLY'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('MONTHLY')}>Monthly Defaults</button>
          <button className={`px-3 py-2 rounded text-sm ${activeTab==='HISTORY'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('HISTORY')}>Crew History</button>
          <button className="px-3 py-2 rounded bg-slate-200 text-sm" onClick={runDiagnostics}>Run Diagnostics</button>
        </div>
      </div>
    );
  }

  function DailyRunBoard(){
    const seg: Segment = activeRunSegment;
    const [layout, setLayout] = useState<any[]>([]);
    const [layoutLoaded, setLayoutLoaded] = useState(false);

    useEffect(() => {
      setLayoutLoaded(false);
      const key = `layout:${seg}:${lockEmail || 'default'}`;
      let saved: any[] = [];
      try {
        const rows = all(`SELECT value FROM meta WHERE key=?`, [key]);
        if (rows[0] && rows[0].value) saved = JSON.parse(String(rows[0].value));
      } catch {}
      const byId = new Map(saved.map((l:any)=>[l.i, l]));
      const merged = groups.map((g:any, idx:number) => {
        const roleCount = roleListForSegment(seg).filter((r)=>r.group_id===g.id).length;
        const h = Math.max(2, roleCount + 1);
        return byId.get(String(g.id)) || { i:String(g.id), x:(idx%4)*3, y:Math.floor(idx/4)*h, w:3, h };
      });
      setLayout(merged);
      setLayoutLoaded(true);
    }, [groups, lockEmail, seg]);

    function handleLayoutChange(l:any[]){
      setLayout(l);
      if (!layoutLoaded) return;
      const key = `layout:${seg}:${lockEmail || 'default'}`;
      try {
        const stmt = sqlDb.prepare(`INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)`);
        stmt.bind([key, JSON.stringify(l)]);
        stmt.step();
        stmt.free();
      } catch {}
    }

    return (
      <div className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm whitespace-nowrap">Date</label>
            <input
              type="date"
              className="border rounded px-2 py-1 min-w-0"
              value={ymd(selectedDateObj)}
              onChange={(e)=>{
                const v = e.target.value;
                if (v) setSelectedDate(fmtDateMDY(parseYMD(v)));
              }}
            />
          </div>
          <div className="flex gap-2">
            {(["Early","AM","Lunch","PM"] as const).map(s => (
              <button key={s} className={`px-3 py-1 rounded text-sm ${activeRunSegment===s?'bg-indigo-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveRunSegment(s)}>{s}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button className="px-3 py-2 bg-slate-200 rounded text-sm" onClick={()=>setShowBaselineEditor(true)}>Edit Baseline Needs</button>
          </div>
        </div>

        <Grid
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={80}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
        >
          {groups.map((g:any)=> (
            <div key={String(g.id)} className="border rounded-lg bg-white shadow-sm flex flex-col h-full">
              <div className="font-semibold flex items-center justify-between mb-2 drag-handle px-3 pt-3">
                <span>{g.name}</span>
                <span className="text-xs text-slate-500">Theme: {g.theme_color||'-'}</span>
              </div>
              <div className="flex-1 flex flex-col gap-3 px-3 pb-3 overflow-auto">
                {roleListForSegment(seg).filter((r)=>r.group_id===g.id).map((r:any)=> (
                  <RoleCard key={r.id} group={g} role={r} segment={seg} dateMDY={selectedDate} />
                ))}
              </div>
            </div>
          ))}
        </Grid>

        {diag && (
          <div className="mt-6 border rounded bg-white p-3">
            <div className="font-semibold mb-2">Diagnostics</div>
            <div className="text-sm mb-2">Passed: {diag.passed} | Failed: {diag.failed}</div>
            <ul className="text-sm list-disc ml-5 space-y-1">
              {diag.details.map((d,i)=>(<li key={i}>{d}</li>))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function RoleCard({group, role, segment, dateMDY}:{group:any; role:any; segment:Segment; dateMDY:string}){
    const assigns = all(`SELECT a.id, p.first_name, p.last_name, p.id as person_id FROM assignment a JOIN person p ON p.id=a.person_id WHERE a.date=? AND a.role_id=? AND a.segment=? ORDER BY p.last_name,p.first_name`, [ymd(parseMDY(dateMDY)), role.id, segment]);
    const opts = peopleOptionsForSegment(parseMDY(dateMDY), segment, role);

    const req = getRequiredFor(parseMDY(dateMDY), group.id, role.id, segment);
    const assignedCount = assigns.length;
    const statusColor = assignedCount < req ? 'bg-red-100 text-red-800' : assignedCount === req ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';

    return (
      <div className="border rounded p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">{role.name}</div>
          <div className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>{assignedCount}/{req}</div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 mb-2">
            <select className="border rounded w-full px-2 py-1" defaultValue="" onChange={(e)=>{
              const pid = Number(e.target.value);
              if (!pid) return;
              const sel = opts.find(o=>o.id===pid);
              if (sel?.blocked) { alert("Blocked by time-off for this segment."); return; }
              addAssignment(dateMDY, pid, role.id, segment);
              (e.target as HTMLSelectElement).value = "";
            }}>
              <option value="">+ Add person…</option>
              {opts.map(o => (
                <option key={o.id} value={o.id} disabled={o.blocked}>{o.label}{o.blocked?" (Time-off)":""}</option>
              ))}
            </select>
          </div>
        )}
        <ul className="space-y-1">
          {assigns.map((a:any)=> (
            <li key={a.id} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
              <span>{a.last_name}, {a.first_name}</span>
              {canEdit && (
                <button className="text-red-600 text-sm" onClick={()=>deleteAssignment(a.id)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  } 

  function MonthlyView(){
    const [sortKey, setSortKey] = useState<
      'name' | 'email' | 'brother_sister' | 'commuter' | 'active' |
      'avail_mon' | 'avail_tue' | 'avail_wed' | 'avail_thu' | 'avail_fri' |
      'Early' | 'AM' | 'Lunch' | 'PM'
    >('name');
    const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
    const [filterText, setFilterText] = useState('');

    const viewPeople = useMemo(()=>{
      const low = filterText.toLowerCase();
      const filtered = people.filter((p:any)=>{
  const roleNames = ['Early','AM','Lunch','PM'].map(seg=>{
          const def = monthlyDefaults.find(d=>d.person_id===p.id && d.segment===seg);
          const role = roles.find(r=>r.id===def?.role_id);
          return role?.name || '';
        });
        const text = [
          p.last_name,
          p.first_name,
          p.work_email,
          p.brother_sister || '',
          p.commuter ? 'commuter' : '',
          p.active ? 'active' : '',
          p.avail_mon,
          p.avail_tue,
          p.avail_wed,
          p.avail_thu,
          p.avail_fri,
          ...roleNames,
        ].join(' ').toLowerCase();
        return text.includes(low);
      });

      const sorted = filtered.slice().sort((a:any,b:any)=>{
        const field = sortKey;
        let av:any; let bv:any;
        switch(field){
          case 'name':
            av = `${a.last_name}, ${a.first_name}`;
            bv = `${b.last_name}, ${b.first_name}`;
            break;
          case 'email':
            av = a.work_email; bv = b.work_email; break;
          case 'brother_sister':
            av = a.brother_sister || '';
            bv = b.brother_sister || '';
            break;
          case 'commuter':
            av = a.commuter?1:0; bv = b.commuter?1:0; break;
          case 'active':
            av = a.active?1:0; bv = b.active?1:0; break;
          case 'avail_mon': av = a.avail_mon; bv = b.avail_mon; break;
          case 'avail_tue': av = a.avail_tue; bv = b.avail_tue; break;
          case 'avail_wed': av = a.avail_wed; bv = b.avail_wed; break;
          case 'avail_thu': av = a.avail_thu; bv = b.avail_thu; break;
          case 'avail_fri': av = a.avail_fri; bv = b.avail_fri; break;
          case 'Early':
          case 'AM':
          case 'Lunch':
          case 'PM':
            const defA = monthlyDefaults.find(d=>d.person_id===a.id && d.segment===field);
            const defB = monthlyDefaults.find(d=>d.person_id===b.id && d.segment===field);
            const roleA = roles.find(r=>r.id===defA?.role_id)?.name || '';
            const roleB = roles.find(r=>r.id===defB?.role_id)?.name || '';
            av = roleA; bv = roleB; break;
          default:
            av = ''; bv = ''; break;
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
    }, [people, monthlyDefaults, roles, filterText, sortKey, sortDir]);

    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm">Month</label>
          <input type="month" className="border rounded px-2 py-1" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)} />
          <button className="px-3 py-1 bg-slate-200 rounded text-sm" onClick={()=>applyMonthlyDefaults(selectedMonth)}>Apply to Month</button>
          <button
            className="px-3 py-1 bg-slate-200 rounded text-sm"
            onClick={() => {
              const src = prompt('Copy defaults from which month? (YYYY-MM)');
              if (src) copyMonthlyDefaults(src, selectedMonth);
            }}
          >
            Copy From Month
          </button>
          <button className="px-3 py-1 bg-slate-200 rounded text-sm" onClick={()=>setMonthlyEditing(!monthlyEditing)}>{monthlyEditing ? 'Done' : 'Edit'}</button>
          <input type="text" className="border rounded px-2 py-1" placeholder="Filter" value={filterText} onChange={(e)=>setFilterText(e.target.value)} />
          <select className="border rounded px-2 py-1" value={sortKey} onChange={(e)=>setSortKey(e.target.value as any)}>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="brother_sister">B/S</option>
            <option value="commuter">Commute</option>
            <option value="active">Active</option>
            <option value="avail_mon">Mon</option>
            <option value="avail_tue">Tue</option>
            <option value="avail_wed">Wed</option>
            <option value="avail_thu">Thu</option>
            <option value="avail_fri">Fri</option>
            <option value="Early">Early Role</option>
            <option value="AM">AM Role</option>
            <option value="Lunch">Lunch Role</option>
            <option value="PM">PM Role</option>
          </select>
          <button className="px-2 py-1 bg-slate-200 rounded text-sm" onClick={()=>setSortDir(sortDir==='asc'?'desc':'asc')}>{sortDir==='asc'?'Asc':'Desc'}</button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Name</th>
                {(['Early','AM','Lunch','PM'] as const).map(seg=> (
                  <th key={seg} className="p-2 text-left">{seg}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viewPeople.map((p:any) => (
                <tr key={p.id} className="odd:bg-white even:bg-slate-50">
                  <td className="p-2">{p.last_name}, {p.first_name}</td>
                  {(['Early','AM','Lunch','PM'] as const).map(seg => {
                    const def = monthlyDefaults.find(d=>d.person_id===p.id && d.segment===seg);
                    return (
                      <td key={seg} className="p-2">
                        <select className="border rounded px-2 py-1 w-full" value={def?.role_id||""} disabled={!monthlyEditing} onChange={(e)=>{
                          const rid = Number(e.target.value);
                          setMonthlyDefault(p.id, seg, rid||null);
                        }}>
                          <option value="">--</option>
                          {roleListForSegment(seg).map((r:any)=>(<option key={r.id} value={r.id}>{r.name}</option>))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function CrewHistoryView(){
    const [defs, setDefs] = useState<any[]>([]);
    const [filter, setFilter] = useState("");
  const [showSeg, setShowSeg] = useState({ Early: true, AM: true, Lunch: true, PM: true });
    const [activeOnly, setActiveOnly] = useState(false);
    const [commuterOnly, setCommuterOnly] = useState(false);
    const [sortField, setSortField] = useState<'last'|'first'>('last');
    const [months, setMonths] = useState<string[]>([]);
    const [newMonth, setNewMonth] = useState<string>("");
    const [editPast, setEditPast] = useState(false);

    useEffect(() => {
      if (sqlDb) {
        setDefs(all(`SELECT * FROM monthly_default`));
      }
    }, [sqlDb, monthlyDefaults]);

    useEffect(() => {
      setMonths(prev => {
        const ms = new Set(prev);
        defs.forEach((d:any) => ms.add(d.month));
        const now = new Date();
        const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nmStr = `${nm.getFullYear()}-${pad2(nm.getMonth() + 1)}`;
        ms.add(nmStr);
        return Array.from(ms).sort();
      });
    }, [defs]);

    const nextMonth = useMemo(() => {
      const now = new Date();
      const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return `${nm.getFullYear()}-${pad2(nm.getMonth() + 1)}`;
    }, []);

    const filteredPeople = useMemo(() => {
      const f = filter.toLowerCase();
      return people
        .filter((p:any) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(f))
        .filter((p:any) => !activeOnly || p.active)
        .filter((p:any) => !commuterOnly || p.commuter)
        .sort((a:any,b:any)=>sortField==='last' ? a.last_name.localeCompare(b.last_name) : a.first_name.localeCompare(b.first_name));
    }, [people, filter, activeOnly, commuterOnly, sortField]);

  const segs = ([] as Segment[]);
  if (showSeg.Early) segs.push('Early');
  if (showSeg.AM) segs.push('AM');
  if (showSeg.Lunch) segs.push('Lunch');
  if (showSeg.PM) segs.push('PM');

  function RoleSelect({ month, personId, seg, def }: { month: string; personId: number; seg: Segment; def: any }){
      const ref = useRef<HTMLSelectElement>(null);
      const options = roleListForSegment(seg);

      function showNames(){
        const sel = ref.current; if(!sel) return;
        Array.from(sel.options).forEach(o => {
          const r = options.find((rr:any)=>rr.id===Number(o.value));
          if(r) o.text = r.name;
        });
      }

      function showCode(){
        const sel = ref.current; if(!sel) return;
        const opt = Array.from(sel.options).find(o=>Number(o.value)===Number(sel.value));
        if(opt){
          const r = options.find((rr:any)=>rr.id===Number(opt.value));
          if(r) opt.text = r.code;
        }
      }

      useEffect(()=>{ showCode(); }, [def?.role_id, options]);

      return (
        <select
          ref={ref}
          className="border rounded px-2 py-1 w-full"
          value={def?.role_id||""}
          onFocus={showNames}
          onBlur={showCode}
          onChange={(e)=>{
            const rid = Number(e.target.value);
            setMonthlyDefaultForMonth(month, personId, seg, rid||null);
            setDefs(all(`SELECT * FROM monthly_default`));
            showCode();
          }}
        >
          <option value=""></option>
          {options.map((r:any)=>(<option key={r.id} value={r.id}>{r.name}</option>))}
        </select>
      );
    }

  function cellData(month:string, personId:number, seg:Segment){
      const def = defs.find((d:any)=>d.month===month && d.person_id===personId && d.segment===seg);
      const role = roles.find((r:any)=>r.id===def?.role_id);
      const color = role ? GROUPS[role.group_name]?.color : undefined;
      if (month === nextMonth || editPast) {
        return { content: <RoleSelect month={month} personId={personId} seg={seg} def={def} />, color };
      }
      return { content: role?.code || "", color };
    }

    return (
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            className="border rounded px-2 py-1"
            placeholder="Filter people..."
            value={filter}
            onChange={(e)=>setFilter(e.target.value)}
          />
          <select className="border rounded px-2 py-1 text-sm" value={sortField} onChange={(e)=>setSortField(e.target.value as 'last'|'first')}>
            <option value="last">Last Name</option>
            <option value="first">First Name</option>
          </select>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={activeOnly} onChange={(e)=>setActiveOnly(e.target.checked)} /> Active
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={commuterOnly} onChange={(e)=>setCommuterOnly(e.target.checked)} /> Commuter
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={showSeg.Early} onChange={(e)=>setShowSeg({...showSeg, Early:e.target.checked})} /> Early
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={showSeg.AM} onChange={(e)=>setShowSeg({...showSeg, AM:e.target.checked})} /> AM
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={showSeg.Lunch} onChange={(e)=>setShowSeg({...showSeg, Lunch:e.target.checked})} /> Lunch
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={showSeg.PM} onChange={(e)=>setShowSeg({...showSeg, PM:e.target.checked})} /> PM
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={editPast} onChange={(e)=>setEditPast(e.target.checked)} /> Edit past months
          </label>
          <div className="flex items-center gap-1">
            <input
              type="month"
              className="border rounded px-2 py-1 text-sm"
              value={newMonth}
              onChange={(e)=>setNewMonth(e.target.value)}
            />
            <button
              className="px-2 py-1 bg-slate-200 rounded text-sm"
              onClick={()=>{
                if(newMonth){
                  setMonths(prev=>Array.from(new Set([...prev, newMonth])).sort());
                  setNewMonth("");
                }
              }}
            >Add Month</button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Segment</th>
                {months.map(m => (
                  <th key={m} className="p-2 text-left">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPeople.map(p => {
                const segList = segs;
                return (
                  <React.Fragment key={p.id}>
                    {segList.map((seg, idx) => (
                      <tr key={`${p.id}-${seg}`} className="odd:bg-white even:bg-slate-50">
                        {idx === 0 && (
                          <td className="p-2" rowSpan={segList.length}>{p.last_name}, {p.first_name}</td>
                        )}
                        <td className="p-2">{seg}</td>
                        {months.map(m => {
                          const { content, color } = cellData(m, p.id, seg);
                          return (
                            <td key={m} className="p-2" style={{ backgroundColor: color }}>
                              {content}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function NeedsView(){
    const d = selectedDateObj;
    const ORDER: Segment[] = ['Early','AM','Lunch','PM'];
    return (
      <div className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <label className="whitespace-nowrap">Date</label>
          <input
            type="date"
            className="border rounded px-2 py-1 min-w-0"
            value={ymd(selectedDateObj)}
            onChange={(e)=>{
              const v = e.target.value;
              if (v) setSelectedDate(fmtDateMDY(parseYMD(v)));
            }}
          />
          <span className="text-slate-500 text-sm">Edit overrides for this date. Baseline editor is in Daily Run toolbar.</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g:any)=> (
            <div key={g.id} className="border rounded-lg p-3 bg-white shadow-sm">
              <div className="font-semibold mb-3">{g.name}</div>
              {roles.filter((r)=>r.group_id===g.id).map((r:any)=> {
                const segs: Segment[] = ORDER.filter(s => (r.segments as Segment[]).includes(s));
                return (
                  <div key={r.id} className="mb-4 border rounded p-3">
                    <div className="font-medium mb-3">{r.name}</div>
                    <div className="grid gap-3" style={{gridTemplateColumns:`repeat(${segs.length},minmax(0,1fr))`}}>
                      {segs.map(s => (
                        <div key={s}>
                          <div className="text-xs text-slate-500 mb-1">{s} Required</div>
                          <RequiredCell date={d} group={g} role={r} segment={s} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function ExportView(){
    // Generate preview rows same as actual export
    const previewRows = useMemo(()=>{
      if (!sqlDb) return [] as any[];
      const start = parseMDY(exportStart); const end = parseMDY(exportEnd);
      if (end < start) return [] as any[];
      const rows: any[] = [];
      let d = new Date(start.getTime());
      while (d <= end) {
        if (weekdayName(d) !== "Weekend") {
          const dYMD = ymd(d);
          const assigns = all(`SELECT a.id, a.person_id, a.role_id, a.segment,
                                      p.first_name, p.last_name, p.work_email,
                                      r.name as role_name, r.code as role_code, r.group_id,
                                      g.name as group_name
                               FROM assignment a
                               JOIN person p ON p.id=a.person_id
                               JOIN role r ON r.id=a.role_id
                               JOIN grp g  ON g.id=r.group_id
                               WHERE a.date=?`, [dYMD]);

          const byPerson = new Map<number, { hasLunch: boolean; hasEarly: boolean }>();
          for (const a of assigns) {
            const s: Segment = a.segment;
            const cur = byPerson.get(a.person_id) || { hasLunch: false, hasEarly: false };
            if (s === "Lunch") cur.hasLunch = true;
            if (s === "Early") cur.hasEarly = true;
            byPerson.set(a.person_id, cur);
          }

          for (const a of assigns) {
            const pkey = byPerson.get(a.person_id) || { hasLunch: false, hasEarly: false };
            const times = baseSegmentTimes(d, pkey.hasLunch, pkey.hasEarly);
            let windows: Array<{ start: Date; end: Date }>=[];
            let group = a.group_name;
            if (a.segment === "Early") { const et = earlyTimes(d); windows = [{ start: et.start, end: et.end }]; group = "Dining Room"; }
            else if (a.segment === "AM") windows = [{ start: times.AM.start, end: times.AM.end }];
            else if (a.segment === "Lunch") windows = [{ start: times.Lunch.start, end: times.Lunch.end }];
            else if (a.segment === "PM") windows = [{ start: times.PM.start, end: times.PM.end }];

            const intervals = listTimeOffIntervals(a.person_id, d);
            for (const w of windows) {
              const split = subtractIntervals(w.start, w.end, intervals);
              for (const s of split) {
                rows.push({
                  date: fmtDateMDY(d),
                  member: `${a.last_name}, ${a.first_name}`,
                  email: a.work_email,
                  group,
                  start: fmtTime24(s.start),
                  end: fmtTime24(s.end),
                  label: a.role_name,
                  color: GROUPS[group]?.theme || "",
                });
              }
            }
          }
        }
        d = addMinutes(d, 24*60);
      }
      return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sqlDb, exportStart, exportEnd, people.length, roles.length]);

    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <label>Start</label>
          <input type="text" className="border rounded px-2 py-1" value={exportStart} onChange={(e)=>setExportStart(e.target.value)} placeholder="M/D/YYYY" />
          <label>End</label>
          <input type="text" className="border rounded px-2 py-1" value={exportEnd} onChange={(e)=>setExportEnd(e.target.value)} placeholder="M/D/YYYY" />
          <button className="ml-auto px-3 py-2 bg-emerald-700 text-white rounded" onClick={exportShifts}>Download XLSX</button>
          <label className="ml-4 px-3 py-2 bg-slate-200 rounded cursor-pointer">
            Import Time-Off XLSX
            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e)=>{
              const f = e.target.files?.[0]; if (f) importTimeOffXlsx(f);
              e.currentTarget.value = "";
            }} />
          </label>
        </div>
        <div className="overflow-auto max-h-[60vh] border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Member</th>
                <th className="p-2 text-left">Work Email</th>
                <th className="p-2 text-left">Group</th>
                <th className="p-2 text-left">Start</th>
                <th className="p-2 text-left">End</th>
                <th className="p-2 text-left">Custom Label</th>
                <th className="p-2 text-left">Theme</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r,i)=> (
                <tr key={i} className="odd:bg-white even:bg-slate-50">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{r.member}</td>
                  <td className="p-2">{r.email}</td>
                  <td className="p-2">{r.group}</td>
                  <td className="p-2">{r.start}</td>
                  <td className="p-2">{r.end}</td>
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">{r.color}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-slate-500 text-sm mt-2">Rows: {previewRows.length}</div>
      </div>
    );
  }

  function PeopleEditor(){
    const [form,setForm] = useState<any>({ active:true, commuter:false, brother_sister:'Brother', avail_mon:'U', avail_tue:'U', avail_wed:'U', avail_thu:'U', avail_fri:'U' });
    const [editing,setEditing] = useState<any|null>(null);
    return (
      <div className="p-4">
        <div className="w-full">
          <div className="font-semibold text-lg mb-3">People</div>

          <div className="grid grid-cols-12 gap-2 mb-3">
            <input className="border rounded px-2 py-1 col-span-3" placeholder="Last Name" value={form.last_name||''} onChange={e=>setForm({...form,last_name:e.target.value})} />
            <input className="border rounded px-2 py-1 col-span-3" placeholder="First Name" value={form.first_name||''} onChange={e=>setForm({...form,first_name:e.target.value})} />
            <input className="border rounded px-2 py-1 col-span-4" placeholder="Work Email" value={form.work_email||''} onChange={e=>setForm({...form,work_email:e.target.value})} />
            <select className="border rounded px-2 py-1 col-span-2" value={form.brother_sister||'Brother'} onChange={e=>setForm({...form,brother_sister:e.target.value})}>
              <option>Brother</option>
              <option>Sister</option>
            </select>
            <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={!!form.commuter} onChange={e=>setForm({...form,commuter:e.target.checked})}/> Commuter</label>
            <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.active!==false} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
            {WEEKDAYS.map((w,idx)=> (
              <div key={w} className="col-span-2">
                <div className="text-xs text-slate-500">{w} Availability</div>
                <select className="border rounded px-2 py-1 w-full" value={form[["avail_mon","avail_tue","avail_wed","avail_thu","avail_fri"][idx]]||'U'} onChange={(e)=>{
                  const key = ["avail_mon","avail_tue","avail_wed","avail_thu","avail_fri"][idx];
                  setForm({...form,[key]:e.target.value});
                }}>
                  <option value="U">Unavailable</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                  <option value="B">Both</option>
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            {editing ? (
              <button className="px-3 py-2 bg-blue-700 text-white rounded" onClick={()=>{ updatePerson({...editing, ...form}); setForm({ active:true, commuter:false, brother_sister:'Brother', avail_mon:'U', avail_tue:'U', avail_wed:'U', avail_thu:'U', avail_fri:'U' }); setEditing(null); }}>Save Changes</button>
            ) : (
              <button className="px-3 py-2 bg-emerald-700 text-white rounded" onClick={()=>{ addPerson(form); setForm({ active:true, commuter:false, brother_sister:'Brother', avail_mon:'U', avail_tue:'U', avail_wed:'U', avail_thu:'U', avail_fri:'U' }); }}>Add Person</button>
            )}
          </div>

          <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
            <table className="min-w-full text-sm divide-y divide-slate-200">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left font-medium text-slate-600">Name</th>
                  <th className="p-2 text-left font-medium text-slate-600">Email</th>
                  <th className="p-2 text-left font-medium text-slate-600">B/S</th>
                  <th className="p-2 text-left font-medium text-slate-600">Commute</th>
                  <th className="p-2 text-left font-medium text-slate-600">Active</th>
                  <th className="p-2 text-left font-medium text-slate-600">Mon</th>
                  <th className="p-2 text-left font-medium text-slate-600">Tue</th>
                  <th className="p-2 text-left font-medium text-slate-600">Wed</th>
                  <th className="p-2 text-left font-medium text-slate-600">Thu</th>
                  <th className="p-2 text-left font-medium text-slate-600">Fri</th>
                  <th className="p-2 text-left font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {people.map(p => (
                  <tr key={p.id} className="odd:bg-white even:bg-slate-50 hover:bg-slate-100">
                    <td className="p-2">{p.last_name}, {p.first_name}</td>
                    <td className="p-2">{p.work_email}</td>
                    <td className="p-2">{p.brother_sister||'-'}</td>
                    <td className="p-2">{p.commuter?"Yes":"No"}</td>
                    <td className="p-2">{p.active?"Yes":"No"}</td>
                    <td className="p-2">{p.avail_mon}</td>
                    <td className="p-2">{p.avail_tue}</td>
                    <td className="p-2">{p.avail_wed}</td>
                    <td className="p-2">{p.avail_thu}</td>
                    <td className="p-2">{p.avail_fri}</td>
                    <td className="p-2 flex gap-2">
                      <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded" onClick={()=>{ setEditing(p); setForm(p); }}>Edit</button>
                      <button className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded" onClick={()=>{ if(confirm('Delete?')) deletePerson(p.id); }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function BaselineEditor(){
    const ORDER: Segment[] = ['Early','AM','Lunch','PM'];
    return (
      <div className="fixed inset-0 bg-black/40 z-30 overflow-auto">
        <div className="min-h-full flex items-start justify-center p-4">
          <div className="bg-white w-full max-w-6xl max-h-[85vh] overflow-auto rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-lg">Baseline Needs</div>
              <button className="text-slate-600 hover:text-slate-800 px-2 py-1" onClick={()=>setShowBaselineEditor(false)}>Close</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {groups.map((g:any)=> (
                <div key={g.id} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="font-semibold mb-3">{g.name}</div>
                  {roles.filter((r)=>r.group_id===g.id).map((r:any)=> {
                    const segs: Segment[] = ORDER.filter(s => (r.segments as Segment[]).includes(s));
                    return (
                      <div key={r.id} className="mb-4 border rounded p-3">
                        <div className="font-medium mb-3">{r.name}</div>
                        <div className="grid gap-3" style={{gridTemplateColumns:`repeat(${segs.length},minmax(0,1fr))`}}>
                          {segs.map(s => (
                            <div key={s}>
                              <div className="text-xs text-slate-500 mb-1">{s} Required</div>
                              <RequiredCell date={null} group={g} role={r} segment={s} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toolbar />

      {!sqlDb && (
        <div className="p-6 text-slate-600">
          <div className="font-semibold mb-2">First run</div>
          <ol className="list-decimal ml-5 space-y-1 text-sm">
            <li>Click <b>New DB</b> to create a local SQLite database (unsaved) or <b>Open DB</b> to load an existing one.</li>
            <li>Use <b>Save As</b> to write the <code>.db</code> file to a shared folder on your LAN. Only one editor at a time.</li>
            <li>Add <b>People</b> in the <b>People</b> tab and set <b>Baseline Needs</b>.</li>
            <li>Assign roles in the <b>Daily Run</b> board. The app will warn on availability and training; time-off blocks assignment.</li>
            <li>Import <b>Time-Off</b> from Teams XLSX in the <b>Export</b> view (optional). Export date range with one row per segment, split for overlaps.</li>
          </ol>
          <div className="mt-4 text-xs text-slate-500">If export fails to load XLSX, your network may block the SheetJS CDN. I can swap to a different CDN if needed.</div>
        </div>
      )}

      {sqlDb && (
        <>
          {activeTab === 'RUN' && <DailyRunBoard />}
          {activeTab === 'PEOPLE' && <PeopleEditor />}
          {activeTab === 'NEEDS' && <NeedsView />}
          {activeTab === 'EXPORT' && <ExportView />}
          {activeTab === 'MONTHLY' && <MonthlyView />}
          {activeTab === 'HISTORY' && <CrewHistoryView />}
        </>
      )}

      {showBaselineEditor && <BaselineEditor />}
    </div>
  );
}
