import React, { useEffect, useState } from "react";
import type { SegmentRow } from "../services/segments";
import { Button, Field, Input, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Dropdown, Option, Checkbox, Text } from "@fluentui/react-components";

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
        <Text weight="semibold">Roles</Text>
        <Button appearance="primary" onClick={startAdd}>Add Role</Button>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
        <Table aria-label="Roles table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Group</TableHeaderCell>
              <TableHeaderCell>Segments</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.group_name}</TableCell>
                <TableCell>{Array.from(r.segs).join(", ")}</TableCell>
                <TableCell style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button size="small" onClick={() => startEdit(r)}>Edit</Button>
                    <Button size="small" appearance="secondary" onClick={() => remove(r.id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {formVisible && editing && (
        <div className="space-y-3">
          <Field label="Code" required>
            <Input value={editing.code} onChange={(_, d) => setEditing({ ...editing, code: d.value })} />
          </Field>
          <Field label="Name" required>
            <Input value={editing.name} onChange={(_, d) => setEditing({ ...editing, name: d.value })} />
          </Field>
          <Field label="Group">
            <Dropdown value={String(editing.group_id)} onOptionSelect={(_, data) => {
              const v = Number(data.optionValue ?? data.optionText);
              setEditing({ ...editing, group_id: v });
            }}>
              {groups.map((g: any) => (
                <Option key={g.id} value={String(g.id)}>{g.name}</Option>
              ))}
            </Dropdown>
          </Field>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {segments.map((s) => (
              <Checkbox key={s.name} label={s.name} checked={editing.segs.has(s.name)} onChange={() => toggleSeg(s.name)} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="primary" onClick={save}>Save</Button>
            <Button onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
