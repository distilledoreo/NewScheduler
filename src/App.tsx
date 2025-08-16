import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { applyMigrations } from "./services/migrations";
import { listSegments, type Segment, type SegmentRow } from "./services/segments";
import Toolbar from "./components/Toolbar";
const DailyRunBoard = React.lazy(() => import("./components/DailyRunBoard"));
const AdminView = React.lazy(() => import("./components/AdminView"));
const ExportPreview = React.lazy(() => import("./components/ExportPreview"));
import { exportMonthOneSheetXlsx } from "./excel/export-one-sheet";
import PersonName from "./components/PersonName";
import PersonProfileModal from "./components/PersonProfileModal";
import { ProfileContext } from "./components/ProfileContext";
import { Button, Checkbox, Dropdown, Input, Option, Table, TableHeader, TableHeaderCell, TableRow, TableBody, TableCell, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions } from "@fluentui/react-components";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import MonthlyDefaults from "./components/MonthlyDefaults";
import CrewHistoryView from "./components/CrewHistoryView";

/*
MVP: Pure-browser scheduler for Microsoft Teams Shifts
- Data stays local via File System Access API + sql.js (WASM) SQLite
- Single-editor model (soft lock stored in DB). No multi-user concurrency.
- Views: Daily Run Board, Needs vs Coverage, Export Preview
- Features: Create/Open/Save DB, People editor, Needs baseline + date overrides,
            Assignments with rules, Export to Shifts XLSX

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
  // Theme
  const [themeName, setThemeName] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  useEffect(() => {
    try { localStorage.setItem("theme", themeName); } catch {}
  }, [themeName]);

  const [ready, setReady] = useState(false);
  const [sqlDb, setSqlDb] = useState<any | null>(null);

  useEffect(() => {
    (window as any).sqlDb = sqlDb;
  }, [sqlDb]);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const [lockEmail, setLockEmail] = useState<string>("");
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => fmtDateMDY(new Date()));
  const [exportStart, setExportStart] = useState<string>(() => ymd(new Date()));
  const [exportEnd, setExportEnd] = useState<string>(() => ymd(new Date()));
  const [activeTab, setActiveTab] = useState<"RUN" | "PEOPLE" | "NEEDS" | "EXPORT" | "MONTHLY" | "HISTORY" | "ADMIN">("RUN");
  const [activeRunSegment, setActiveRunSegment] = useState<Segment>("AM");

  // People cache for quick UI (id -> record)
  const [people, setPeople] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  });
  const [copyFromMonth, setCopyFromMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  });
  const [monthlyDefaults, setMonthlyDefaults] = useState<any[]>([]);
  const [monthlyEditing, setMonthlyEditing] = useState(false);
  const [monthlyOverrides, setMonthlyOverrides] = useState<any[]>([]);

  // UI: simple dialogs
  const [showNeedsEditor, setShowNeedsEditor] = useState(false);
  const [profilePersonId, setProfilePersonId] = useState<number | null>(null);

  useEffect(() => {
    if (segments.length && !segments.find(s => s.name === activeRunSegment)) {
      const first = segments[0];
      if (first) setActiveRunSegment(first.name as Segment);
    }
  }, [segments]);

  useEffect(() => {
    if (sqlDb) loadMonthlyDefaults(selectedMonth);
    const [y, m] = selectedMonth.split('-').map(n => parseInt(n, 10));
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    setCopyFromMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
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
    db.run(`INSERT OR REPLACE INTO meta (key,value) VALUES ('lock','{}')`);
    setSqlDb(db);
    setStatus("New DB created (unsaved). Use Save As to write a .db file.");
    refreshCaches(db);
  }

  async function openDbFromFile(readOnly = false) {
    try {
      // Ask user for SQLite DB
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: "SQLite DB", accept: { "application/octet-stream": [".db", ".sqlite"] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buf));
      applyMigrations(db);

      if (readOnly) {
        setLockedBy("(read-only)");
        setSqlDb(db);
        fileHandleRef.current = handle;
        setStatus(`Opened ${file.name} (read-only)`);
      } else {
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
    if (lockedBy && lockedBy !== lockEmail) {
      alert("File is read-only or locked. Use Save As to create a copy.");
      return;
    }
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

  function syncTrainingFromAssignments(db = sqlDb) {
    if (!db) return;
    const pairs = all(`SELECT DISTINCT person_id, role_id FROM assignment`, [], db);
    for (const row of pairs) {
      run(
        `INSERT INTO training (person_id, role_id, status) VALUES (?,?, 'Qualified') ON CONFLICT(person_id, role_id) DO NOTHING`,
        [row.person_id, row.role_id],
        db
      );
    }
  }

  function refreshCaches(db = sqlDb) {
    if (!db) return;
    const g = all(`SELECT id,name,theme,custom_color FROM grp ORDER BY name`, [], db);
    setGroups(g);
    const r = all(`SELECT r.id, r.code, r.name, r.group_id, r.segments, g.name as group_name, g.custom_color as group_color FROM role r JOIN grp g ON g.id=r.group_id ORDER BY g.name, r.name`, [], db);
    setRoles(r.map(x => ({ ...x, segments: JSON.parse(x.segments) })));
    const p = all(`SELECT * FROM person WHERE active=1 ORDER BY last_name, first_name`, [], db);
    setPeople(p);
    const s = listSegments(db);
    setSegments(s);
    syncTrainingFromAssignments(db);
  }

  // People CRUD minimal
  function addPerson(rec: any) {
    run(
      `INSERT INTO person (last_name, first_name, work_email, brother_sister, commuter, active, avail_mon, avail_tue, avail_wed, avail_thu, avail_fri)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        rec.last_name?.trim() || "",
        rec.first_name?.trim() || "",
        rec.work_email?.trim().toLowerCase() || "",
        rec.brother_sister || null,
        rec.commuter ? 1 : 0,
        rec.active ? 1 : 1,
        rec.avail_mon || "U",
        rec.avail_tue || "U",
        rec.avail_wed || "U",
        rec.avail_thu || "U",
        rec.avail_fri || "U",
      ]
    );
    const id = all(`SELECT last_insert_rowid() as id`)[0]?.id;
    refreshCaches();
    return id;
  }

  function updatePerson(rec: any) {
    run(
      `UPDATE person SET last_name=?, first_name=?, work_email=?, brother_sister=?, commuter=?, active=?, avail_mon=?, avail_tue=?, avail_wed=?, avail_thu=?, avail_fri=? WHERE id=?`,
      [
        rec.last_name,
        rec.first_name,
        rec.work_email?.trim().toLowerCase(),
        rec.brother_sister,
        rec.commuter ? 1 : 0,
        rec.active ? 1 : 0,
        rec.avail_mon,
        rec.avail_tue,
        rec.avail_wed,
        rec.avail_thu,
        rec.avail_fri,
        rec.id,
      ]
    );
    refreshCaches();
  }

  function deletePerson(id: number) {
    run(`DELETE FROM training WHERE person_id=?`, [id]);
    run(`DELETE FROM person WHERE id=?`, [id]);
    refreshCaches();
  }

  function saveTraining(personId: number, rolesSet: Set<number>) {
    run(`DELETE FROM training WHERE person_id=?`, [personId]);
    for (const rid of rolesSet) {
      run(`INSERT INTO training (person_id, role_id, status) VALUES (?,?, 'Qualified')`, [personId, rid]);
    }
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
    const blocked = isSegmentBlockedByTimeOff(personId, d, segment);
      if (blocked) { alert("Time-off overlaps this segment. Blocked."); return; }
    }

    run(`INSERT INTO assignment (date, person_id, role_id, segment) VALUES (?,?,?,?)`, [ymd(d), personId, roleId, segment]);
    run(
      `INSERT INTO training (person_id, role_id, status) VALUES (?,?, 'Qualified') ON CONFLICT(person_id, role_id) DO UPDATE SET status='Qualified'`,
      [personId, roleId]
    );
    refreshCaches();
  }

  function deleteAssignment(id:number){ run(`DELETE FROM assignment WHERE id=?`,[id]); refreshCaches(); }

  function segmentTimesForDate(date: Date): Record<string, { start: Date; end: Date }> {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const mk = (t: string) => {
      const [h, m] = t.split(":" ).map(Number);
      return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
    };
    const out: Record<string, { start: Date; end: Date }> = {};
    for (const s of segments) {
      out[s.name] = { start: mk(s.start_time), end: mk(s.end_time) };
    }

    const assigns = listAssignmentsForDate(fmtDateMDY(date));
    const hasLunch = assigns.some((a: any) => a.segment === "Lunch");
    const hasEarly = assigns.some((a: any) => a.segment === "Early");

    if (hasLunch && out["Lunch"]) {
      if (out["AM"]) out["AM"].end = out["Lunch"].start;
      if (out["PM"]) out["PM"].start = addMinutes(out["Lunch"].end, 60);
    }
    if (hasEarly && out["PM"]) {
      out["PM"].end = addMinutes(out["PM"].end, -60);
    }

    return out;
  }

  function isSegmentBlockedByTimeOff(personId: number, date: Date, segment: Segment): boolean {
    // For UI adding, any overlap => return true (spec Q34 = Block)
    const intervals = listTimeOffIntervals(personId, date);
    if (intervals.length === 0) return false;
    const seg = segmentTimesForDate(date)[segment];
    if (!seg) return false;
    const start = seg.start.getTime();
    const end = seg.end.getTime();
    return intervals.some(({ start: s, end: e }) => Math.max(s.getTime(), start) < Math.min(e.getTime(), end));
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
    const ov = all(`SELECT * FROM monthly_default_day WHERE month=?`, [month]);
    setMonthlyOverrides(ov);
  }

  function setMonthlyDefault(personId: number, segment: Segment, roleId: number | null) {
    if (!sqlDb) return;
    if (roleId != null) {
      run(`INSERT INTO monthly_default (month, person_id, segment, role_id) VALUES (?,?,?,?)
           ON CONFLICT(month, person_id, segment) DO UPDATE SET role_id=excluded.role_id`,
          [selectedMonth, personId, segment, roleId]);
    } else {
      run(`DELETE FROM monthly_default WHERE month=? AND person_id=? AND segment=?`,
          [selectedMonth, personId, segment]);
    }
    loadMonthlyDefaults(selectedMonth);
  }

  function setWeeklyOverride(personId: number, weekday: number, segment: Segment, roleId: number | null) {
    if (!sqlDb) return;
    if (roleId != null) {
      run(`INSERT INTO monthly_default_day (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)
           ON CONFLICT(month, person_id, weekday, segment) DO UPDATE SET role_id=excluded.role_id`,
          [selectedMonth, personId, weekday, segment, roleId]);
    } else {
      run(`DELETE FROM monthly_default_day WHERE month=? AND person_id=? AND weekday=? AND segment=?`,
          [selectedMonth, personId, weekday, segment]);
    }
    loadMonthlyDefaults(selectedMonth);
  }

  function setMonthlyDefaultForMonth(month: string, personId: number, segment: Segment, roleId: number | null) {
    if (!sqlDb) return;
    if (roleId != null) {
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
    const orows = all(`SELECT person_id, weekday, segment, role_id FROM monthly_default_day WHERE month=?`, [fromMonth]);
    for (const row of orows) {
      run(
        `INSERT INTO monthly_default_day (month, person_id, weekday, segment, role_id) VALUES (?,?,?,?,?)
         ON CONFLICT(month, person_id, weekday, segment) DO UPDATE SET role_id=excluded.role_id`,
        [toMonth, row.person_id, row.weekday, row.segment, row.role_id]
      );
    }
    loadMonthlyDefaults(toMonth);
    setStatus(`Copied monthly defaults from ${fromMonth}.`);
  }

  function applyMonthlyDefaults(month: string) {
    if (!sqlDb) return;
    const [y,m] = month.split('-').map(n=>parseInt(n,10));
    const days = new Date(y, m, 0).getDate();
    const defaultMap = new Map<string, number>();
    for (const def of monthlyDefaults) {
      defaultMap.set(`${def.person_id}|${def.segment}`, def.role_id);
    }
    const overrideMap = new Map<string, number>();
    for (const ov of monthlyOverrides) {
      overrideMap.set(`${ov.person_id}|${ov.weekday}|${ov.segment}`, ov.role_id);
    }
    for (const person of people) {
      for (let day=1; day<=days; day++) {
        const d = new Date(y, m-1, day);
        const wdName = weekdayName(d);
        if (wdName === 'Weekend') continue;
        const wdNum = d.getDay(); // 1=Mon..5=Fri
        const availField = wdName === 'Monday'? 'avail_mon' : wdName === 'Tuesday'? 'avail_tue' : wdName === 'Wednesday'? 'avail_wed' : wdName === 'Thursday'? 'avail_thu' : 'avail_fri';
        const avail = person[availField];
        for (const seg of segments.map(s => s.name as Segment)) {
          let roleId = overrideMap.get(`${person.id}|${wdNum}|${seg}`);
          if (roleId === undefined) roleId = defaultMap.get(`${person.id}|${seg}`);
          if (roleId == null) continue;
          let ok = false;
          if (seg === 'AM' || seg === 'Early') ok = avail === 'AM' || avail === 'B';
          else if (seg === 'PM') ok = avail === 'PM' || avail === 'B';
          else if (seg === 'Lunch') ok = avail === 'AM' || avail === 'PM' || avail === 'B';
          else ok = avail === 'AM' || avail === 'PM' || avail === 'B';
          if (!ok) continue;
          if (seg !== 'Early' && isSegmentBlockedByTimeOff(person.id, d, seg)) continue;
          run(`INSERT OR REPLACE INTO assignment (date, person_id, role_id, segment) VALUES (?,?,?,?)`,
              [ymd(d), person.id, roleId, seg]);
        }
      }
    }
    refreshCaches();
    setStatus('Applied monthly defaults.');
  }

  async function exportMonthlyDefaults(month: string) {
    if (!sqlDb) return;
    const headers = [
      'Last Name',
      'First Name',
      ...segments.map(s => `${s.name} Role`),
      'B/S','Commute','Active',
      'Mon','Tue','Wed','Thu','Fri'
    ];

    const contrastColor = (hex: string) => {
      const c = hex.replace('#','');
      if (c.length !== 6) return '#000';
      const r = parseInt(c.substring(0,2),16);
      const g = parseInt(c.substring(2,4),16);
      const b = parseInt(c.substring(4,6),16);
      const l = 0.299*r + 0.587*g + 0.114*b;
      return l > 186 ? '#000' : '#fff';
    };

    const monthDate = new Date(month + '-01');
    const titleText = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const escapeHtml = (s: string) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const headerHtml = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const bodyHtml = people.map((p:any) => {
      const roleTds = segments.map(s => {
        const seg = s.name as Segment;
        const def = monthlyDefaults.find(d => d.person_id===p.id && d.segment===seg);
        const role = roles.find(r => r.id===def?.role_id);
        const group = groups.find(g => g.id === role?.group_id);
        const bg = group?.custom_color || '';
        const color = bg ? contrastColor(bg) : '';
        const style = bg ? ` style="background:${bg};color:${color};"` : '';
        return `<td${style}>${escapeHtml(role?.name || '')}</td>`;
      }).join('');
      return `<tr>`+
        `<td>${escapeHtml(p.last_name)}</td>`+
        `<td>${escapeHtml(p.first_name)}</td>`+
        roleTds+
        `<td>${escapeHtml(p.brother_sister || '')}</td>`+
        `<td>${p.commuter ? 'Yes' : 'No'}</td>`+
        `<td>${p.active ? 'Yes' : 'No'}</td>`+
        `<td>${escapeHtml(p.avail_mon)}</td>`+
        `<td>${escapeHtml(p.avail_tue)}</td>`+
        `<td>${escapeHtml(p.avail_wed)}</td>`+
        `<td>${escapeHtml(p.avail_thu)}</td>`+
        `<td>${escapeHtml(p.avail_fri)}</td>`+
        `</tr>`;
    }).join('');

    const style = `body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f7fa;color:#1a1a1a;margin:0;padding:40px;}\n`+
      `h1{text-align:center;font-weight:300;margin-bottom:24px;}\n`+
      `.search{text-align:right;margin-bottom:12px;}\n`+
      `.search input{padding:8px 12px;border:1px solid #cbd5e1;border-radius:4px;}\n`+
      `table{width:100%;border-collapse:collapse;box-shadow:0 2px 4px rgba(0,0,0,0.1);}\n`+
      `th,td{padding:12px 16px;border-bottom:1px solid #e5e7eb;}\n`+
      `th{background:#111827;color:#fff;position:sticky;top:0;cursor:pointer;}\n`+
      `tr:nth-child(even){background:#f9fafb;}`;

    const script = `const getCellValue=(tr,idx)=>tr.children[idx].innerText;\n`+
      `const comparer=(idx,asc)=>((a,b)=>((v1,v2)=>v1!==''&&v2!==''&&!isNaN(v1)&&!isNaN(v2)?v1-v2:v1.localeCompare(v2))(`+
      `getCellValue(asc?a:b,idx),getCellValue(asc?b:a,idx)));\n`+
      `document.querySelectorAll('th').forEach(th=>th.addEventListener('click',(()=>{`+
      `const table=th.closest('table');const tbody=table.querySelector('tbody');Array.from(tbody.querySelectorAll('tr'))`+
      `.sort(comparer(Array.from(th.parentNode.children).indexOf(th),this.asc=!this.asc))`+
      `.forEach(tr=>tbody.appendChild(tr));})));\n`+
      `const search=document.getElementById('table-search');search.addEventListener('input',()=>{`+
      `const term=search.value.toLowerCase();document.querySelectorAll('tbody tr').forEach(tr=>{`+
      `tr.style.display=Array.from(tr.children).some(td=>td.textContent.toLowerCase().includes(term))?'':'none';});});`;

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>`+
      `<title>Monthly Defaults - ${escapeHtml(titleText)}</title>`+
      `<style>${style}</style></head><body>`+
      `<h1>Monthly Defaults - ${escapeHtml(titleText)}</h1>`+
      `<div class="search"><label>Search: <input id="table-search" type="search" placeholder="Filter rows"/></label></div>`+
      `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`+
      `<script>${script}<\/script></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-defaults-${month}.html`;
    a.click();
    URL.revokeObjectURL(url);
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

// Export to Shifts XLSX
async function exportShifts() {
    if (!sqlDb) { alert("Open a DB first"); return; }
    const XLSX = await loadXLSX();
    const start = parseYMD(exportStart);
    const end = parseYMD(exportEnd);
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

        const segMap = segmentTimesForDate(d);
        for (const a of assigns) {
          const seg = segMap[a.segment];
          if (!seg) continue;
          const windows: Array<{ start: Date; end: Date; label: string; group: string }> = [
            { start: seg.start, end: seg.end, label: a.role_name, group: a.group_name },
          ];

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
      suggestedName: `teams-shifts-export_${exportStart}_${exportEnd}.xlsx`,
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
    const group = a.segment === "Early" ? "Dining Room" : a.group_name;
    const themeColor = groups.find((g) => g.name === group)?.theme || "";
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

  // UI helpers
  const canEdit = !!sqlDb;
  const canSave = !!sqlDb && (!lockedBy || lockedBy === lockEmail);
  const selectedDateObj = useMemo(()=>parseMDY(selectedDate),[selectedDate]);

  function peopleOptionsForSegment(date: Date, segment: Segment, role: any) {
    // Determine weekday availability field
    const wd = weekdayName(date);
    const availField =
      wd === "Monday"
        ? "avail_mon"
        : wd === "Tuesday"
        ? "avail_tue"
        : wd === "Wednesday"
        ? "avail_wed"
        : wd === "Thursday"
        ? "avail_thu"
        : "avail_fri";

    const rows = all(`SELECT * FROM person WHERE active=1 ORDER BY last_name, first_name`);
    const trained = new Set([
      ...all(`SELECT person_id FROM training WHERE role_id=? AND status='Qualified'`, [role.id]).map(
        (r: any) => r.person_id
      ),
      ...all(
        `SELECT DISTINCT person_id FROM assignment WHERE role_id=? AND date < ?`,
        [role.id, ymd(date)]
      ).map((r: any) => r.person_id),
    ]);

    return rows
      .filter((p: any) => {
        const avail = p[availField] as "U" | "AM" | "PM" | "B";
        let availOk: boolean;
        if (segment === "AM" || segment === "Early") {
          availOk = avail === "AM" || avail === "B";
        } else if (segment === "PM") {
          availOk = avail === "PM" || avail === "B";
        } else {
          availOk = avail === "AM" || avail === "PM" || avail === "B";
        }
        if (!availOk) return false;

        if (segment !== "Early" && isSegmentBlockedByTimeOff(p.id, date, segment)) return false;

        return true;
      })
      .map((p: any) => {
        const warn = trained.has(p.id) ? "" : "(Untrained)";
        return {
          id: p.id,
          label: `${p.last_name}, ${p.first_name}${warn ? ` ${warn}` : ""}`,
          blocked: false,
        };
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
        <Input
          type="number"
          value={String(val)}
          onChange={(_, d)=>setVal(parseInt(d.value||'0',10))}
        />
        <Button appearance="primary" onClick={()=>setRequired(date, group.id, role.id, segment, val)}>
          Save
        </Button>
      </div>
    );
  }
  function BaselineView(){
    return (
      <div className="p-4">
        <div className="font-semibold text-lg mb-4">Baseline Needs</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g:any)=> (
            <div key={g.id} className="border rounded-lg p-3 bg-white shadow-sm">
              <div className="font-semibold mb-3">{g.name}</div>
              {roles.filter((r)=>r.group_id===g.id).map((r:any)=> (
                <div key={r.id} className="mb-4 border rounded p-3">
                  <div className="font-medium mb-3">{r.name}</div>
                  <div
                    className="space-y-3 sm:grid sm:gap-3 sm:space-y-0"
                    style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0,1fr))` }}
                  >
                    {segments.map((s) => (
                      <div key={s.name}>
                        <div className="text-xs text-slate-500 mb-1">{s.name} Required</div>
                        <RequiredCell date={null} group={g} role={r} segment={s.name as Segment} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }


function PeopleEditor(){
  const emptyForm = { active:true, commuter:false, brother_sister:'Brother', avail_mon:'U', avail_tue:'U', avail_wed:'U', avail_thu:'U', avail_fri:'U' };
  const [form,setForm] = useState<any>(emptyForm);
  const [editing,setEditing] = useState<any|null>(null);
  const [qualifications,setQualifications] = useState<Set<number>>(new Set());
  const [showModal,setShowModal] = useState(false);

  useEffect(()=>{
    if(editing){
      const rows = all(`SELECT role_id FROM training WHERE person_id=? AND status='Qualified'`, [editing.id]);
      setQualifications(new Set(rows.map((r:any)=>r.role_id)));
    } else {
      setQualifications(new Set());
    }
  },[editing]);

  function openModal(p?:any){
    if(p){
      setEditing(p);
      setForm(p);
    } else {
      setEditing(null);
      setForm(emptyForm);
      setQualifications(new Set());
    }
    setShowModal(true);
  }
  function closeModal(){
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    setQualifications(new Set());
  }
  function save(){
    if(editing){
      updatePerson({...editing, ...form});
      saveTraining(editing.id, qualifications);
    } else {
      const id = addPerson(form);
      saveTraining(id, qualifications);
    }
    closeModal();
  }

  return (
    <div className="p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-lg">People</div>
          <Button appearance="primary" onClick={()=>openModal()}>Add Person</Button>
        </div>

        <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
          <Table aria-label="People table">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>B/S</TableHeaderCell>
                <TableHeaderCell>Commute</TableHeaderCell>
                <TableHeaderCell>Active</TableHeaderCell>
                <TableHeaderCell>Mon</TableHeaderCell>
                <TableHeaderCell>Tue</TableHeaderCell>
                <TableHeaderCell>Wed</TableHeaderCell>
                <TableHeaderCell>Thu</TableHeaderCell>
                <TableHeaderCell>Fri</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map(p => (
                <TableRow key={p.id}>
                  <TableCell><PersonName personId={p.id}>{p.last_name}, {p.first_name}</PersonName></TableCell>
                  <TableCell>{p.work_email}</TableCell>
                  <TableCell>{p.brother_sister||'-'}</TableCell>
                  <TableCell>{p.commuter?"Yes":"No"}</TableCell>
                  <TableCell>{p.active?"Yes":"No"}</TableCell>
                  <TableCell>{p.avail_mon}</TableCell>
                  <TableCell>{p.avail_tue}</TableCell>
                  <TableCell>{p.avail_wed}</TableCell>
                  <TableCell>{p.avail_thu}</TableCell>
                  <TableCell>{p.avail_fri}</TableCell>
                  <TableCell>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="small" onClick={()=>openModal(p)}>Edit</Button>
                      <Button size="small" appearance="secondary" onClick={()=>{ if(confirm('Delete?')) deletePerson(p.id); }}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={(_, d) => setShowModal(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editing ? 'Edit Person' : 'Add Person'}</DialogTitle>
            <DialogContent>
              <div className="grid grid-cols-12 gap-2 mb-3">
                <Input className="col-span-3" placeholder="Last Name" value={form.last_name||''} onChange={(_,d)=>setForm({...form,last_name:d.value})} />
                <Input className="col-span-3" placeholder="First Name" value={form.first_name||''} onChange={(_,d)=>setForm({...form,first_name:d.value})} />
                <Input className="col-span-4" placeholder="Work Email" value={form.work_email||''} onChange={(_,d)=>setForm({...form,work_email:d.value})} />
                <div className="col-span-2">
                  <Dropdown
                    selectedOptions={[form.brother_sister || 'Brother']}
                    onOptionSelect={(_, data)=> setForm({...form, brother_sister: String(data.optionValue ?? data.optionText)})}
                  >
                    <Option value="Brother">Brother</Option>
                    <Option value="Sister">Sister</Option>
                  </Dropdown>
                </div>
                <div className="col-span-2 flex items-center">
                  <Checkbox label="Commuter" checked={!!form.commuter} onChange={(_,data)=>setForm({...form,commuter:!!data.checked})} />
                </div>
                <div className="col-span-2 flex items-center">
                  <Checkbox label="Active" checked={form.active!==false} onChange={(_,data)=>setForm({...form,active:!!data.checked})} />
                </div>
                {WEEKDAYS.map((w,idx)=> (
                  <div key={w} className="col-span-2">
                    <div className="text-xs text-slate-500 mb-1">{w} Availability</div>
                    <Dropdown
                      selectedOptions={[form[["avail_mon","avail_tue","avail_wed","avail_thu","avail_fri"][idx]]||'U']}
                      onOptionSelect={(_, data)=>{
                        const key = ["avail_mon","avail_tue","avail_wed","avail_thu","avail_fri"][idx] as keyof typeof form;
                        setForm({...form,[key]: String(data.optionValue ?? data.optionText)});
                      }}
                    >
                      <Option value="U">Unavailable</Option>
                      <Option value="AM">AM</Option>
                      <Option value="PM">PM</Option>
                      <Option value="B">Both</Option>
                    </Dropdown>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-1">Qualified Roles</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 max-h-40 overflow-auto border rounded p-2">
                  {roles.map((r:any)=>(
                    <Checkbox key={r.id}
                      label={r.name}
                      checked={qualifications.has(r.id)}
                      onChange={(_, data) => {
                        const next = new Set(qualifications);
                        if (data.checked) next.add(r.id); else next.delete(r.id);
                        setQualifications(next);
                      }}
                    />
                  ))}
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeModal}>Close</Button>
              <Button appearance="primary" onClick={save}>{editing ? 'Save Changes' : 'Add Person'}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

  function NeedsEditor(){
    const d = selectedDateObj;
    return (
      <Dialog open={showNeedsEditor} onOpenChange={(_, data)=> setShowNeedsEditor(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Needs for {fmtDateMDY(d)}</DialogTitle>
            <DialogContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {groups.map((g:any)=> (
                  <div key={g.id} className="border rounded-lg p-3 bg-white shadow-sm">
                    <div className="font-semibold mb-3">{g.name}</div>
                    {roles.filter((r)=>r.group_id===g.id).map((r:any)=> (
                      <div key={r.id} className="mb-4 border rounded p-3">
                        <div className="font-medium mb-3">{r.name}</div>
                        <div
                          className="space-y-3 sm:grid sm:gap-3 sm:space-y-0"
                          style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0,1fr))` }}
                        >
                          {segments.map((s) => (
                            <div key={s.name}>
                              <div className="text-xs text-slate-500 mb-1">{s.name} Required</div>
                              <RequiredCell date={d} group={g} role={r} segment={s.name as Segment} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={()=>setShowNeedsEditor(false)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }

  return (
  <FluentProvider theme={themeName === "dark" ? webDarkTheme : webLightTheme}>
  <ProfileContext.Provider value={{ showProfile: (id: number) => setProfilePersonId(id) }}>
  <div className="min-h-screen" style={{ backgroundColor: (themeName === "dark" ? webDarkTheme : webLightTheme).colorNeutralBackground1 }}>
      <Toolbar
        ready={ready}
        sqlDb={sqlDb}
        createNewDb={createNewDb}
        openDbFromFile={openDbFromFile}
        saveDb={saveDb}
        saveDbAs={saveDbAs}
        status={status}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        canSave={canSave}
    themeName={themeName}
    setThemeName={setThemeName}
      />

      {!sqlDb && (
        <div className="p-6 text-slate-600">
          <div className="font-semibold mb-2">First run</div>
          <ol className="list-decimal ml-5 space-y-1 text-sm">
            <li>Click <b>New DB</b> to create a local SQLite database (unsaved) or <b>Open DB</b> to load an existing one.</li>
            <li>Use <b>Save As</b> to write the <code>.db</code> file to a shared folder on your LAN. Only one editor at a time.</li>
            <li>Add <b>People</b> in the <b>People</b> tab and set <b>Baseline Needs</b>.</li>
            <li>Assign roles in the <b>Daily Run</b> board. The app will warn on availability and training; time-off blocks assignment.</li>
            <li>Export date range with one row per segment, split for overlaps.</li>
          </ol>
          <div className="mt-4 text-xs text-slate-500">If export fails to load XLSX, your network may block the SheetJS CDN. I can swap to a different CDN if needed.</div>
        </div>
      )}

      {sqlDb && (
        <>
            {activeTab === 'RUN' && (
              <Suspense fallback={<div className="p-4 text-slate-600">Loading Daily Run…</div>}>
                <DailyRunBoard
                  activeRunSegment={activeRunSegment}
                  setActiveRunSegment={setActiveRunSegment}
                  groups={groups}
                  segments={segments}
                  lockEmail={lockEmail}
                  sqlDb={sqlDb}
                  all={all}
                  roleListForSegment={roleListForSegment}
                  selectedDate={selectedDate}
                  selectedDateObj={selectedDateObj}
                  setSelectedDate={setSelectedDate}
                  fmtDateMDY={fmtDateMDY}
                  parseYMD={parseYMD}
                  ymd={ymd}
                  setShowNeedsEditor={setShowNeedsEditor}
                  canEdit={canEdit}
                  peopleOptionsForSegment={peopleOptionsForSegment}
                  getRequiredFor={getRequiredFor}
                  addAssignment={addAssignment}
                  deleteAssignment={deleteAssignment}
                  isDark={themeName === "dark"}
                />
              </Suspense>
            )}
          {activeTab === 'PEOPLE' && <PeopleEditor />}
          {activeTab === 'NEEDS' && <BaselineView />}
          {activeTab === 'EXPORT' && (
            <Suspense fallback={<div className="p-4 text-slate-600">Loading Export Preview…</div>}>
              <ExportPreview
                sqlDb={sqlDb}
                exportStart={exportStart}
                exportEnd={exportEnd}
                setExportStart={setExportStart}
                setExportEnd={setExportEnd}
                exportShifts={exportShifts}
                all={all}
                segmentTimesForDate={segmentTimesForDate}
                listTimeOffIntervals={listTimeOffIntervals}
                subtractIntervals={subtractIntervals}
                groups={groups}
                people={people}
                roles={roles}
              />
            </Suspense>
          )}
          {activeTab === 'MONTHLY' && (
            <MonthlyDefaults
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              copyFromMonth={copyFromMonth}
              setCopyFromMonth={setCopyFromMonth}
              people={people}
              segments={segments}
              monthlyDefaults={monthlyDefaults}
              monthlyOverrides={monthlyOverrides}
              monthlyEditing={monthlyEditing}
              setMonthlyEditing={setMonthlyEditing}
              setMonthlyDefault={setMonthlyDefault}
              setWeeklyOverride={setWeeklyOverride}
              copyMonthlyDefaults={copyMonthlyDefaults}
              applyMonthlyDefaults={applyMonthlyDefaults}
              exportMonthlyDefaults={exportMonthlyDefaults}
              roleListForSegment={roleListForSegment}
            />
          )}


          {activeTab === 'HISTORY' && (
            <CrewHistoryView
              sqlDb={sqlDb}
              monthlyDefaults={monthlyDefaults}
              segments={segments}
              people={people}
              roles={roles}
              groups={groups}
              roleListForSegment={roleListForSegment}
              setMonthlyDefaultForMonth={setMonthlyDefaultForMonth}
              all={all}
            />
          )}
          {activeTab === 'ADMIN' && (
            <Suspense fallback={<div className="p-4 text-slate-600">Loading Admin…</div>}>
              <AdminView all={all} run={run} refresh={refreshCaches} segments={segments} />
            </Suspense>
          )}
        </>
      )}

      {showNeedsEditor && <NeedsEditor />}
      {profilePersonId !== null && (
        <PersonProfileModal
          personId={profilePersonId}
          onClose={() => setProfilePersonId(null)}
          all={all}
        />
      )}
  </div>
  </ProfileContext.Provider>
  </FluentProvider>
  );
}
