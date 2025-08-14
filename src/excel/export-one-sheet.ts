import { loadExcelJS } from './exceljs-loader';

const GROUP_TO_CODE: Record<string, string> = {
  'Dining Room': 'DR',
  'Buffet': 'DR',
  'Pattern': 'DR',
  'Main Course': 'MC',
  'Veggie Room': 'VEG',
  'Machine Room': 'MR',
  'Bakery': 'BKRY',
  'Prepack': 'PREPACK',
  'Receiving': 'RCVG',
  'Office': 'OFF'
};

const GROUP_COLORS: Record<string,string> = {
  'Veggie Room':   'FFD8E4BC',
  'Bakery':        'FFEAD1DC',
  'Receiving':     'FFBDD7EE',
  'Prepack':       'FFCCE5FF',
  'Dining Room':   'FFFFF2CC',
  'Machine Room':  'FFD9D2E9',
  'Main Course':   'FFF4CCCC',
  'Office':        'FFFFF2CC'
};

const KITCHEN_COL1_GROUPS = ['Veggie Room','Bakery'] as const;
const KITCHEN_COL2_GROUPS = ['Main Course','Receiving','Prepack','Office'] as const;
const DINING_GROUPS = ['Dining Room','Machine Room'] as const;

const DAY_ORDER = ['M','T','W','TH','F'] as const;
type DayLetter = typeof DAY_ORDER[number];

type DefaultRow = {
  person_id: number;
  segment: 'AM'|'PM';
  group_name: string;
  role_id: number;
  role_name: string;
  person: string;
  commuter: number;
};

type DayRow = {
  person_id: number;
  weekday: number; // 1..5 => M..F
  segment: 'AM'|'PM';
  group_name: string;
  role_id: number;
  role_name: string;
  person: string;
  commuter: number;
};

type Buckets = Record<'regular'|'commuter',
  Record<string, Record<string, { AM: Set<DayLetter>; PM: Set<DayLetter>; roles: Set<string> }>>
>;

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

export async function exportMonthOneSheetXlsx(month: string): Promise<void> {
  requireDb();
  const ExcelJS = await loadExcelJS();

  // Base monthly defaults (role-level assignment exists)
  const defaults = all<DefaultRow>(
    `SELECT md.person_id, md.segment,
            g.name AS group_name, r.id AS role_id, r.name AS role_name,
            (p.last_name || ', ' || p.first_name) AS person,
            p.commuter AS commuter
       FROM monthly_default md
       JOIN role r ON r.id = md.role_id
       JOIN grp  g ON g.id = r.group_id
       JOIN person p ON p.id = md.person_id
      WHERE md.month = ? AND md.segment IN ('AM','PM')
      ORDER BY g.name, md.segment, person`,
    [month]
  );

  // Per-day assignments override the implicit full-time behavior
  const perDays = all<DayRow>(
    `SELECT mdd.person_id, mdd.weekday, mdd.segment,
            g.name AS group_name, r.id AS role_id, r.name AS role_name,
            (p.last_name || ', ' || p.first_name) AS person,
            p.commuter AS commuter
       FROM monthly_default_day mdd
       JOIN role r ON r.id = mdd.role_id
       JOIN grp  g ON g.id = r.group_id
       JOIN person p ON p.id = mdd.person_id
      WHERE mdd.month = ? AND mdd.segment IN ('AM','PM')`,
    [month]
  );

  const buckets: Buckets = { regular: {}, commuter: {} };

  // Tracks which (person, role, segment) have explicit per-day rows
  const hasPerDay = new Set<string>();
  const perDayKey = (pid:number, rid:number, seg:'AM'|'PM') => `${pid}|${rid}|${seg}`;

  // 1) Populate buckets from explicit per-day assignments
  for (const row of perDays) {
    const code = GROUP_TO_CODE[row.group_name];
    if (!code) continue;
    const kind: 'regular' | 'commuter' = row.commuter ? 'commuter' : 'regular';
    const bucket = buckets[kind][code] || (buckets[kind][code] = {});
    const person = bucket[row.person] || (bucket[row.person] = { AM: new Set<DayLetter>(), PM: new Set<DayLetter>(), roles: new Set<string>() });
    person.roles.add(row.role_name);

    const dayLetter = DAY_ORDER[row.weekday - 1];
    if (!dayLetter) continue;

    if (row.segment === 'AM') person.AM.add(dayLetter);
    else person.PM.add(dayLetter);

    hasPerDay.add(perDayKey(row.person_id, row.role_id, row.segment));
  }

  // 2) For defaults *without* any per-day rows: treat as full-time (Mon–Fri)
  for (const row of defaults) {
    const code = GROUP_TO_CODE[row.group_name];
    if (!code) continue;
    const key = perDayKey(row.person_id, row.role_id, row.segment);
    if (hasPerDay.has(key)) continue; // per-day rows define the truth for this role+segment

    const kind: 'regular' | 'commuter' = row.commuter ? 'commuter' : 'regular';
    const bucket = buckets[kind][code] || (buckets[kind][code] = {});
    const person = bucket[row.person] || (bucket[row.person] = { AM: new Set<DayLetter>(), PM: new Set<DayLetter>(), roles: new Set<string>() });
    person.roles.add(row.role_name);

    for (const d of DAY_ORDER) {
      if (row.segment === 'AM') person.AM.add(d);
      else person.PM.add(d);
    }
  }

  const [y, m] = month.split('-').map(n => parseInt(n, 10));
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

  const paneState = {
    kitchen1: 2,
    kitchen2: 2,
    dining: 2,
  } as Record<'kitchen1'|'kitchen2'|'dining', number>;

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
    ws.mergeCells(rowIndex, startCol, rowIndex, startCol+3);
    const hcell = ws.getCell(rowIndex,startCol);
    hcell.value = group;
    hcell.font = { bold:true, size:18 };
    hcell.alignment = { horizontal:'left' };
    const fill = GROUP_COLORS[group] || 'FFEFEFEF';
    hcell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fill} };
    setRowBorders(ws.getRow(rowIndex), startCol, startCol+3);

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
      const daySet = new Set<DayLetter>([...info.AM, ...info.PM]);
      const dayList = DAY_ORDER.filter(d=>daySet.has(d));
      const days = dayList.length === DAY_ORDER.length ? 'Full-Time' : dayList.join('/');

      const hasAM = info.AM.size > 0;
      const hasPM = info.PM.size > 0;

      ws.getCell(r, startCol).value = name;

      const roleNames = Array.from(info.roles)
        .map(simplifyRole)
        .filter((v): v is string => Boolean(v));
      const roleText = Array.from(new Set(roleNames)).sort().join('/');
      ws.getCell(r, startCol + 1).value = roleText;

      if (hasAM && hasPM) {
        // both shifts in the week -> leave blank per original behavior
      } else if (hasAM) {
        ws.getCell(r, startCol + 2).value = 'AM';
      } else if (hasPM) {
        ws.getCell(r, startCol + 2).value = 'PM';
      }

      ws.getCell(r, startCol + 3).value = days;
      ws.getRow(r).font = { size:16 };
      setRowBorders(ws.getRow(r), startCol, startCol + 3);
      r++;
    }
    paneState[pane] = r;
  }

  function renderSection(kind: 'regular'|'commuter') {
    for (const g of KITCHEN_COL1_GROUPS) {
      const code = GROUP_TO_CODE[g];
      const people = buckets[kind][code];
      if (people && Object.keys(people).length)
        renderBlock('kitchen1', g, people);
    }
    for (const g of KITCHEN_COL2_GROUPS) {
      const code = GROUP_TO_CODE[g];
      const people = buckets[kind][code];
      if (people && Object.keys(people).length)
        renderBlock('kitchen2', g, people);
    }
    for (const g of DINING_GROUPS) {
      const code = GROUP_TO_CODE[g];
      const people = buckets[kind][code];
      if (people && Object.keys(people).length)
        renderBlock('dining', g, people);
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
