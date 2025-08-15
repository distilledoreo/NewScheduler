import React, { useEffect, useState } from "react";

interface ExportGroupEditorProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
}

export default function ExportGroupEditor({ all, run, refresh }: ExportGroupEditorProps) {
  const empty = { group_id: "", code: "", color: "", column_group: "" };
  const [rows, setRows] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<any>(empty);

  function load() {
    const r = all(`SELECT eg.group_id, g.name as group_name, eg.code, eg.color, eg.column_group
                     FROM export_group eg JOIN grp g ON g.id=eg.group_id ORDER BY g.name`);
    setRows(r);
    const used = new Set(r.map((x: any) => x.group_id));
    const avail = all(`SELECT id,name FROM grp ORDER BY name`).filter((g: any) => !used.has(g.id));
    setAvailable(avail);
  }

  useEffect(load, []);

  function startAdd() {
    setEditing(null);
    setForm(empty);
    setFormVisible(true);
  }

  function startEdit(r: any) {
    setEditing(r);
    setForm({ group_id: r.group_id, code: r.code, color: r.color, column_group: r.column_group });
    setFormVisible(true);
  }

  function save() {
    if (!form.group_id) {
      window.alert("Group is required");
      return;
    }
    if (!form.code.trim()) {
      window.alert("Code is required");
      return;
    }
    if (editing) {
      run(`UPDATE export_group SET code=?, color=?, column_group=? WHERE group_id=?`, [form.code, form.color, form.column_group, editing.group_id]);
    } else {
      run(`INSERT INTO export_group (group_id, code, color, column_group) VALUES (?,?,?,?)`, [form.group_id, form.code, form.color, form.column_group]);
    }
    load();
    refresh();
    setFormVisible(false);
    setEditing(null);
    setForm(empty);
  }

  function cancel() {
    setFormVisible(false);
    setEditing(null);
    setForm(empty);
  }

  function remove(id: number) {
    if (!window.confirm("Delete export metadata?")) return;
    run(`DELETE FROM export_group WHERE group_id=?`, [id]);
    load();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">Export Groups</div>
        <button className="px-3 py-2 bg-emerald-700 text-white rounded" onClick={startAdd}>
          Add Export Group
        </button>
      </div>
      <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
        <table className="min-w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Group</th>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Color</th>
              <th className="p-2 text-left">Column Group</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.group_id} className="odd:bg-white even:bg-slate-50">
                <td className="p-2">{r.group_name}</td>
                <td className="p-2">{r.code}</td>
                <td className="p-2">{r.color}</td>
                <td className="p-2">{r.column_group}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-blue-600" onClick={() => startEdit(r)}>Edit</button>
                  <button className="text-red-600" onClick={() => remove(r.group_id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {formVisible && (
        <div className="space-y-2">
          {editing ? (
            <div>{rows.find((r:any)=>r.group_id===editing.group_id)?.group_name}</div>
          ) : (
            <select
              className="border rounded px-2 py-1 w-full"
              value={form.group_id}
              onChange={(e) => setForm({ ...form, group_id: e.target.value })}
            >
              <option value="">Select group...</option>
              {available.map((g:any)=>(
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Column Group"
            value={form.column_group}
            onChange={(e) => setForm({ ...form, column_group: e.target.value })}
          />
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-emerald-700 text-white rounded" onClick={save}>
              Save
            </button>
            <button className="px-3 py-2 border rounded" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
