import React, { useEffect, useState } from "react";

interface GroupEditorProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
}

export default function GroupEditor({ all, run, refresh }: GroupEditorProps) {
  const empty = { name: "", theme: "", custom_color: "" };
  const [groups, setGroups] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(empty);

  function load() {
    setGroups(all(`SELECT id,name,theme,custom_color FROM grp ORDER BY name`));
  }

  useEffect(load, []);

  function startAdd() {
    setEditing(null);
    setForm(empty);
    setFormVisible(true);
  }

  function startEdit(g: any) {
    setEditing(g);
    setForm({ name: g.name, theme: g.theme || "", custom_color: g.custom_color || "" });
    setFormVisible(true);
  }

  function save() {
    if (!form.name.trim()) {
      window.alert("Name is required");
      return;
    }
    if (editing) {
      run(`UPDATE grp SET name=?, theme=?, custom_color=? WHERE id=?`, [form.name, form.theme || null, form.custom_color || null, editing.id]);
    } else {
      run(`INSERT INTO grp (name, theme, custom_color) VALUES (?,?,?)`, [form.name, form.theme || null, form.custom_color || null]);
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
    if (!window.confirm("Delete group?")) return;
    run(`DELETE FROM role WHERE group_id=?`, [id]);
    run(`DELETE FROM grp WHERE id=?`, [id]);
    load();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">Groups</div>
        <button className="px-3 py-2 bg-emerald-700 text-white rounded" onClick={startAdd}>
          Add Group
        </button>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
        <table className="min-w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Theme</th>
              <th className="p-2 text-left">Color</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g: any) => (
              <tr key={g.id} className="odd:bg-white even:bg-slate-50">
                <td className="p-2">{g.name}</td>
                <td className="p-2">{g.theme || ""}</td>
                <td className="p-2">{g.custom_color || ""}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-blue-600" onClick={() => startEdit(g)}>Edit</button>
                  <button className="text-red-600" onClick={() => remove(g.id)}>Delete</button>
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
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Theme"
            value={form.theme}
            onChange={(e) => setForm({ ...form, theme: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Custom Color"
            value={form.custom_color}
            onChange={(e) => setForm({ ...form, custom_color: e.target.value })}
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
