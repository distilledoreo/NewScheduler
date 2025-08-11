import { loadExcelJS } from './exceljs-loader';

// Local SQL helpers
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

function run(sql: string, params: any[] = []): void {
  const db = requireDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

export type ImportPreview = {
  months: string[];
  matchedPeople: number;
  unmatchedNames: string[];
  unknownCodes: Array<{ code: string; count: number }>;
  plan: Array<{ month: string; personId: number; segment: 'AM' | 'PM' | 'Lunch'; roleId: number }>;
};

type Target = { group: string; role: string; segment: 'AM' | 'PM' | 'Lunch' | 'Both' };
const CODE_MAP: Record<string, Target> = {
  // Dining Room (Both → write AM+PM)
  DR: { group: 'Dining Room', role: 'Buffet', segment: 'Both' },
  'DR-A': { group: 'Dining Room', role: 'Buffet Assistant', segment: 'Both' },
  'DR-S': { group: 'Dining Room', role: 'Buffet Sup', segment: 'Both' },
  'DR-PTRN': { group: 'Dining Room', role: 'Pattern', segment: 'Both' },
  PTRN: { group: 'Dining Room', role: 'Pattern', segment: 'Both' },

  // Main Course
  MC: { group: 'Main Course', role: 'Main Course', segment: 'Both' },
  'MC-A': { group: 'Main Course', role: 'Main Course Assistant', segment: 'Both' },
  'MC-C': { group: 'Main Course', role: 'Main Course Coordinator', segment: 'Both' },

  // Veggie Room
  VEG: { group: 'Veggie Room', role: 'Veggie Room', segment: 'Both' },
  'VEG-A': { group: 'Veggie Room', role: 'Veggie Room Assistant', segment: 'Both' },
  'VEG-C': { group: 'Veggie Room', role: 'Veggie Room Coordinator', segment: 'Both' },

  // Machine Room
  MRC: { group: 'Machine Room', role: 'MRC', segment: 'Both' },
  'MR-MRA': { group: 'Machine Room', role: 'MR Assist', segment: 'Both' },
  'MR-HE1': { group: 'Machine Room', role: 'Hot End 1', segment: 'Both' },
  'MR-HE2': { group: 'Machine Room', role: 'Hot End 2', segment: 'Both' },
  'MR-CE': { group: 'Machine Room', role: 'Cold End', segment: 'Both' },
  'MR-FEED': { group: 'Machine Room', role: 'Feeder', segment: 'Both' },
  'MR-SVW': { group: 'Machine Room', role: 'Silverware', segment: 'Both' },

  // Bakery, Receiving, Prepack, Office
  BKRY: { group: 'Bakery', role: 'Bakery', segment: 'Both' },
  'BKRY-A': { group: 'Bakery', role: 'Bakery Assistant', segment: 'Both' },
  'BKRY-C': { group: 'Bakery', role: 'Bakery Coordinator', segment: 'Both' },
  RCVG: { group: 'Receiving', role: 'Receiving', segment: 'Both' },
  PREPACK: { group: 'Prepack', role: 'Prepack', segment: 'Both' },
  'PRE-PACK': { group: 'Prepack', role: 'Prepack', segment: 'Both' },
  OFF: { group: 'Office', role: 'Office', segment: 'Both' },
  KT: { group: 'Office', role: 'Office', segment: 'Both' },
  FLOAT: { group: 'Office', role: 'Office', segment: 'Both' },

  // Lunch (Lunch only)
  'L SUP': { group: 'Lunch', role: 'Lunch Supervisor', segment: 'Lunch' },
  'B SUP': { group: 'Lunch', role: 'Buffet Supervisor', segment: 'Lunch' },
  'R SUP': { group: 'Lunch', role: 'Guest Supervisor', segment: 'Lunch' },
  'ATT SUP': { group: 'Lunch', role: 'Attendant Supervisor', segment: 'Lunch' },
  TL1: { group: 'Lunch', role: 'Tray Line', segment: 'Lunch' },
  TL2: { group: 'Lunch', role: 'Tray Line', segment: 'Lunch' },
  TL3: { group: 'Lunch', role: 'Tray Line', segment: 'Lunch' },
  ATR: { group: 'Lunch', role: 'ATR', segment: 'Lunch' },
  TKO: { group: 'Lunch', role: 'Take-Out Line', segment: 'Lunch' },
  ATK: { group: 'Lunch', role: 'Assist Take-Out Line', segment: 'Lunch' },
  ATKO: { group: 'Lunch', role: 'Assist Take-Out Line', segment: 'Lunch' },
  WAITER: { group: 'Lunch', role: 'Waiter', segment: 'Lunch' },
  'CK-IN': { group: 'Lunch', role: 'Guest Check-In', segment: 'Lunch' },
  'LN ATT': { group: 'Lunch', role: 'Line Attendant', segment: 'Lunch' },
  ATT: { group: 'Lunch', role: 'Attendant', segment: 'Lunch' },
  EBO: { group: 'Lunch', role: 'Mt.Ebo', segment: 'Lunch' },

  // Ignore
  AM: { group: '', role: '', segment: 'Both' },
  PM: { group: '', role: '', segment: 'Both' },
  BFST: { group: '', role: '', segment: 'Both' },
  'BFST-A': { group: '', role: '', segment: 'Both' },
  'BFST-C': { group: '', role: '', segment: 'Both' },
  BREAKFAST: { group: '', role: '', segment: 'Both' }
};

type RoleRow = { id: number; role_name: string; group_name: string };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeCode(cellString: string): string {
  let s = (cellString || '').toUpperCase();
  s = s.replace(/_/g, '-');
  s = s.replace(/\s*-\s*/g, '-');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/,+$/, '');
  if (s.includes('/')) s = s.split('/')[0];
  return s.trim();
}

function resolveRoleId(roles: RoleRow[], group: string, role: string): number | null {
  for (const r of roles) {
    if (r.group_name.toLowerCase() === group.toLowerCase() &&
        r.role_name.toLowerCase() === role.toLowerCase()) return r.id;
  }
  return null;
}

export async function previewTrainingChart(file: File): Promise<ImportPreview> {
  requireDb();
  const ExcelJS = await loadExcelJS();
  const data = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const people = all<{ id: number; last_name: string; first_name: string }>(
    'SELECT id, last_name, first_name FROM person'
  );
  const peopleIndex = new Map<string, number>();
  for (const p of people) {
    peopleIndex.set(norm(`${p.last_name},${p.first_name}`), p.id);
  }

  const roles = all<RoleRow>(
    `SELECT r.id, r.name AS role_name, g.name AS group_name FROM role r JOIN grp g ON g.id=r.group_id`
  );

  const monthsSet = new Set<string>();
  const unmatchedNames = new Set<string>();
  const matchedPeople = new Set<number>();
  const unknownCodes = new Map<string, number>();
  const planMap = new Map<string, { month: string; personId: number; segment: 'AM' | 'PM' | 'Lunch'; roleId: number }>();
  const overrides: Record<string, number> = (window as any).__nameOverrides || {};

  wb.eachSheet((sheet: any) => {
    const name = String(sheet.name || '').toLowerCase();
    if (!(name.includes('kitchen') || name.includes('dining') || name.includes('commuter'))) return;

    const header = sheet.getRow(1);
    const monthsByCol = new Map<number, string>();
    header.eachCell({ includeEmpty: false }, (cell: any, col: number) => {
      if (col < 2) return;
      const raw = cell.value;
      const date = new Date(raw);
      if (!raw || isNaN(date.getTime())) return;
      const month = date.toISOString().slice(0, 7);
      if (!monthsByCol.has(col)) monthsByCol.set(col, month);
      monthsSet.add(month);
    });

    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber < 2) return;
      const nameCell = row.getCell(1).text || row.getCell(1).value || '';
      const nameText = String(nameCell).trim();
      if (!nameText) return;
      const nameParts = nameText.split(/\s*\/\s*|\s*&\s*/);
      const personIds: number[] = [];
      for (const part of nameParts) {
        const n = norm(part);
        let pid = peopleIndex.get(n);
        if (!pid) {
          pid = overrides[n];
        }
        if (pid) {
          personIds.push(pid);
          matchedPeople.add(pid);
        } else {
          unmatchedNames.add(part.trim());
        }
      }
      if (!personIds.length) return;

      monthsByCol.forEach((month, col) => {
        const raw = row.getCell(col).text || row.getCell(col).value;
        const code = normalizeCode(String(raw || ''));
        if (!code) return;
        const target = CODE_MAP[code];
        if (!target) {
          unknownCodes.set(code, (unknownCodes.get(code) || 0) + 1);
          return;
        }
        if (!target.group || !target.role) return; // ignored codes
        const roleId = resolveRoleId(roles, target.group, target.role);
        if (!roleId) return;
        const segments = target.segment === 'Both' ? ['AM', 'PM'] : ['Lunch'];
        for (const personId of personIds) {
          for (const segment of segments) {
            const key = `${month}|${personId}|${segment}`;
            planMap.set(key, { month, personId, segment: segment as 'AM' | 'PM' | 'Lunch', roleId });
          }
        }
      });
    });
  });

  const months = Array.from(monthsSet).sort();
  const plan = Array.from(planMap.values());
  const unknownList = Array.from(unknownCodes.entries()).map(([code, count]) => ({ code, count }));

  console.log('Import preview', { months: months.length, upserts: plan.length, unknownCodes: unknownList });

  return {
    months,
    matchedPeople: matchedPeople.size,
    unmatchedNames: Array.from(unmatchedNames).sort(),
    unknownCodes: unknownList,
    plan,
  };
}

export async function applyTrainingChart(plan: ImportPreview['plan']): Promise<void> {
  requireDb();
  for (const { month, personId, segment, roleId } of plan) {
    run(
      `INSERT INTO monthly_default (month, person_id, segment, role_id) VALUES (?,?,?,?)
       ON CONFLICT(month, person_id, segment) DO UPDATE SET role_id=excluded.role_id`,
      [month, personId, segment, roleId]
    );
  }
}
