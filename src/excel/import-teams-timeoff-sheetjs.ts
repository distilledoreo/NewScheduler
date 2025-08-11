import { loadXLSX } from './sheetjs-loader';

// Bridge to your existing DB helpers (or import from your module)
const W: any = window as any;
const all: <T=any>(sql: string, params?: any[]) => T[] = W.all;
const run: (sql: string, params?: any[]) => void = W.run;

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

// --- utils ---
const NBSP = '\u00A0';
const norm = (s:any) => String(s ?? '').replace(new RegExp(NBSP,'g'),' ').trim();
const lower = (s:any) => norm(s).toLowerCase();

function excelSerialToDateUTC(n:number): Date {
  const epoch = Date.UTC(1899, 11, 30); // Excel 1900 system
  return new Date(epoch + Math.round(n*86400000));
}
function toLocalYMD(d: Date): string {
  const y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
  return y + '-' + String(m).padStart(2,'0') + '-' + String(day).padStart(2,'0');
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
    return hh + ':' + mm;
  }
  if (typeof val === 'number') {
    const totalMinutes = Math.round((val % 1) * 24 * 60);
    const hh = String(Math.floor(totalMinutes/60)).padStart(2,'0');
    const mm = String(totalMinutes%60).padStart(2,'0');
    return hh + ':' + mm;
  }
  const s = norm(val);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (m) {
    let hh = parseInt(m[1],10);
    const mm = m[2];
    const ap = m[3]?.toLowerCase();
    if (ap) { if (ap==='pm' && hh<12) hh+=12; if (ap==='am' && hh===12) hh=0; }
    return String(hh).padStart(2,'0') + ':' + mm;
  }
  return null;
}
function combineLocal(ymd:string, hm:string|null, which:'start'|'end'): string {
  return ymd + 'T' + (hm ?? (which==='start' ? '00:00' : '23:59'));
}

// --- header detection on a 2D array ---
type HeaderCols = {
  row: number;
  member?: number|null;
  email?: number|null;
  sd?: number|null; st?: number|null;
  ed?: number|null; et?: number|null;
  reason?: number|null;
  notes?: number|null;
};
const canon = (x:any) => String(x ?? '')
  .toLowerCase()
  .replace(/\r?\n+/g,' ')
  .replace(/\s+/g,' ')
  .replace(/[^\p{L}\p{N} ]+/gu,' ')
  .trim();

function scoreHeaderRow(row: any[]): (HeaderCols & {score:number}) {
  const cols: HeaderCols = { row: -1, member:null, email:null, sd:null, st:null, ed:null, et:null, reason:null, notes:null };
  for (let c=0;c<row.length;c++){
    const v = canon(row[c]);
    if (!v) continue;
    if (cols.email==null   && v.includes('email')) cols.email = c;
    if (cols.member==null  && (v.includes('member') || (v.includes('name') && !v.includes('email')))) cols.member = c;
    if (cols.sd==null && (v.includes('start date') || v==='start')) cols.sd = c;
    if (cols.st==null && (v.includes('start time') || v==='start time')) cols.st = c;
    if (cols.ed==null && (v.includes('end date') || v==='end')) cols.ed = c;
    if (cols.et==null && (v.includes('end time') || v==='end time')) cols.et = c;
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

function findBestHeader(rows: any[][]): { headerRow: number; cols: HeaderCols } {
  let best: { headerRow:number; cols: HeaderCols & {score:number} } | null = null;
  const scanRows = Math.min(rows.length, 15);
  for (let r=0;r<scanRows;r++){
    const cand = scoreHeaderRow(rows[r]);
    cand.row = r;
    if (!best || cand.score > best.cols.score) best = { headerRow:r, cols:cand };
  }
  if (!best) throw new Error('No data found');
  const ok = (best.cols.sd != null) && (best.cols.ed != null) && (best.cols.email != null || best.cols.member != null);
  console.info('[TO Import][SheetJS] headerRow:', best.headerRow, 'score:', best.cols.score, 'cols:', best.cols);
  if (!ok) throw new Error('Missing required headers (need Work Email or Member, Start Date, End Date).');
  const { score, ...cols } = best.cols as any;
  return { headerRow: best.headerRow, cols };
}

// --- main API ---
export async function previewTeamsTimeOff(file: File): Promise<TimeOffPreview> {
  const XLSX = await loadXLSX();
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type:'array', cellDates:true, raw:true });

  // pick the sheet with "time" in name, else first
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('time')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, blankrows:false });

  const { headerRow, cols } = findBestHeader(aoa);

  // Build people index
  const people = all<{ id:number; last_name:string; first_name:string; work_email:string }>(
    'SELECT id, last_name, first_name, work_email FROM person'
  );
  const byEmail = new Map<string, number>();
  const byName  = new Map<string, number>();
  for (const p of people) {
    if (p.work_email) byEmail.set(lower(p.work_email), p.id);
    byName.set(lower(p.last_name) + ',' + lower(p.first_name), p.id);
  }

  const previewRows: PreviewRow[] = [];
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const vMember = cols.member!=null ? row[cols.member] : null;
    const vEmail  = cols.email !=null ? row[cols.email ] : null;
    const vSD     = cols.sd    !=null ? row[cols.sd    ] : null;
    const vED     = cols.ed    !=null ? row[cols.ed    ] : null;

    if (!vMember && !vEmail && !vSD && !vED) break;

    const member = norm(vMember) || null;
    const email  = norm(vEmail)  || null;
    const startYMD = parseExcelDate(vSD);
    const endYMD   = parseExcelDate(vED);

    const pr: PreviewRow = { email, member, personId:null, start:null, end:null, reason:null, note:null };

    if (!startYMD || !endYMD) { pr.error='Bad date(s)'; previewRows.push(pr); continue; }

    const st = cols.st!=null ? parseExcelTime(row[cols.st]) : null;
    const et = cols.et!=null ? parseExcelTime(row[cols.et]) : null;
    const reason = cols.reason!=null ? norm(row[cols.reason]) : '';
    const note   = cols.notes !=null ? norm(row[cols.notes ]) : '';

    // resolve person
    let pid: number | null = null;
    if (email) pid = byEmail.get(lower(email)) ?? null;
    if (!pid && member && member.includes(',')) {
      const [last, ...rest] = member.split(',');
      pid = byName.get(lower(last) + ',' + lower(rest.join(','))) ?? null;
    }

    pr.personId = pid;
    pr.start = combineLocal(startYMD, st, 'start');
    pr.end   = combineLocal(endYMD,   et, 'end');
    pr.reason = reason;
    pr.note   = note;

    previewRows.push(pr);
  }

  // Build plan + summary
  const unknownEmails = new Map<string, number>();
  const nameFallbacks: Array<{ name:string; emailMatched:string|null }> = [];
  const badRows: Array<{ index:number, error:string }> = [];
  const plan: Array<{ personId:number; start_ts:string; end_ts:string; reason:string; source:string }> = [];

  let dateMin: string | null = null, dateMax: string | null = null;

  for (let i=0;i<previewRows.length;i++){
    const r = previewRows[i];
    const excelRow = (headerRow + 2) + i; // 1-based for users
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

  // Dedupe
  const key = (x:{personId:number;start_ts:string;end_ts:string;reason:string}) => [x.personId,x.start_ts,x.end_ts,x.reason].join('|');
  const uniq = new Map<string, typeof plan[number]>();
  for (const x of plan) uniq.set(key(x), x);

  const preview: TimeOffPreview = {
    rowsParsed: previewRows.length,
    rowsPlanned: uniq.size,
    dateMin, dateMax,
    unknownEmails: Array.from(unknownEmails.entries()).map(([email,count])=>({email,count})),
    nameFallbacks,
    badRows,
    plan: Array.from(uniq.values())
  };

  console.info('[TO Import][SheetJS] preview summary:', preview);
  return preview;
}

export async function applyTeamsTimeOff(plan: TimeOffPreview['plan'], opts?: { mode?: 'append'|'replace-range', from?: string, to?: string }) {
  const mode = opts?.mode ?? 'append';
  if (mode === 'replace-range') {
    const from = opts?.from ?? '0000-01-01';
    const to   = opts?.to   ?? '9999-12-31';
    run(`DELETE FROM timeoff WHERE source='TeamsImport' AND start_ts < ? AND end_ts > ?`, [to, from]);
  }

  const existing = all<{ person_id:number; start_ts:string; end_ts:string; reason:string }>(
    `SELECT person_id, start_ts, end_ts, reason FROM timeoff WHERE source='TeamsImport'`
  );
  const seen = new Set(existing.map(e => [e.person_id,e.start_ts,e.end_ts,e.reason].join('|')));

  for (const x of plan) {
    const k = [x.personId,x.start_ts,x.end_ts,x.reason].join('|');
    if (seen.has(k)) continue;
    run(`INSERT INTO timeoff (person_id, start_ts, end_ts, reason, source) VALUES (?,?,?,?, 'TeamsImport')`,
        [x.personId, x.start_ts, x.end_ts, x.reason]);
    seen.add(k);
  }

  (window as any).refreshCaches?.();
}
