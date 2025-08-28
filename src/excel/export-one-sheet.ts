import { loadExcelJS } from './exceljs-loader';
import { availabilityFor } from '../services/availability';

type ExportGroupRow = {
  group_name: string;
  code: string;
  color: string;
  column_group: string;
};

type GroupInfo = Record<string, { code: string; color: string; column_group: string }>;

function loadExportGroups(): { info: GroupInfo; col1: string[]; col2: string[]; dining: string[] } {
  const rows = all<ExportGroupRow>(
    `SELECT g.name AS group_name, eg.code, eg.color, eg.column_group
       FROM export_group eg
       JOIN grp g ON g.id = eg.group_id
      ORDER BY eg.column_group, g.name`
  );
  const info: GroupInfo = {};
  const col1: string[] = [];
  const col2: string[] = [];
  const dining: string[] = [];
  for (const r of rows) {
    info[r.group_name] = { code: r.code, color: r.color, column_group: r.column_group };
    if (r.column_group === 'kitchen1') col1.push(r.group_name);
    else if (r.column_group === 'kitchen2') col2.push(r.group_name);
    else if (r.column_group === 'dining') dining.push(r.group_name);
  }
  // Ensure Lunch group is available even if export_group lacks an entry
  if (!info['Lunch']) {
    info['Lunch'] = { code: 'LUNCH', color: 'FFF9A8D4', column_group: 'dining' };
    dining.push('Lunch');
  }
  return { info, col1, col2, dining };
}


const DAY_ORDER = ['M','T','W','TH','F'] as const;
type DayLetter = typeof DAY_ORDER[number];

type Seg = 'AM'|'PM';

// ---------- Types ----------
type WithAvail = {
  avail_mon: string | null;
  avail_tue: string | null;
  avail_wed: string | null;
  avail_thu: string | null;
  avail_fri: string | null;
};

type DefaultRow = WithAvail & {
  person_id: number;
  segment: string | null; // tolerate variants
  group_name: string;
  role_id: number;
  role_name: string;
  person: string;
  commuter: number;
  month: string;
};

type DayRow = WithAvail & {
  person_id: number;
  weekday: number; // tolerate 0..4 or 1..5; we’ll normalize to DayLetter
  segment: string | null;
  group_name: string;
  role_id: number;
  role_name: string;
  person: string;
  commuter: number;
  month: string;
};

// Buckets: regular/commuter -> groupCode -> personName -> { AM days, PM days, roles list (for display) }
type Buckets = Record<'regular'|'commuter',
  Record<string, Record<string, { AM: Set<DayLetter>; PM: Set<DayLetter>; roles: Set<string> }>>
>;

type LunchBuckets = Record<'regular'|'commuter',
  Record<string, Record<string, { days: Set<DayLetter>; roles: Set<string> }>>
>;

// ---------- DB helpers ----------
function requireDb() {
  const db = (globalThis as any).sqlDb;
  if (!db) throw new Error('No database loaded');
  return db;
}

function all<T = any>(sql: string, params: any[] = []): T[] {
  const db = requireDb();
  const stmt = db.prepare(sql);
  const rows: T[] = [];
  stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

// ---------- Month / segment / weekday normalization ----------
/** Normalize any incoming month string to "YYYY-MM". Accepts "YYYY-M", "YYYY-MM", "YYYY-MM-DD", "YYYYMM", "YYYYMMDD". */
function normalizeMonthKey(value: string): string {
  const v = (value || '').trim();
  // ISO-ish
  let m = v.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (m) {
    const y = m[1];
    const mm = String(parseInt(m[2], 10)).padStart(2, '0');
    return `${y}-${mm}`;
  }
  // Compact
  m = v.match(/^(\d{4})(\d{2})(\d{2})?$/);
  if (m) return `${m[1]}-${m[2]}`;
  // Fallback
  return v.slice(0, 7);
}

/** Return SQL WHERE clause and params that match many month formats for the given column. */
function monthWhere(column: string, monthKey: string): { where: string; params: string[] } {
  const ym = monthKey;                  // "YYYY-MM"
  const likeYm = `${ym}%`;              // "YYYY-MM%"
  const ymCompact = ym.replace('-', '');      // "YYYYMM"
  const ymdCompact = `${ymCompact}01`;        // "YYYYMM01"
  const ymd = `${ym}-01`;               // "YYYY-MM-01"
  const where = `(
    substr(${column}, 1, 7) = ? OR
    ${column} LIKE ? OR
    replace(${column}, '-', '') = ? OR
    replace(substr(${column}, 1, 10), '-', '') = ? OR
    ${column} = ?
  )`;
  const params = [ym, likeYm, ymCompact, ymdCompact, ymd];
  return { where, params };
}

function expandSegments(seg: string | null | undefined): Seg[] {
  const s = (seg || '').toString().trim().toUpperCase();
  if (s === 'AM') return ['AM'];
  if (s === 'PM') return ['PM'];
  // Treat '', null, 'B', 'BOTH', 'ALL', '*' as both shifts
  return ['AM','PM'];
}

/** Convert various stored weekday numbers to our DayLetter (Mon–Fri only). */
function weekdayToLetter(weekday: number): DayLetter | undefined {
  // 1..5 => Mon..Fri
  if (weekday >= 1 && weekday <= 5) return DAY_ORDER[weekday - 1];
  // 0..4 => Mon..Fri (0-based Mon)
  if (weekday >= 0 && weekday <= 4) return DAY_ORDER[weekday];
  // Unknown encodings are ignored
  return undefined;
}

function dateForDay(month: string, day: DayLetter): Date {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const first = new Date(y, m - 1, 1);
  const target = day === 'M' ? 1 : day === 'T' ? 2 : day === 'W' ? 3 : day === 'TH' ? 4 : 5;
  const diff = (target - first.getDay() + 7) % 7;
  return new Date(y, m - 1, 1 + diff);
}

/** Get availability code for a given day letter using overrides. */
function availCodeFor(day: DayLetter, row: WithAvail & { person_id: number; month: string }): string {
  const db = requireDb();
  const date = dateForDay(row.month, day);
  return availabilityFor(db, row.person_id, date);
}

/** Whether this segment is allowed by availability for the given day. */
function isAllowedByAvail(day: DayLetter, seg: Seg, row: WithAvail & { person_id: number; month: string }): boolean {
  const ac = availCodeFor(day, row);
  if (ac === 'B') return true;
  return ac === seg;
}

function isAllowedForLunch(day: DayLetter, row: WithAvail & { person_id: number; month: string }): boolean {
  const ac = availCodeFor(day, row);
  return ac === 'AM' || ac === 'PM' || ac === 'B';
}

export async function exportMonthOneSheetXlsx(month: string): Promise<void> {
  requireDb();

  // Load ExcelJS ONCE
  const ExcelJS = await loadExcelJS();

  const monthKey = normalizeMonthKey(month); // "YYYY-MM"
  const mdMonth = monthWhere('md.month', monthKey);
  const mddMonth = monthWhere('mdd.month', monthKey);

  const { info: GROUP_INFO, col1: KITCHEN_COL1_GROUPS, col2: KITCHEN_COL2_GROUPS, dining: DINING_GROUPS } = loadExportGroups();

  // NOTE: Accept all segments in SQL; normalize/expand in code.
  const defaults = all<DefaultRow>(
    `SELECT md.person_id, md.segment,
            g.name AS group_name, r.id AS role_id, r.name AS role_name,
            (p.last_name || ', ' || p.first_name) AS person,
            p.commuter AS commuter,
            p.avail_mon, p.avail_tue, p.avail_wed, p.avail_thu, p.avail_fri,
            md.month as month
       FROM monthly_default md
      JOIN role r ON r.id = md.role_id
      JOIN grp  g ON g.id = r.group_id
      JOIN person p ON p.id = md.person_id
      WHERE ${mdMonth.where} AND p.active = 1
      ORDER BY g.name, person`,
    mdMonth.params
  );

  const perDays = all<DayRow>(
    `SELECT mdd.person_id, mdd.weekday, mdd.segment,
            g.name AS group_name, r.id AS role_id, r.name AS role_name,
            (p.last_name || ', ' || p.first_name) AS person,
            p.commuter AS commuter,
            p.avail_mon, p.avail_tue, p.avail_wed, p.avail_thu, p.avail_fri,
            mdd.month as month
       FROM monthly_default_day mdd
      JOIN role r ON r.id = mdd.role_id
      JOIN grp  g ON g.id = r.group_id
      JOIN person p ON p.id = mdd.person_id
      WHERE ${mddMonth.where} AND p.active = 1`,
    mddMonth.params
  );

  const buckets: Buckets = { regular: {}, commuter: {} };

  // Map (person_id|segment) -> Map<DayLetter, role_id> for precise subtraction
  const psKey = (pid:number, seg:Seg) => `${pid}|${seg}`;
  const perDayMap = new Map<string, Map<DayLetter, number>>();

  // 1) Add explicit per-day assignments (respect AVAILABILITY) and build the perDayMap (by DAY LETTER)
  for (const row of perDays) {
    const dayLetter = weekdayToLetter(row.weekday);
    if (!dayLetter) continue;
    const segNorm = (row.segment || '').toString().trim().toUpperCase();
    if (segNorm === 'LUNCH') continue;

    const segs = expandSegments(segNorm);
    for (const s of segs) {
      if (!isAllowedByAvail(dayLetter, s, row)) continue; // skip days not allowed by availability

      const code = GROUP_INFO[row.group_name]?.code;
      if (!code) continue;

      const kind: 'regular' | 'commuter' = row.commuter ? 'commuter' : 'regular';
      const groupBucket = buckets[kind][code] || (buckets[kind][code] = {});
      const personBucket = groupBucket[row.person] || (groupBucket[row.person] = { AM: new Set<DayLetter>(), PM: new Set<DayLetter>(), roles: new Set<string>() });
      personBucket.roles.add(row.role_name);

      if (s === 'AM') personBucket.AM.add(dayLetter);
      else personBucket.PM.add(dayLetter);

      let dayMap = perDayMap.get(psKey(row.person_id, s));
      if (!dayMap) {
        dayMap = new Map<DayLetter, number>();
        perDayMap.set(psKey(row.person_id, s), dayMap);
      }
      dayMap.set(dayLetter, row.role_id);
    }
  }

  // 2) Apply defaults, but:
  //    - Respect AVAILABILITY
  //    - SUBTRACT days that have per-day rows with a DIFFERENT role (by DAY LETTER)
  for (const row of defaults) {
    const code = GROUP_INFO[row.group_name]?.code;
    if (!code) continue;
    const segNorm = (row.segment || '').toString().trim().toUpperCase();
    if (segNorm === 'LUNCH') continue;

    const segs = expandSegments(segNorm);
    for (const s of segs) {
      const dayMap = perDayMap.get(psKey(row.person_id, s));

      const keepLetters: DayLetter[] = [];
      for (const d of DAY_ORDER) {
        if (!isAllowedByAvail(d, s, row)) continue; // default not effective when unavailable

        const overriddenRoleId = dayMap?.get(d);
        if (overriddenRoleId == null || overriddenRoleId === row.role_id) {
          keepLetters.push(d);
        }
      }

      if (keepLetters.length === 0) continue;

      const kind: 'regular' | 'commuter' = row.commuter ? 'commuter' : 'regular';
      const groupBucket = buckets[kind][code] || (buckets[kind][code] = {});
      const personBucket = groupBucket[row.person] || (groupBucket[row.person] = { AM: new Set<DayLetter>(), PM: new Set<DayLetter>(), roles: new Set<string>() });
      personBucket.roles.add(row.role_name);

      for (const d of keepLetters) {
        if (s === 'AM') personBucket.AM.add(d);
        else personBucket.PM.add(d);
      }
    }
  }

  // ---------- Sheet rendering ----------
  const [y, m] = monthKey.split('-').map(n => parseInt(n, 10));
  const monthDate = new Date(y, m - 1, 1);
  const titleText = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Schedule');
  ws.columns = [
    { width:26 }, { width:16 }, { width:5 }, { width:14 }, { width:2 },
    { width:26 }, { width:16 }, { width:5 }, { width:14 }, { width:2 },
    { width:26 }, { width:16 }, { width:5 }, { width:14 }
  ];

  ws.mergeCells(1,1,1,14);
  const titleCell = ws.getCell(1,1);
  titleCell.value = `Kitchen / Dining Room Schedule — ${titleText}`;
  titleCell.font = { bold: true, size: 18, name: 'Calibri' };
  titleCell.alignment = { horizontal: 'center' };

  const paneState = { kitchen1: 2, kitchen2: 2, dining: 2 } as Record<'kitchen1'|'kitchen2'|'dining', number>;

  function setRowBorders(row: any, startCol: number, endCol: number) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c);
      const border: any = { bottom: { style: 'thin' } };
      if (c === startCol) border.left = { style: 'thin' };
      if (c === endCol) border.right = { style: 'thin' };
      cell.border = border;
    }
  }

  function renderBlock(
    pane: 'kitchen1'|'kitchen2'|'dining',
    group: string,
    people: Record<string,{AM:Set<DayLetter>;PM:Set<DayLetter>;roles:Set<string>}>)
  {
    const startCol = pane==='kitchen1'?1:pane==='kitchen2'?6:11;
    if (!people || !Object.keys(people).length) return;
    const rowIndex = paneState[pane];

    // Group header
    ws.mergeCells(rowIndex, startCol, rowIndex, startCol + 3);
    const hcell = ws.getCell(rowIndex, startCol);
    hcell.value = group;
    hcell.alignment = { horizontal: 'left' };
    const fill = GROUP_INFO[group]?.color || 'FFEFEFEF';
    hcell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    // Ensure all cells in the merged range are bolded so row-level fonts from
    // other panes do not override the header styling.
    for (let c = startCol; c <= startCol + 3; c++) {
      ws.getCell(rowIndex, c).font = { bold: true, size: 18 };
    }
    setRowBorders(ws.getRow(rowIndex), startCol, startCol + 3);

    function simplifyRole(role: string): string | null {
      if (role === group) return null;
      const prefix = group + ' ';
      if (role.startsWith(prefix)) {
        return role.slice(prefix.length);
      }
      return role;
    }

    let r = rowIndex + 1;
    const names = Object.keys(people).sort((a,b)=>a.localeCompare(b));
    for (const name of names) {
      const info = people[name];

      // Days string is union across AM/PM for this group
      const daySet = new Set<DayLetter>([...info.AM, ...info.PM]);
      const dayList = DAY_ORDER.filter(d=>daySet.has(d));
      const days = dayList.length === DAY_ORDER.length ? 'Full-Time' : dayList.join('/');

      // Shift column: blank if both AM & PM somewhere in the week
      const hasAM = info.AM.size > 0;
      const hasPM = info.PM.size > 0;

      ws.getCell(r, startCol).value = name;

      const roleNames = Array.from(info.roles)
        .map(simplifyRole)
        .filter((v): v is string => Boolean(v));
      const roleText = Array.from(new Set(roleNames)).sort().join('/');
      ws.getCell(r, startCol + 1).value = roleText;

      if (hasAM && hasPM) {
        // both -> blank
      } else if (hasAM) {
        ws.getCell(r, startCol + 2).value = 'AM';
      } else if (hasPM) {
        ws.getCell(r, startCol + 2).value = 'PM';
      }

      ws.getCell(r, startCol + 3).value = days;
      // Apply font to each cell individually to avoid interfering with other
      // panes that may use the same worksheet row.
      for (let c = startCol; c <= startCol + 3; c++) {
        ws.getCell(r, c).font = { size: 16 };
      }
      setRowBorders(ws.getRow(r), startCol, startCol + 3);
      r++;
    }
    paneState[pane] = r;
  }

  function renderSection(kind: 'regular'|'commuter') {
    for (const g of KITCHEN_COL1_GROUPS) {
      const code = GROUP_INFO[g]?.code;
      if (!code) continue;
      const people = buckets[kind][code];
      if (people && Object.keys(people).length) renderBlock('kitchen1', g, people);
    }
    for (const g of KITCHEN_COL2_GROUPS) {
      const code = GROUP_INFO[g]?.code;
      if (!code) continue;
      const people = buckets[kind][code];
      if (people && Object.keys(people).length) renderBlock('kitchen2', g, people);
    }
    for (const g of DINING_GROUPS) {
      const code = GROUP_INFO[g]?.code;
      if (!code) continue;
      const people = buckets[kind][code];
      if (people && Object.keys(people).length) renderBlock('dining', g, people);
    }
  }

  // Regulars first
  renderSection('regular');

  // Insert COMMUTERS divider if needed, then render commuters
  const hasAny = (kind:'regular'|'commuter') =>
    Object.values(buckets[kind]).some(groupMap => groupMap && Object.keys(groupMap).length);

  if (hasAny('commuter')) {
    const afterRegular = Math.max(paneState.kitchen1, paneState.kitchen2, paneState.dining);
    ws.mergeCells(afterRegular,1,afterRegular,14);
    const commCell = ws.getCell(afterRegular,1);
    commCell.value = 'COMMUTERS';
    commCell.font = { bold:true, size:18 };
    commCell.alignment = { horizontal:'left' };
    commCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFEFEFEF'} };
    commCell.border = { top:{ style:'thick' } };

    paneState.kitchen1 = afterRegular + 1;
    paneState.kitchen2 = afterRegular + 1;
    paneState.dining = afterRegular + 1;

    renderSection('commuter');
  }

  // ---------- Lunch jobs sheet ----------
  const lunchDefaults = all<DefaultRow>(
    `SELECT md.person_id, md.segment,
            g.name AS group_name, r.id AS role_id, r.name AS role_name,
            (p.last_name || ', ' || p.first_name) AS person,
            p.commuter AS commuter,
            p.avail_mon, p.avail_tue, p.avail_wed, p.avail_thu, p.avail_fri,
            md.month as month
       FROM monthly_default md
      JOIN role r ON r.id = md.role_id
      JOIN grp  g ON g.id = r.group_id
      JOIN person p ON p.id = md.person_id
      WHERE ${mdMonth.where} AND p.active = 1 AND TRIM(UPPER(md.segment)) = 'LUNCH'
      ORDER BY g.name, person`,
    mdMonth.params
  );

  const lunchPerDays = all<DayRow>(
    `SELECT mdd.person_id, mdd.weekday, mdd.segment,
            g.name AS group_name, r.id AS role_id, r.name AS role_name,
            (p.last_name || ', ' || p.first_name) AS person,
            p.commuter AS commuter,
            p.avail_mon, p.avail_tue, p.avail_wed, p.avail_thu, p.avail_fri,
            mdd.month as month
       FROM monthly_default_day mdd
      JOIN role r ON r.id = mdd.role_id
      JOIN grp  g ON g.id = r.group_id
      JOIN person p ON p.id = mdd.person_id
      WHERE ${mddMonth.where} AND p.active = 1 AND TRIM(UPPER(mdd.segment)) = 'LUNCH'`,
    mddMonth.params
  );

  const lunchBuckets: LunchBuckets = { regular: {}, commuter: {} };
  const lunchPerDayMap = new Map<number, Map<DayLetter, number>>();

  for (const row of lunchPerDays) {
    const dayLetter = weekdayToLetter(row.weekday);
    if (!dayLetter) continue;
    if (!isAllowedForLunch(dayLetter, row)) continue;
    const code = GROUP_INFO[row.group_name]?.code;
    if (!code) continue;
    const kind: 'regular' | 'commuter' = row.commuter ? 'commuter' : 'regular';
    const groupBucket = lunchBuckets[kind][code] || (lunchBuckets[kind][code] = {});
    const personBucket = groupBucket[row.person] || (groupBucket[row.person] = { days: new Set<DayLetter>(), roles: new Set<string>() });
    personBucket.roles.add(row.role_name);
    personBucket.days.add(dayLetter);
    let dayMap = lunchPerDayMap.get(row.person_id);
    if (!dayMap) {
      dayMap = new Map<DayLetter, number>();
      lunchPerDayMap.set(row.person_id, dayMap);
    }
    dayMap.set(dayLetter, row.role_id);
  }

  for (const row of lunchDefaults) {
    const code = GROUP_INFO[row.group_name]?.code;
    if (!code) continue;
    const dayMap = lunchPerDayMap.get(row.person_id);
    const keepLetters: DayLetter[] = [];
    for (const d of DAY_ORDER) {
      if (!isAllowedForLunch(d, row)) continue;
      const overriddenRoleId = dayMap?.get(d);
      if (overriddenRoleId == null || overriddenRoleId === row.role_id) {
        keepLetters.push(d);
      }
    }
    if (keepLetters.length === 0) continue;
    const kind: 'regular' | 'commuter' = row.commuter ? 'commuter' : 'regular';
    const groupBucket = lunchBuckets[kind][code] || (lunchBuckets[kind][code] = {});
    const personBucket = groupBucket[row.person] || (groupBucket[row.person] = { days: new Set<DayLetter>(), roles: new Set<string>() });
    personBucket.roles.add(row.role_name);
    for (const d of keepLetters) personBucket.days.add(d);
  }

  const wsL = wb.addWorksheet('Lunch Jobs', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  wsL.columns = [
    { width: 30 }, { width: 20 }, { width: 10 }, { width: 18 }
  ];

  wsL.mergeCells(1, 1, 1, 4);
  const lunchTitle = wsL.getCell(1, 1);
  lunchTitle.value = `Lunch Jobs — ${titleText}`;
  lunchTitle.font = { bold: true, size: 18, name: 'Calibri' };
  lunchTitle.alignment = { horizontal: 'center' };

  let lunchRow = 2;

  function renderLunchBlock(group: string, people: Record<string, { days: Set<DayLetter>; roles: Set<string> }>) {
    if (!people || !Object.keys(people).length) return;
    wsL.mergeCells(lunchRow, 1, lunchRow, 4);
    const hcell = wsL.getCell(lunchRow, 1);
    hcell.value = group;
    hcell.alignment = { horizontal: 'left' };
    const fill = GROUP_INFO[group]?.color || 'FFEFEFEF';
    hcell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    for (let c = 1; c <= 4; c++) {
      wsL.getCell(lunchRow, c).font = { bold: true, size: 18 };
    }
    setRowBorders(wsL.getRow(lunchRow), 1, 4);

    function simplifyRole(role: string): string | null {
      if (role === group) return null;
      const prefix = group + ' ';
      if (role.startsWith(prefix)) {
        return role.slice(prefix.length);
      }
      return role;
    }

    let r = lunchRow + 1;
    const names = Object.keys(people).sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      const info = people[name];
      wsL.getCell(r, 1).value = name;
      const roleNames = Array.from(info.roles)
        .map(simplifyRole)
        .filter((v): v is string => Boolean(v));
      const roleText = Array.from(new Set(roleNames)).sort().join('/');
      wsL.getCell(r, 2).value = roleText;
      wsL.getCell(r, 3).value = 'Lunch';
      const dayList = DAY_ORDER.filter(d => info.days.has(d));
      const days = dayList.length === DAY_ORDER.length ? 'Full-Time' : dayList.join('/');
      wsL.getCell(r, 4).value = days;
      for (let c = 1; c <= 4; c++) {
        wsL.getCell(r, c).font = { size: 16 };
      }
      setRowBorders(wsL.getRow(r), 1, 4);
      r++;
    }
    lunchRow = r;
  }

  function renderLunchSection(kind: 'regular' | 'commuter') {
    for (const g of KITCHEN_COL1_GROUPS) {
      const code = GROUP_INFO[g]?.code;
      if (!code) continue;
      const people = lunchBuckets[kind][code];
      if (people && Object.keys(people).length) renderLunchBlock(g, people);
    }
    for (const g of KITCHEN_COL2_GROUPS) {
      const code = GROUP_INFO[g]?.code;
      if (!code) continue;
      const people = lunchBuckets[kind][code];
      if (people && Object.keys(people).length) renderLunchBlock(g, people);
    }
    for (const g of DINING_GROUPS) {
      const code = GROUP_INFO[g]?.code;
      if (!code) continue;
      const people = lunchBuckets[kind][code];
      if (people && Object.keys(people).length) renderLunchBlock(g, people);
    }
  }

  renderLunchSection('regular');

  const lunchHasAny = (kind: 'regular' | 'commuter') =>
    Object.values(lunchBuckets[kind]).some(groupMap => groupMap && Object.keys(groupMap).length);

  if (lunchHasAny('commuter')) {
    wsL.mergeCells(lunchRow, 1, lunchRow, 4);
    const commCell = wsL.getCell(lunchRow, 1);
    commCell.value = 'COMMUTERS';
    commCell.font = { bold: true, size: 18 };
    commCell.alignment = { horizontal: 'left' };
    commCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    commCell.border = { top: { style: 'thick' } };
    lunchRow += 1;

    renderLunchSection('commuter');
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const monthName = monthDate.toLocaleString('default',{ month: 'long', year: 'numeric' });
  a.download = `Kitchen-DR Schedule — ${monthName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
