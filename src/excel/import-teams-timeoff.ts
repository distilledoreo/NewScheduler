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
  dateMin: string | null; // 'YYYY-MM-DD'
  dateMax: string | null; // 'YYYY-MM-DD'
  unknownEmails: Array<{ email: string, count: number }>;
  nameFallbacks: Array<{ name: string, emailMatched: string | null }>;
  badRows: Array<{ index: number, error: string }>;
  plan: Array<{ personId: number; start_ts: string; end_ts: string; reason: string; source: string }>;
};

function norm(s:any){ return String(s ?? '').trim(); }
function lower(s:any){ return norm(s).toLowerCase(); }

function toLocalYMD(d: Date): string {
  // America/New_York month/day without TZ drift: build from local components
  const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate();
  const mm = String(m).padStart(2,'0'), dd = String(day).padStart(2,'0');
  return `${y}-${mm}-${dd}`;
}
function combineLocal(ymd: string, hm: string | null): string {
  const t = (hm && /^\d{1,2}:\d{2}$/.test(hm)) ? hm : (hm && /^\d{1,2}:\d{2}:\d{2}$/.test(hm) ? hm.slice(0,5) : null);
  const hhmm = t ?? '00:00';
  return `${ymd}T${hhmm}`;
}
function parseExcelDate(v:any): string | null {
  // Accept JS Date, ExcelJS serial, or string like '8/4/2025'
  if (v instanceof Date) return toLocalYMD(v);
  const s = norm(v);
  if (!s) return null;
  const d = new Date(s); // relies on browser locale; acceptable for mm/dd/yyyy in exports
  if (isNaN(d.getTime())) return null;
  return toLocalYMD(d);
}

type PersonRow = { id:number; last_name:string; first_name:string; work_email:string };
function buildPeopleIndex(){
  const people = all<PersonRow>(`SELECT id, last_name, first_name, work_email FROM person`);
  const byEmail = new Map<string, number>();
  const byName  = new Map<string, number>(); // 'last, first'
  for (const p of people) {
    if (p.work_email) byEmail.set(lower(p.work_email), p.id);
    const key = `${lower(p.last_name)},${lower(p.first_name)}`;
    byName.set(key, p.id);
  }
  return { byEmail, byName };
}

// Case-insensitive header find
function findHeaderCols(ws:any){
  const headerRow = 1;
  const want = ['Member','Work Email','Start Date','Start Time','End Date','End Time','Time Off Reason','Notes'];
  const idx: Record<string, number | null> = Object.fromEntries(want.map(k=>[k,null]));
  const maxC = ws.actualColumnCount || ws.columnCount || 50;
  for (let c=1;c<=maxC;c++){
    const cell = ws.getCell(headerRow,c);
    // ExcelJS cell.value may be objects; .text consistently exposes string view
    const v = lower((cell && 'text' in cell) ? cell.text : cell?.value);
    if (!v) continue;
    for (const k of want) if (v === lower(k)) idx[k] = c;
  }
  // minimally require Work Email or Member, plus date columns
  if ((!idx['Work Email'] && !idx['Member']) || !idx['Start Date'] || !idx['End Date']) {
    throw new Error('Missing required headers (need Work Email or Member, Start Date, End Date).');
  }
  return idx;
}

function readCell(ws:any, r:number, c:number|null): any { return c ? ws.getCell(r,c).value : null; }

function toPreviewRow(ws:any, r:number, cols:ReturnType<typeof findHeaderCols>, peopleIdx: ReturnType<typeof buildPeopleIndex>): PreviewRow {
  const member = norm(readCell(ws, r, cols['Member']));
  const email  = norm(readCell(ws, r, cols['Work Email'])) || null;
  const sdRaw  = readCell(ws, r, cols['Start Date']);
  const edRaw  = readCell(ws, r, cols['End Date']);
  const stRaw  = norm(readCell(ws, r, cols['Start Time']));
  const etRaw  = norm(readCell(ws, r, cols['End Time']));
  const reason = norm(readCell(ws, r, cols['Time Off Reason'])) || null;
  const note   = norm(readCell(ws, r, cols['Notes'])) || null;

  const startYMD = parseExcelDate(sdRaw);
  const endYMD   = parseExcelDate(edRaw);

  const row: PreviewRow = {
    email: email,
    member: member || null,
    personId: null,
    start: null,
    end: null,
    reason, note
  };

  if (!startYMD || !endYMD) {
    row.error = 'Bad date(s)';
    return row;
  }

  row.start = combineLocal(startYMD, stRaw || null);
  // Teams often uses 23:59 for end; keep it if present else 23:59
  row.end   = combineLocal(endYMD, etRaw || '23:59');

  // Prefer email match
  if (email) {
    const pid = peopleIdx.byEmail.get(lower(email));
    if (pid) { row.personId = pid; return row; }
  }
  // Fallback to "Last, First"
  if (member && member.includes(',')) {
    const key = lower(member.replace(/\s+/g,''));
    // Normalize to 'last,first'
    const parts = member.split(',');
    const last = lower(parts[0]);
    const first = lower(parts.slice(1).join(','));
    const pid = peopleIdx.byName.get(`${last},${first}`) || null;
    row.personId = pid;
    return row;
  }
  row.personId = null;
  return row;
}

export async function previewTeamsTimeOff(file: File): Promise<TimeOffPreview> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  // pick sheet named like 'Time Off' else first
  const ws = wb.worksheets.find((s:any)=> String(s.name).toLowerCase().includes('time')) || wb.worksheets[0];

  const cols = findHeaderCols(ws);
  const peopleIdx = buildPeopleIndex();

  const previewRows: PreviewRow[] = [];
  const maxR = ws.rowCount || 5000;
  for (let r=2; r<=maxR; r++){
    const anyVal = [cols['Member'], cols['Work Email'], cols['Start Date'], cols['End Date']]
      .some(c => !!readCell(ws, r, c));
    if (!anyVal) break;

    const pr = toPreviewRow(ws, r, cols, peopleIdx);
    // skip rows that have neither person nor parsable times
    if (!pr.personId && !pr.error && pr.email) {
      // remains unknown email; still include in preview
    }
    previewRows.push(pr);
  }

  // Build plan
  const plan: Array<{ personId:number; start_ts:string; end_ts:string; reason:string; source:string }> = [];
  const badRows: Array<{ index:number; error:string }> = [];
  const unknownEmailCounts = new Map<string, number>();
  const nameFallbacks: Array<{ name:string; emailMatched:string|null }> = [];

  let dateMin: string | null = null, dateMax: string | null = null;

  for (let i=0;i<previewRows.length;i++){
    const r = previewRows[i];
    if (r.error) { badRows.push({ index:i+2, error:r.error }); continue; } // Excel row number
    if (!r.personId) {
      if (r.email) unknownEmailCounts.set(r.email, (unknownEmailCounts.get(r.email)||0)+1);
      else if (r.member) nameFallbacks.push({ name:r.member, emailMatched:null });
      continue;
    }
    if (!r.start || !r.end) { badRows.push({ index:i+2, error:'Missing start/end' }); continue; }

    const startDate = r.start.slice(0,10), endDate = r.end.slice(0,10);
    if (!dateMin || startDate < dateMin) dateMin = startDate;
    if (!dateMax || endDate > dateMax)   dateMax = endDate;

    plan.push({
      personId: r.personId,
      start_ts: r.start,
      end_ts: r.end,
      reason: r.reason || '',
      source: 'TeamsImport'
    });
  }

  // Deduplicate identical entries
  const key = (x:{personId:number;start_ts:string;end_ts:string;reason:string}) => `${x.personId}|${x.start_ts}|${x.end_ts}|${x.reason}`;
  const uniqMap = new Map<string, typeof plan[number]>();
  for (const x of plan) uniqMap.set(key(x), x);
  const uniqPlan = Array.from(uniqMap.values());

  const unknownEmails = Array.from(unknownEmailCounts.entries()).map(([email,count])=>({ email, count }));

  return {
    rowsParsed: previewRows.length,
    rowsPlanned: uniqPlan.length,
    dateMin, dateMax,
    unknownEmails,
    nameFallbacks,
    badRows,
    plan: uniqPlan
  };
}

export async function applyTeamsTimeOff(plan: TimeOffPreview['plan'], opts?: { mode?: 'append'|'replace-range', from?: string, to?: string }) {
  const mode = opts?.mode ?? 'append';
  if (mode === 'replace-range') {
    const from = opts?.from ?? '0000-01-01';
    const to   = opts?.to   ?? '9999-12-31';
    run(`DELETE FROM timeoff WHERE source='TeamsImport' AND start_ts < ? AND end_ts > ?`, [to, from]);
  }

  // Insert with dedupe check
  const existing = all<{ person_id:number; start_ts:string; end_ts:string; reason:string }>(
    `SELECT person_id, start_ts, end_ts, reason FROM timeoff WHERE source='TeamsImport'`
  );
  const seen = new Set(existing.map(e=>`${e.person_id}|${e.start_ts}|${e.end_ts}|${e.reason}`));

  for (const x of plan) {
    const k = `${x.personId}|${x.start_ts}|${x.end_ts}|${x.reason}`;
    if (seen.has(k)) continue;
    run(`INSERT INTO timeoff (person_id, start_ts, end_ts, reason, source) VALUES (?,?,?,?, 'TeamsImport')`,
        [x.personId, x.start_ts, x.end_ts, x.reason]);
    seen.add(k);
  }

  (window as any).refreshCaches?.();
}
