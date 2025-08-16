import React, { useEffect, useState } from "react";
import {
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Text,
  Toaster,
  Toast,
  ToastTitle,
  useId,
  useToastController,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components";

interface ExportGroupEditorProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalL,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableWrapper: {
    maxHeight: "40vh",
    overflow: "auto",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
  },
  actionRow: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
});

export default function ExportGroupEditor({ all, run, refresh }: ExportGroupEditorProps) {
  const classes = useStyles();
  const empty = { group_id: "", code: "", color: "", column_group: "" };
  const [rows, setRows] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const toasterId = useId("export-group-editor-toast");
  const { dispatchToast } = useToastController(toasterId);

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

  function showError(msg: string) {
    dispatchToast(
      <Toast>
        <ToastTitle>{msg}</ToastTitle>
      </Toast>,
      { intent: "error" }
    );
  }

  function save() {
    if (!form.group_id) {
      showError("Group is required");
      return;
    }
    if (!form.code.trim()) {
      showError("Code is required");
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
    <div className={classes.root}>
      <Toaster toasterId={toasterId} position="bottom" />
      <div className={classes.header}>
        <Text weight="semibold" size={500}>
          Export Groups
        </Text>
        <Button appearance="primary" onClick={startAdd}>
          Add Export Group
        </Button>
      </div>
      <div className={classes.tableWrapper}>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Group</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Color</TableHeaderCell>
              <TableHeaderCell>Column Group</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.group_id}>
                <TableCell>{r.group_name}</TableCell>
                <TableCell>{r.code}</TableCell>
                <TableCell>{r.color}</TableCell>
                <TableCell>{r.column_group}</TableCell>
                <TableCell>
                  <div className={classes.actionRow}>
                    <Button appearance="subtle" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button appearance="subtle" onClick={() => remove(r.group_id)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {formVisible && (
        <div className={classes.root}>
          {editing ? (
            <Text>{rows.find((r: any) => r.group_id === editing.group_id)?.group_name}</Text>
          ) : (
            <Field label="Group">
              <Dropdown
                selectedOptions={[form.group_id]}
                onOptionSelect={(_, data) =>
                  setForm({ ...form, group_id: data.optionValue || "" })
                }
              >
                <Option value="">Select group...</Option>
                {available.map((g: any) => (
                  <Option key={g.id} value={g.id.toString()}>
                    {g.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
          <Field label="Code">
            <Input
              value={form.code}
              onChange={(_, data) => setForm({ ...form, code: data.value })}
            />
          </Field>
          <Field label="Color">
            <Input
              value={form.color}
              onChange={(_, data) => setForm({ ...form, color: data.value })}
            />
          </Field>
          <Field label="Column Group">
            <Input
              value={form.column_group}
              onChange={(_, data) =>
                setForm({ ...form, column_group: data.value })
              }
            />
          </Field>
          <div className={classes.actionRow}>
            <Button appearance="primary" onClick={save}>
              Save
            </Button>
            <Button onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
