import React, { useEffect, useState } from "react";
import type { SegmentRow } from "../services/segments";

interface RoleEditorProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
  segments: SegmentRow[];
}

export default function RoleEditor({ all, run, refresh, segments }: RoleEditorProps) {
  const [roles, setRoles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);

  function load() {
    setRoles(
      all(`SELECT r.id,r.code,r.name,r.group_id,r.segments,g.name as group_name FROM role r JOIN grp g ON g.id=r.group_id ORDER BY g.name,r.name`)
        .map((r: any) => ({ ...r, segs: new Set<string>(JSON.parse(r.segments)) }))
    );
    setGroups(all(`SELECT id,name FROM grp ORDER BY name`));
  }

  useEffect(load, []);

  function startAdd() {
    setEditing({ id: null, code: "", name: "", group_id: groups[0]?.id || 0, segs: new Set<string>() });
    setFormVisible(true);
  }

  function startEdit(r: any) {
    setEditing({ ...r, segs: new Set<string>(r.segs) });
    setFormVisible(true);
  }

  function toggleSeg(seg: string) {
    if (!editing) return;
    const s = new Set(editing.segs);
    if (s.has(seg)) s.delete(seg); else s.add(seg);
    setEditing({ ...editing, segs: s });
  }

  function save() {
    if (!editing) return;
    const segArr = Array.from(editing.segs);
    if (!editing.code.trim() || !editing.name.trim()) {
      window.alert("Code and name are required");
      return;
    }
    if (!segArr.length) {
      window.alert("Select at least one segment");
      return;
    }
    if (editing.id) {
      run(`UPDATE role SET code=?, name=?, group_id=?, segments=? WHERE id=?`, [editing.code, editing.name, editing.group_id, JSON.stringify(segArr), editing.id]);
    } else {
      run(`INSERT INTO role (code,name,group_id,segments) VALUES (?,?,?,?)`, [editing.code, editing.name, editing.group_id, JSON.stringify(segArr)]);
    }
    load();
    refresh();
    setFormVisible(false);
    setEditing(null);
  }

  function cancel() {
    setFormVisible(false);
    setEditing(null);
  }

  function remove(id: number) {
    if (!window.confirm("Delete role?")) return;
    run(`DELETE FROM role WHERE id=?`, [id]);
    load();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">Roles</div>
        <button className="px-3 py-2 bg-emerald-700 text-white rounded" onClick={startAdd}>Add Role</button>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
        <table className="min-w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Group</th>
              <th className="p-2 text-left">Segments</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r: any) => (
              <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                <td className="p-2">{r.code}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.group_name}</td>
                <td className="p-2">{Array.from(r.segs).join(", ")}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-blue-600" onClick={() => startEdit(r)}>Edit</button>
                  <button className="text-red-600" onClick={() => remove(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formVisible && editing && (
        <div className="space-y-2">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Code"
            value={editing.code}
            onChange={(e) => setEditing({ ...editing, code: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Name"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <select
            className="border rounded px-2 py-1 w-full"
            value={editing.group_id}
            onChange={(e) => setEditing({ ...editing, group_id: Number(e.target.value) })}
          >
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {segments.map((s) => (
              <label key={s.name} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={editing.segs.has(s.name)}
                  onChange={() => toggleSeg(s.name)}
                />
                {s.name}
              </label>
            ))}
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
