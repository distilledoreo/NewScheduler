import * as React from "react";
import { Button, Input, Dropdown, Option, Table, TableHeader, TableHeaderCell, TableRow, TableBody, TableCell, makeStyles, tokens, Textarea, Tooltip } from "@fluentui/react-components";

interface TimeOffManagerProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
}

const XLSX_URL = "https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs";
async function loadXLSX(){
  // @ts-ignore
  const mod = await import(/* @vite-ignore */ XLSX_URL);
  return mod as any;
}

function parseMDY(str: string): Date {
  const [m, d, y] = String(str).split("/").map((s) => parseInt(String(s).trim(), 10));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}
function parseTime(s: string): { h: number; m: number } {
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return { h: 0, m: 0 };
  let hh = parseInt(m[1], 10) || 0;
  const mm = parseInt(m[2] || "0", 10) || 0;
  const ampm = m[3]?.toUpperCase();
  if (ampm === "AM") { if (hh === 12) hh = 0; }
  if (ampm === "PM") { if (hh !== 12) hh += 12; }
  return { h: hh, m: mm };
}

function combineDateTime(dateStr: string, timeStr: string): Date {
  const d = parseMDY(dateStr);
  const { h, m } = parseTime(timeStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
}

const useStyles = makeStyles({
  root: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, padding: tokens.spacingHorizontalM, backgroundColor: tokens.colorNeutralBackground1 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacingVerticalM },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM },
  col3: { gridColumn: 'span 3' },
  col4: { gridColumn: 'span 4' },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  status: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  tableWrap: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, overflow: 'auto', maxHeight: '40vh' },
});

export default function TimeOffManager({ all, run, refresh }: TimeOffManagerProps){
  const s = useStyles();
  const [status, setStatus] = React.useState<string>("");

  const people = React.useMemo(() => all(`SELECT id, first_name, last_name, work_email FROM person WHERE active=1 ORDER BY last_name, first_name`), [all]);
  const [addPersonId, setAddPersonId] = React.useState<number | null>(people[0]?.id ?? null);
  const [addStartDate, setAddStartDate] = React.useState<string>("");
  const [addStartTime, setAddStartTime] = React.useState<string>("08:00");
  const [addEndDate, setAddEndDate] = React.useState<string>("");
  const [addEndTime, setAddEndTime] = React.useState<string>("17:00");
  const [addReason, setAddReason] = React.useState<string>("");

  const rows = React.useMemo(() => all(`SELECT t.id, t.person_id, t.start_ts, t.end_ts, t.reason, p.first_name, p.last_name, p.work_email FROM timeoff t JOIN person p ON p.id=t.person_id ORDER BY t.start_ts DESC LIMIT 200`), [all]);

  async function handleImportXlsx(file: File){
    try{
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!data.length){ setStatus('No rows found in the file.'); return; }

      // Build email -> id map
      const emailMap = new Map<string, number>();
      for (const p of people){ emailMap.set(String(p.work_email||'').toLowerCase(), p.id); }

      // Column resolvers (case-insensitive)
      const col = (row: any, names: string[]) => {
        for (const n of names){
          const k = Object.keys(row).find(h => h.toLowerCase() === n.toLowerCase());
          if (k) return row[k];
        }
        return '';
      };

      let count = 0, skipped = 0;
      for (const r of data){
        const email = String(col(r, ['Work Email','Email','WorkEmail'])).toLowerCase();
        const pid = emailMap.get(email);
        if (!pid){ skipped++; continue; }
        const sd = String(col(r, ['Start Date','Start']));
        const st = String(col(r, ['Start Time','StartTime']));
        const ed = String(col(r, ['End Date','End']));
        const et = String(col(r, ['End Time','EndTime']));
        const reason = String(col(r, ['Time Off Reason','Reason','Notes']));
        if (!sd || !ed){ skipped++; continue; }
        const start = combineDateTime(sd, st);
        const end = combineDateTime(ed, et);
        if (!(start instanceof Date) || isNaN(start.getTime()) || !(end instanceof Date) || isNaN(end.getTime())){ skipped++; continue; }
        run(`INSERT INTO timeoff (person_id, start_ts, end_ts, reason, source) VALUES (?,?,?,?,?)`, [pid, start.toISOString(), end.toISOString(), reason, 'ImportXLSX']);
        count++;
      }
      refresh();
      setStatus(`Imported ${count} time-off rows. Skipped ${skipped}.`);
    }catch(e:any){
      console.error(e);
      setStatus(`Time-off import failed: ${e?.message||e}`);
    }
  }

  function addManual(){
    if (!addPersonId || !addStartDate || !addEndDate){ setStatus('Please fill person, start and end.'); return; }
    const sdt = combineDateTime(addStartDate, addStartTime||'00:00');
    const edt = combineDateTime(addEndDate, addEndTime||'23:59');
    if (edt <= sdt){ setStatus('End must be after Start.'); return; }
    run(`INSERT INTO timeoff (person_id, start_ts, end_ts, reason, source) VALUES (?,?,?,?,?)`, [addPersonId, sdt.toISOString(), edt.toISOString(), addReason || null, 'Manual']);
    setStatus('Added time-off entry.');
    setAddReason('');
    // Keep person and times for next add
  }

  function remove(id: number){
    if (!confirm('Delete this time-off entry?')) return;
    run(`DELETE FROM timeoff WHERE id=?`, [id]);
    setStatus('Deleted.');
    // trigger refresh by forcing re-render; depends on parent refresh
    // parent refresh updates caches; here the table reads live from DB on render
  }

  return (
    <section className={s.root}>
      <div className={s.header}>
        <h2 style={{ margin: 0 }}>Time Off</h2>
        <div className={s.actions}>
          <input id="toff-file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style={{ display: 'none' }} onChange={async (e)=>{ const f=e.target.files?.[0]; if (f) await handleImportXlsx(f); (e.target as HTMLInputElement).value=''; }} />
          <Tooltip content="Import Teams Time-Off XLSX/CSV" relationship="label"><Button onClick={()=>document.getElementById('toff-file')?.click()}>Import Time Off</Button></Tooltip>
        </div>
      </div>

      <div className={s.grid}>
        <div className={s.col3}>
          <Dropdown
            placeholder="Select person"
            selectedOptions={addPersonId!=null?[String(addPersonId)]:[]}
            onOptionSelect={(_,d)=>{ const v = d.optionValue ?? d.optionText; setAddPersonId(v?Number(v):null); }}
          >
            {people.map((p:any)=> (
              <Option key={p.id} value={String(p.id)}>{`${p.last_name}, ${p.first_name}`}</Option>
            ))}
          </Dropdown>
        </div>
        <div className={s.col3}>
          <Input type="date" value={addStartDate} onChange={(_,d)=>setAddStartDate(d.value)} />
        </div>
        <div className={s.col3}>
          <Input type="time" value={addStartTime} onChange={(_,d)=>setAddStartTime(d.value)} />
        </div>
        <div className={s.col3}>
          <Input type="date" value={addEndDate} onChange={(_,d)=>setAddEndDate(d.value)} />
        </div>
        <div className={s.col3}>
          <Input type="time" value={addEndTime} onChange={(_,d)=>setAddEndTime(d.value)} />
        </div>
        <div className={s.col4}>
          <Textarea placeholder="Reason (optional)" value={addReason} onChange={(_,d)=>setAddReason(d.value)} />
        </div>
        <div className={s.col3}>
          <Button appearance="primary" onClick={addManual}>Add Time Off</Button>
        </div>
      </div>

      <div className={s.status}>{status}</div>

      <div className={s.tableWrap}>
        <Table aria-label="Time-off table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Person</TableHeaderCell>
              <TableHeaderCell>Work Email</TableHeaderCell>
              <TableHeaderCell>Start</TableHeaderCell>
              <TableHeaderCell>End</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r:any)=> (
              <TableRow key={r.id}>
                <TableCell>{`${r.last_name}, ${r.first_name}`}</TableCell>
                <TableCell>{r.work_email}</TableCell>
                <TableCell>{new Date(r.start_ts).toLocaleString()}</TableCell>
                <TableCell>{new Date(r.end_ts).toLocaleString()}</TableCell>
                <TableCell>{r.reason||''}</TableCell>
                <TableCell><Button size="small" appearance="secondary" onClick={()=>remove(r.id)}>Delete</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
