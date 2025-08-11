import React from "react";
import { previewTrainingChart, applyTrainingChart } from "../excel/import-training-chart";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

type Tab = "RUN" | "PEOPLE" | "NEEDS" | "EXPORT" | "MONTHLY" | "HISTORY";

interface ToolbarProps {
  ready: boolean;
  sqlDb: any;
  createNewDb: () => void;
  openDbFromFile: () => void;
  saveDb: () => void;
  saveDbAs: () => void;
  status: string;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  runDiagnostics: () => void;
}

export default function Toolbar({
  ready,
  sqlDb,
  createNewDb,
  openDbFromFile,
  saveDb,
  saveDbAs,
  status,
  activeTab,
  setActiveTab,
  runDiagnostics,
}: ToolbarProps) {
  function all<T = any>(sql: string, params: any[] = []): T[] {
    if (!sqlDb) throw new Error('No database loaded');
    const stmt = sqlDb.prepare(sql);
    const rows: T[] = [];
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-white sticky top-0 z-20">
      <div className="flex flex-wrap items-center gap-2">
        <button className="px-3 py-2 bg-slate-900 text-white rounded text-sm" onClick={createNewDb} disabled={!ready}>New DB</button>
        <button className="px-3 py-2 bg-slate-800 text-white rounded text-sm" onClick={openDbFromFile} disabled={!ready}>Open DB</button>
        <button className="px-3 py-2 bg-emerald-700 text-white rounded text-sm" onClick={saveDb} disabled={!sqlDb}>Save</button>
        <button className="px-3 py-2 bg-emerald-800 text-white rounded text-sm" onClick={saveDbAs} disabled={!sqlDb}>Save As</button>
        <input
          type="file"
          accept=".xlsx"
          disabled={!sqlDb}
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            try {
              let preview = await previewTrainingChart(f);
              if (preview.unmatchedNames.length) {
                const overrides: Record<string, number> = (window as any).__nameOverrides || ((window as any).__nameOverrides = {});
                for (const name of preview.unmatchedNames) {
                  const email = window.prompt(`Email for ${name}?`)?.trim();
                  if (email) {
                    const rows = all<{ id: number }>(
                      'SELECT id FROM person WHERE lower(work_email)=lower(?)',
                      [email.toLowerCase()]
                    );
                    if (rows[0]) overrides[norm(name)] = rows[0].id;
                  }
                }
                preview = await previewTrainingChart(f);
              }
              console.log('Import months:', preview.months.length);
              console.log('Planned upserts:', preview.plan.length);
              console.log('Unknown codes:', preview.unknownCodes);
              const ok = window.confirm(
                `Months: ${preview.months.join(', ')}\nMatched: ${preview.matchedPeople}\nUnmatched: ${preview.unmatchedNames.join(', ')}\nUnknown codes: ${preview.unknownCodes
                  .map((u) => u.code + ':' + u.count)
                  .join(', ')}\nApply?`
              );
              if (ok) await applyTrainingChart(preview.plan);
            } catch (err) {
              console.error('Import failed', err);
              window.alert((err as Error).message || 'Import failed');
            } finally {
              e.currentTarget.value = '';
            }
          }}
        />
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

