import React, { useEffect, useState } from "react";

interface SegmentEditorProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
}

export default function SegmentEditor({ all, run, refresh }: SegmentEditorProps) {
  const empty = { name: "", start_time: "", end_time: "", ordering: 0 };
  const [segments, setSegments] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<any>(empty);

  function load() {
    setSegments(all(`SELECT id,name,start_time,end_time,ordering FROM segment ORDER BY ordering`));
  }

  useEffect(load, []);

  function startAdd() {
    setEditing(null);
    setForm({ ...empty, ordering: segments.length ? segments[segments.length - 1].ordering + 1 : 1 });
    setFormVisible(true);
  }

  function startEdit(s: any) {
    setEditing(s);
    setForm({ name: s.name, start_time: s.start_time, end_time: s.end_time, ordering: s.ordering });
    setFormVisible(true);
  }

  function save() {
    if (!form.name.trim()) {
      window.alert("Name is required");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(form.start_time) || !/^\d{2}:\d{2}$/.test(form.end_time)) {
      window.alert("Times must be HH:MM");
      return;
    }
    if (editing) {
      run(`UPDATE segment SET name=?, start_time=?, end_time=?, ordering=? WHERE id=?`, [form.name, form.start_time, form.end_time, form.ordering, editing.id]);
    } else {
      run(`INSERT INTO segment (name,start_time,end_time,ordering) VALUES (?,?,?,?)`, [form.name, form.start_time, form.end_time, form.ordering]);
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
    if (!window.confirm("Delete segment?")) return;
    run(`DELETE FROM segment WHERE id=?`, [id]);
    load();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">Segments</div>
        <button className="px-3 py-2 bg-emerald-700 text-white rounded" onClick={startAdd}>
          Add Segment
        </button>
      </div>
      <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
        <table className="min-w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Start</th>
              <th className="p-2 text-left">End</th>
              <th className="p-2 text-left">Order</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s: any) => (
              <tr key={s.id} className="odd:bg-white even:bg-slate-50">
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.start_time}</td>
                <td className="p-2">{s.end_time}</td>
                <td className="p-2">{s.ordering}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-blue-600" onClick={() => startEdit(s)}>Edit</button>
                  <button className="text-red-600" onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {formVisible && (
        <div className="space-y-2">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="Start (HH:MM)"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="End (HH:MM)"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
            <input
              type="number"
              className="border rounded px-2 py-1 w-full"
              placeholder="Order"
              value={form.ordering}
              onChange={(e) => setForm({ ...form, ordering: Number(e.target.value) })}
            />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-emerald-700 text-white rounded" onClick={save}>Save</button>
            <button className="px-3 py-2 border rounded" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
