import React, { useEffect, useState } from "react";
import { Button, Input, Field, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text } from "@fluentui/react-components";

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
        <Text weight="semibold">Groups</Text>
        <Button appearance="primary" onClick={startAdd}>Add Group</Button>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[40vh] shadow w-full">
        <Table aria-label="Groups table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Theme</TableHeaderCell>
              <TableHeaderCell>Color</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g: any) => (
              <TableRow key={g.id}>
                <TableCell>{g.name}</TableCell>
                <TableCell>{g.theme || ""}</TableCell>
                <TableCell>{g.custom_color || ""}</TableCell>
                <TableCell style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button size="small" onClick={() => startEdit(g)}>Edit</Button>
                    <Button size="small" appearance="secondary" onClick={() => remove(g.id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {formVisible && (
        <div className="space-y-3">
          <Field label="Name" required>
            <Input value={form.name} onChange={(_, d) => setForm({ ...form, name: d.value })} />
          </Field>
          <Field label="Theme">
            <Input value={form.theme} onChange={(_, d) => setForm({ ...form, theme: d.value })} />
          </Field>
          <Field label="Custom Color">
            <Input value={form.custom_color} onChange={(_, d) => setForm({ ...form, custom_color: d.value })} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="primary" onClick={save}>Save</Button>
            <Button onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
