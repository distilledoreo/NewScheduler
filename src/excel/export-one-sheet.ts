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

const LEFT_GROUPS = ['Veggie Room','Bakery','Main Course','Receiving','Prepack','Office'] as const;
const RIGHT_GROUPS = ['Dining Room','Machine Room'] as const;

const DAY_ORDER = ['M','T','W','TH','F'] as const;
type DayLetter = typeof DAY_ORDER[number];

type Row = { date:string; segment:'AM'|'PM'; group_name:string; person:string; commuter:number };

type Buckets = Record<'regular'|'commuter',
  Record<string, Record<string, { AM: Set<DayLetter>; PM: Set<DayLetter> }>>
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

function monthBounds(ym: string): [string,string] {
  const [y,m] = ym.split('-').map(n=>parseInt(n,10));
  const start = new Date(Date.UTC(y, m-1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const fmt = (d: Date) => d.toISOString().slice(0,10);
  return [fmt(start), fmt(end)];
}

function weekdayLetterUTC(ymd: string): DayLetter|null {
  const d = new Date(ymd + 'T00:00:00Z');
  switch (d.getUTCDay()) {
    case 1: return 'M';
    case 2: return 'T';
    case 3: return 'W';
    case 4: return 'TH';
    case 5: return 'F';
    default: return null;
  }
}

export async function exportMonthOneSheetXlsx(month: string): Promise<void> {
  requireDb();
  const ExcelJS = await loadExcelJS();

  const [startYMD, endYMD] = monthBounds(month);
  const rows = all<Row>(
    `SELECT a.date, a.segment, g.name AS group_name,
            (p.last_name || ', ' || p.first_name) AS person,
            p.commuter AS commuter
     FROM assignment a
     JOIN role r ON r.id = a.role_id
     JOIN grp g  ON g.id = r.group_id
     JOIN person p ON p.id = a.person_id
     WHERE a.date >= ? AND a.date < ? AND a.segment IN ('AM','PM')
     ORDER BY a.date, g.name, a.segment, person`,
    [startYMD, endYMD]
  );

  const buckets: Buckets = { regular: {}, commuter: {} };

  for (const row of rows) {
    const code = GROUP_TO_CODE[row.group_name];
    if (!code) continue;
    const day = weekdayLetterUTC(row.date);
    if (!day) continue;
    const kind: 'regular' | 'commuter' = row.commuter ? 'commuter' : 'regular';
    const bucket = buckets[kind][code] || (buckets[kind][code] = {});
    const person = bucket[row.person] || (bucket[row.person] = { AM: new Set(), PM: new Set() });
    person[row.segment].add(day);
  }

  const monthDate = new Date(month + '-01T00:00:00Z');
  const titleText = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Schedule');
  ws.columns = [
    { width:26 }, { width:7 }, { width:7 }, { width:14 }, { width:2 },
    { width:26 }, { width:7 }, { width:7 }, { width:14 }
  ];

  ws.mergeCells(1,1,1,9);
  const titleCell = ws.getCell(1,1);
  titleCell.value = `Kitchen / Dining Room Schedule — ${titleText}`;
  titleCell.font = { bold: true, size: 14, name: 'Calibri' };
  titleCell.alignment = { horizontal: 'center' };

  let leftRow = 2;
  let rightRow = 2;

  function setRowBorders(row: any, startCol: number, endCol: number) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c);
      const border: any = { bottom: { style: 'thin' } };
      if (c === startCol) border.left = { style: 'thin' };
      if (c === endCol) border.right = { style: 'thin' };
      cell.border = border;
    }
  }

  function renderBlock(pane: 'left'|'right', group: string, code: string, people: Record<string,{AM:Set<DayLetter>;PM:Set<DayLetter>}>){
    const startCol = pane==='left'?1:6;
    const rowIndex = pane==='left'?leftRow:rightRow;
    ws.mergeCells(rowIndex, startCol, rowIndex, startCol+3);
    const hcell = ws.getCell(rowIndex,startCol);
    hcell.value = group;
    hcell.font = { bold:true, size:12 };
    hcell.alignment = { horizontal:'left' };
    const fill = GROUP_COLORS[group] || 'FFEFEFEF';
    hcell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fill} };
    setRowBorders(ws.getRow(rowIndex), startCol, startCol+3);

    let r = rowIndex + 1;
    const names = Object.keys(people).sort((a,b)=>a.localeCompare(b));
    for (const name of names) {
      const info = people[name];
      const daySet = new Set<DayLetter>([...info.AM, ...info.PM]);
      const days = DAY_ORDER.filter(d=>daySet.has(d)).join('/');
      ws.getCell(r, startCol).value = name;
      ws.getCell(r, startCol + 1).value = info.AM.size ? code : '';
      ws.getCell(r, startCol + 2).value = info.PM.size ? code : '';
      ws.getCell(r, startCol + 3).value = days;
      setRowBorders(ws.getRow(r), startCol, startCol + 3);
      r++;
    }
    if (pane==='left') leftRow = r; else rightRow = r;
  }

  function renderSection(kind: 'regular'|'commuter') {
    for (const g of LEFT_GROUPS) {
      const code = GROUP_TO_CODE[g];
      renderBlock('left', g, code, buckets[kind][code] || {});
    }
    for (const g of RIGHT_GROUPS) {
      const code = GROUP_TO_CODE[g];
      renderBlock('right', g, code, buckets[kind][code] || {});
    }
  }

  renderSection('regular');

  const afterRegular = Math.max(leftRow, rightRow);
  ws.mergeCells(afterRegular,1,afterRegular,9);
  const commCell = ws.getCell(afterRegular,1);
  commCell.value = 'COMMUTERS';
  commCell.font = { bold:true, size:12 };
  commCell.alignment = { horizontal:'left' };
  commCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFEFEFEF'} };
  commCell.border = { top:{ style:'thick' } };

  leftRow = afterRegular + 1;
  rightRow = afterRegular + 1;

  renderSection('commuter');

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
