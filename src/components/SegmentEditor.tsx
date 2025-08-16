import React, { useEffect, useState } from "react";
import { Button, Field, Input, Table, TableHeader, TableHeaderCell, TableRow, TableBody, TableCell, Text, makeStyles, tokens } from "@fluentui/react-components";

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

  const useStyles = makeStyles({
    section: { display: "flex", flexDirection: "column", rowGap: tokens.spacingHorizontalS },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    tableWrap: {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusLarge,
      overflow: "auto",
      maxHeight: "40vh",
      width: "100%",
      boxShadow: tokens.shadow2,
    },
    row: { display: "flex", columnGap: tokens.spacingHorizontalS },
    rightAlign: { textAlign: 'right' },
    flex1: { flex: 1 },
    orderWidth: { width: '10ch' },
    actionsRow: { display: 'flex', gap: tokens.spacingHorizontalS, justifyContent: 'flex-end' },
  });
  const s = useStyles();
  return (
    <div className={s.section}>
      <div className={s.header}>
        <Text weight="semibold">Segments</Text>
        <Button appearance="primary" onClick={startAdd}>Add Segment</Button>
      </div>
      <div className={s.tableWrap}>
        <Table aria-label="Segments table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Start</TableHeaderCell>
              <TableHeaderCell>End</TableHeaderCell>
              <TableHeaderCell>Order</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {segments.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.start_time}</TableCell>
                <TableCell>{s.end_time}</TableCell>
                <TableCell>{s.ordering}</TableCell>
                <TableCell className={s.rightAlign}>
                  <div className={s.actionsRow}>
                    <Button size="small" onClick={() => startEdit(s)}>Edit</Button>
                    <Button size="small" appearance="secondary" onClick={() => remove(s.id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {formVisible && (
        <div className={s.section}>
          <Field label="Name" required>
            <Input value={form.name} onChange={(_, d) => setForm({ ...form, name: d.value })} />
          </Field>
          <div className={s.row}>
            <Field label="Start (HH:MM)" className={s.flex1}>
              <Input value={form.start_time} onChange={(_, d) => setForm({ ...form, start_time: d.value })} />
            </Field>
            <Field label="End (HH:MM)" className={s.flex1}>
              <Input value={form.end_time} onChange={(_, d) => setForm({ ...form, end_time: d.value })} />
            </Field>
            <Field label="Order" className={s.orderWidth}>
              <Input type="number" value={String(form.ordering)} onChange={(_, d) => setForm({ ...form, ordering: Number(d.value || 0) })} />
            </Field>
          </div>
          <div className={s.row}>
            <Button appearance="primary" onClick={save}>Save</Button>
            <Button onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
