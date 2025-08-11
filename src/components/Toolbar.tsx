import React from "react";

type Tab = "RUN" | "PEOPLE" | "NEEDS" | "EXPORT" | "MONTHLY" | "HISTORY";

interface ToolbarProps {
  ready: boolean;
  sqlDb: any;
  canSave: boolean;
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
  canSave,
  createNewDb,
  openDbFromFile,
  saveDb,
  saveDbAs,
  status,
  activeTab,
  setActiveTab,
  runDiagnostics,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-white sticky top-0 z-20">
      <div className="flex flex-wrap items-center gap-2">
        <button className="px-3 py-2 bg-slate-900 text-white rounded text-sm" onClick={createNewDb} disabled={!ready}>New DB</button>
        <button className="px-3 py-2 bg-slate-800 text-white rounded text-sm" onClick={openDbFromFile} disabled={!ready}>Open DB</button>
        <button className="px-3 py-2 bg-emerald-700 text-white rounded text-sm" onClick={saveDb} disabled={!canSave}>Save</button>
        <button className="px-3 py-2 bg-emerald-800 text-white rounded text-sm" onClick={saveDbAs} disabled={!sqlDb}>Save As</button>
      </div>
      <div className="mx-2 text-sm text-slate-600 flex-1 min-w-0 truncate">{status}</div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={`px-3 py-2 rounded text-sm ${activeTab==='RUN'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('RUN')}>Daily Run</button>
        <button className={`px-3 py-2 rounded text-sm ${activeTab==='PEOPLE'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('PEOPLE')}>People</button>
        <button className={`px-3 py-2 rounded text-sm ${activeTab==='NEEDS'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('NEEDS')}>Baseline Needs</button>
        <button className={`px-3 py-2 rounded text-sm ${activeTab==='EXPORT'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('EXPORT')}>Export Preview</button>
        <button className={`px-3 py-2 rounded text-sm ${activeTab==='MONTHLY'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('MONTHLY')}>Monthly Defaults</button>
        <button className={`px-3 py-2 rounded text-sm ${activeTab==='HISTORY'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setActiveTab('HISTORY')}>Crew History</button>
        <button className="px-3 py-2 rounded bg-slate-200 text-sm" onClick={runDiagnostics}>Run Diagnostics</button>
      </div>
    </div>
  );
}

