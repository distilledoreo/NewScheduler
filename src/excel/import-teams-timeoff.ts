import { loadExcelJS } from './exceljs-loader';

declare const sqlDb: any;
declare function all<T=any>(sql: string, params?: any[]): T[];
declare function run(sql: string, params?: any[]): void;

type PreviewRow = {
  email: string | null;
  member: string | null;
  personId: number | null;
  start: string | null;   // 'YYYY-MM-DDTHH:MM'
  end: string | null;     // 'YYYY-MM-DDTHH:MM'
  reason: string | null;
  note: string | null;
  error?: string;
};

export type TimeOffPreview = {
  rowsParsed: number;
  rowsPlanned: number;
  dateMin: string | null;
  dateMax: string | null;
  unknownEmails: Array<{ email: string, count: number }>;
  nameFallbacks: Array<{ name: string, emailMatched: string | null }>;
  badRows: Array<{ index: number, error: string }>;
  plan: Array<{ personId: number; start_ts: string; end_ts: string; reason: string; source: string }>;
};

// ----------------- utils -----------------
const NBSP = '\u00A0';
function norm(s:any): string { return String(s ?? '').replace(new RegExp(NBSP, 'g'),' ').trim(); }
function lower(s:any): string { return norm(s).toLowerCase(); }

function textFromCell(v:any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  // exceljs rich text
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text;
    if ('richText' in v && Array.isArray((v as any).richText)) {
      return (v as any).richText.map((t:any)=>t.text||'').join('');
    }
  }
  // Date will be handled elsewhere; number unlikely here
  return String(v);
}

function canon(x:any): string {
  // lower, strip non-word except spaces, collapse whitespace
  const s = textFromCell(x).toLowerCase()
    .replace(/\r?\n+/g, ' ')
    .replace(/[\u00A0\u2000-\u200B]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function hasAll(s: string, ...tokens: string[]): boolean {
  return tokens.every(t => s.includes(t));
}

// Excel serial date (1900 system). Accepts number or Date or string.
function excelSerialToDateUTC(n:number): Date {
  // Excel day 1 = 1899-12-31 in some docs; but practical: 1899-12-30 accounts for 1900 leap bug.
  const epoch = Date.UTC(1899, 11, 30);
  const ms = Math.round(n * 86400000);
  return new Date(epoch + ms);
}

function toLocalYMD(d: Date): string {
  const y = d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
  return `${y}-\${String(m).padStart(2,'0')}-\${String(day).padStart(2,'0')}`;
}
function parseExcelDate(val:any): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) return toLocalYMD(val);
  if (typeof val === 'number' && val > 1 && val < 60000) return toLocalYMD(excelSerialToDateUTC(val));
  const s = norm(val);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toLocalYMD(d);
}
function parseExcelTime(val:any): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    const hh = String(val.getHours()).padStart(2,'0');
    const mm = String(val.getMinutes()).padStart(2,'0');
    return `${hh}:\${mm}`;
  }
  if (typeof val === 'number') {
    // Excel serial fraction
    const totalMinutes = Math.round((val % 1) * 24 * 60);
    const hh = String(Math.floor(totalMinutes/60)).padStart(2,'0');
    const mm = String(totalMinutes%60).padStart(2,'0');
    return `${hh}:\${mm}`;
  }
  const s = norm(val);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (m) {
    let hh = parseInt(m[1],10);
    const mm = m[2];
    const ampm = m[3]?.toLowerCase();
    if (ampm) {
      if (ampm === 'pm' && hh < 12) hh += 12;
      if (ampm === 'am' && hh === 12) hh = 0;
    }
    return `${String(hh).padStart(2,'0')}:\${mm}`;
  }
  return null;
}
function combineLocal(ymd:string, hm:string|null, which:'start'|'end'): string {
  return `${ymd}T\${hm ?? (which==='start'?'00:00':'23:59')}`;
}

// ----------------- header detection -----------------
type HeaderCols = {
  row: number;
  member?: number|null;
  email?: number|null;
  sd?: number|null; st?: number|null;
  ed?: number|null; et?: number|null;
  reason?: number|null;
  notes?: number|null;
};

function scoreRow(ws:any, row:number): HeaderCols & { score:number } {
  const maxC = ws.columnCount || 100;
  const cols: HeaderCols = { row, member:null, email:null, sd:null, st:null, ed:null, et:null, reason:null, notes:null };
  for (let c=1;c<=maxC;c++){
    const v = canon(ws.getCell(row,c).value);
    if (!v) continue;
    if (cols.email==null   && v.includes('email')) cols.email = c;
    if (cols.member==null  && (v.includes('member') || (v.includes('name') && !v.includes('email')))) cols.member = c;
    if (cols.sd==null && (hasAll(v,'start','date') || v==='start')) cols.sd = c;
    if (cols.st==null && (hasAll(v,'start','time') || v==='start time')) cols.st = c;
    if (cols.ed==null && (hasAll(v,'end','date') || v==='end')) cols.ed = c;
    if (cols.et==null && (hasAll(v,'end','time') || v==='end time')) cols.et = c;
    if (cols.reason==null && v.includes('reason')) cols.reason = c;
    if (cols.notes==null  && (v==='notes' || v==='note')) cols.notes = c;
  }
  let score = 0;
  if (cols.sd) score++;
  if (cols.ed) score++;
  if (cols.email || cols.member) score++;
  if (cols.st) score += 0.25;
  if (cols.et) score += 0.25;
  if (cols.reason) score += 0.1;
  if (cols.notes) score += 0.1;
  return { ...cols, score };
}

function findBestSheetAndHeaders(wb:any): { ws:any; cols: HeaderCols } {
  let best: { ws:any; cols: HeaderCols & { score:number } } | null = null;
  for (const ws of wb.worksheets) {
    const maxR = Math.min(ws.rowCount || 0, 15) || 15;
    for (let r=1;r<=maxR;r++){
      const cand = scoreRow(ws, r);
      if (best == null || cand.score > best.cols.score) best = { ws, cols: cand };
    }
  }
  if (!best) throw new Error('No sheets found');
  // Debug
  console.info('[TO Import] picked sheet:', best.ws.name, 'headerRow:', best.cols.row, 'score:', best.cols.score, 'cols:', best.cols);
  const c = best.cols;
  const ok = (c.sd && c.ed && (c.email || c.member));
  if (!ok) throw new Error('Missing required headers (need Work Email or Member, Start Date, End Date).');
  const { score, ...cols } = c as any;
  return { ws: best.ws, cols };
}

// ----------------- main API -----------------
export type TimeOffPlan = Array<{ personId:number; start_ts:string; end_ts:string; reason:string; source:string }>;

export type TimeOffPreview = {
  rowsParsed: number;
  rowsPlanned: number;
  dateMin: string | null;
  dateMax: string | null;
  unknownEmails: Array<{ email: string, count: number }>;
  nameFallbacks: Array<{ name: string, emailMatched: string | null }>;
  badRows: Array<{ index: number, error: string }>;
  plan: TimeOffPlan;
};

export async function previewTeamsTimeOff(file: File): Promise<TimeOffPreview> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const { ws, cols } = findBestSheetAndHeaders(wb);

  // Build people index
  const people = all<{ id:number; last_name:string; first_name:string; work_email:string }>(
    'SELECT id, last_name, first_name, work_email FROM person'
  );
  const byEmail = new Map<string, number>();
  const byName  = new Map<string, number>();
  for (const p of people) {
    if (p.work_email) byEmail.set(lower(p.work_email), p.id);
    byName.set(`${lower(p.last_name)},\${lower(p.first_name)}`, p.id);
  }

  const previewRows: PreviewRow[] = [];
  const maxR = ws.rowCount || 10000;

  for (let r = cols.row + 1; r <= maxR; r++) {
    const vMember = cols.member ? ws.getCell(r, cols.member).value : null;
    const vEmail  = cols.email  ? ws.getCell(r, cols.email).value  : null;
    const vSD     = cols.sd     ? ws.getCell(r, cols.sd).value     : null;
    const vED     = cols.ed     ? ws.getCell(r, cols.ed).value     : null;

    // stop when these 4 fields are empty
    if (!vMember && !vEmail && !vSD && !vED) break;

    const member = norm(textFromCell(vMember)) || null;
    const email  = norm(textFromCell(vEmail))  || null;
    const startYMD = parseExcelDate(vSD);
    const endYMD   = parseExcelDate(vED);

    const row: PreviewRow = {
      email, member, personId: null, start: null, end: null,
      reason: null, note: null
    };

    if (!startYMD || !endYMD) {
      row.error = 'Bad date(s)';
      previewRows.push(row);
      continue;
    }

    const st = cols.st ? parseExcelTime(ws.getCell(r, cols.st).value) : null;
    const et = cols.et ? parseExcelTime(ws.getCell(r, cols.et).value) : null;
    const reason = cols.reason ? norm(textFromCell(ws.getCell(r, cols.reason).value)) : '';
    const note   = cols.notes  ? norm(textFromCell(ws.getCell(r, cols.notes ).value)) : '';

    // resolve person
    let personId: number | null = null;
    if (email) personId = byEmail.get(lower(email)) ?? null;
    if (!personId && member && member.includes(',')) {
      const [last, ...rest] = member.split(',');
      const key = `${lower(last)},\${lower(rest.join(','))}`;
      personId = byName.get(key) ?? null;
    }

    row.personId = personId;
    row.start = combineLocal(startYMD, st, 'start');
    row.end   = combineLocal(endYMD,   et, 'end');
    row.reason = reason;
    row.note = note;

    previewRows.push(row);
  }

  // Build plan + summary
  const unknownEmails = new Map<string, number>();
  const nameFallbacks: Array<{ name:string; emailMatched:string|null }> = [];
  const badRows: Array<{ index:number, error:string }> = [];
  const plan: TimeOffPlan = [];

  let dateMin: string | null = null, dateMax: string | null = null;

  for (let i=0;i<previewRows.length;i++){
    const r = previewRows[i];
    const excelRow = (cols.row + 1) + i;
    if (r.error) { badRows.push({ index: excelRow, error: r.error }); continue; }
    if (!r.personId) {
      if (r.email) unknownEmails.set(r.email, (unknownEmails.get(r.email)||0)+1);
      else if (r.member) nameFallbacks.push({ name:r.member, emailMatched: null });
      continue;
    }
    if (!r.start || !r.end) { badRows.push({ index: excelRow, error: 'Missing start/end' }); continue; }

    const sDay = r.start.slice(0,10), eDay = r.end.slice(0,10);
    if (!dateMin || sDay < dateMin) dateMin = sDay;
    if (!dateMax || eDay > dateMax) dateMax = eDay;

    plan.push({ personId: r.personId, start_ts: r.start, end_ts: r.end, reason: r.reason || '', source: 'TeamsImport' });
  }

  // dedupe
  const key = (x:{personId:number;start_ts:string;end_ts:string;reason:string}) => `${x.personId}|\${x.start_ts}|\${x.end_ts}|\${x.reason}`;
  const uniq = new Map<string, typeof plan[number]>();
  for (const x of plan) uniq.set(key(x), x);

  const preview: TimeOffPreview = {
    rowsParsed: previewRows.length,
    rowsPlanned: uniq.size,
    dateMin, dateMax,
    unknownEmails: Array.from(unknownEmails.entries()).map(([email, count])=>({ email, count })),
    nameFallbacks,
    badRows,
    plan: Array.from(uniq.values())
  };

  console.info('[TO Import] preview summary:', preview);
  return preview;
}

export async function applyTeamsTimeOff(plan: TimeOffPreview['plan'], opts?: { mode?: 'append'|'replace-range', from?: string, to?: string }) {
  const mode = opts?.mode ?? 'append';
  if (mode === 'replace-range') {
    const from = opts?.from ?? '0000-01-01';
    const to   = opts?.to   ?? '9999-12-31';
    run('DELETE FROM timeoff WHERE source=\'TeamsImport\' AND start_ts < ? AND end_ts > ?', [to, from]);
  }

  const existing = all<{ person_id:number; start_ts:string; end_ts:string; reason:string }>(
    "SELECT person_id, start_ts, end_ts, reason FROM timeoff WHERE source='TeamsImport'"
  );
  const seen = new Set(existing.map(e => `${e.person_id}|\${e.start_ts}|\${e.end_ts}|\${e.reason}`));

  for (const x of plan) {
    const k = `${x.personId}|\${x.start_ts}|\${x.end_ts}|\${x.reason}`;
    if (seen.has(k)) continue;
    run("INSERT INTO timeoff (person_id, start_ts, end_ts, reason, source) VALUES (?,?,?,?, 'TeamsImport')",
      [x.personId, x.start_ts, x.end_ts, x.reason]);
    seen.add(k);
  }

  (window as any).refreshCaches?.();
}
