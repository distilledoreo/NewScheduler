import React, { useEffect, useState } from "react";
import {
  Button,
  Field,
  Input,
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

interface GroupEditorProps {
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

export default function GroupEditor({ all, run, refresh }: GroupEditorProps) {
  const classes = useStyles();
  const empty = { name: "", theme: "", custom_color: "" };
  const [groups, setGroups] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(empty);
  const toasterId = useId("group-editor-toast");
  const { dispatchToast } = useToastController(toasterId);

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

  function showError(msg: string) {
    dispatchToast(
      <Toast>
        <ToastTitle>{msg}</ToastTitle>
      </Toast>,
      { intent: "error" }
    );
  }

  function save() {
    if (!form.name.trim()) {
      showError("Name is required");
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
    <div className={classes.root}>
      <Toaster toasterId={toasterId} position="bottom" />
      <div className={classes.header}>
        <Text weight="semibold" size={500}>
          Groups
        </Text>
        <Button appearance="primary" onClick={startAdd}>
          Add Group
        </Button>
      </div>

      <div className={classes.tableWrapper}>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Theme</TableHeaderCell>
              <TableHeaderCell>Color</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g: any) => (
              <TableRow key={g.id}>
                <TableCell>{g.name}</TableCell>
                <TableCell>{g.theme || ""}</TableCell>
                <TableCell>{g.custom_color || ""}</TableCell>
                <TableCell>
                  <div className={classes.actionRow}>
                    <Button appearance="subtle" onClick={() => startEdit(g)}>
                      Edit
                    </Button>
                    <Button appearance="subtle" onClick={() => remove(g.id)}>
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
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(_, data) => setForm({ ...form, name: data.value })}
            />
          </Field>
          <Field label="Theme">
            <Input
              value={form.theme}
              onChange={(_, data) => setForm({ ...form, theme: data.value })}
            />
          </Field>
          <Field label="Custom Color">
            <Input
              value={form.custom_color}
              onChange={(_, data) =>
                setForm({ ...form, custom_color: data.value })
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
