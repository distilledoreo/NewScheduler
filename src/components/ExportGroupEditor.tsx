import React, { useEffect, useState } from "react";
import { Button, Field, Input, Dropdown, Option, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens } from "@fluentui/react-components";

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

  const useStyles = makeStyles({
    section: { display: "flex", flexDirection: "column", rowGap: "12px" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    tableWrap: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: "8px",
      overflow: "auto",
      maxHeight: "40vh",
      width: "100%",
      boxShadow: tokens.shadow2,
    },
    row: { display: "flex", columnGap: "8px" },
  });
  const s = useStyles();
  return (
    <div className={s.section}>
      <div className={s.header}>
        <Text weight="semibold">Export Groups</Text>
        <Button appearance="primary" onClick={startAdd}>Add Export Group</Button>
      </div>
      <div className={s.tableWrap}>
        <Table aria-label="Export groups table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Group</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Color</TableHeaderCell>
              <TableHeaderCell>Column Group</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.group_id}>
                <TableCell>{r.group_name}</TableCell>
                <TableCell>{r.code}</TableCell>
                <TableCell>{r.color}</TableCell>
                <TableCell>{r.column_group}</TableCell>
                <TableCell style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button size="small" onClick={() => startEdit(r)}>Edit</Button>
                    <Button size="small" appearance="secondary" onClick={() => remove(r.group_id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {formVisible && (
        <div className={s.section}>
          {editing ? (
            <div>{rows.find((rr:any)=>rr.group_id===editing.group_id)?.group_name}</div>
          ) : (
            <Field label="Group" required>
              <Dropdown
                placeholder="Select group…"
                selectedOptions={form.group_id ? [String(form.group_id)] : []}
                onOptionSelect={(_, data) => setForm({ ...form, group_id: Number(data.optionValue ?? data.optionText) })}
              >
                {available.map((g:any)=>(
                  <Option key={g.id} value={String(g.id)}>{g.name}</Option>
                ))}
              </Dropdown>
            </Field>
          )}
          <Field label="Code" required>
            <Input value={form.code} onChange={(_, d) => setForm({ ...form, code: d.value })} />
          </Field>
          <Field label="Color">
            <Input value={form.color} onChange={(_, d) => setForm({ ...form, color: d.value })} />
          </Field>
          <Field label="Column Group">
            <Input value={form.column_group} onChange={(_, d) => setForm({ ...form, column_group: d.value })} />
          </Field>
          <div className={s.row}>
            <Button appearance="primary" onClick={save}>Save</Button>
            <Button onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
