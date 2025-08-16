import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
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
    alignItems: "center",
    justifyContent: "space-between",
  },
  addButton: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
  },
  tableContainer: {
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    maxHeight: "40vh",
    overflowY: "auto",
  },
  rowActionCell: {
    display: "flex",
    justifyContent: "flex-end",
    columnGap: tokens.spacingHorizontalS,
  },
  editButton: {
    color: tokens.colorPaletteBlueForeground1,
  },
  deleteButton: {
    color: tokens.colorPaletteRedForeground1,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalM,
  },
  actions: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
  input: {
    width: "100%",
  },
});

export default function GroupEditor({ all, run, refresh }: GroupEditorProps) {
  const styles = useStyles();
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
    <Card className={styles.root}>
      <Toaster toasterId={toasterId} position="bottom" />
      <div className={styles.header}>
        <Text weight="semibold" size={500}>
          Groups
        </Text>
        <Button className={styles.addButton} onClick={startAdd}>
          Add Group
        </Button>
      </div>

      <div className={styles.tableContainer}>
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
                <TableCell className={styles.rowActionCell}>
                  <Button appearance="subtle" className={styles.editButton} onClick={() => startEdit(g)}>
                    Edit
                  </Button>
                  <Button appearance="subtle" className={styles.deleteButton} onClick={() => remove(g.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {formVisible && (
        <div className={styles.form}>
          <Field label="Name" required>
            <Input
              className={styles.input}
              value={form.name}
              onChange={(_, data) => setForm({ ...form, name: data.value })}
            />
          </Field>
          <Field label="Theme">
            <Input
              className={styles.input}
              value={form.theme}
              onChange={(_, data) => setForm({ ...form, theme: data.value })}
            />
          </Field>
          <Field label="Custom Color">
            <Input
              className={styles.input}
              value={form.custom_color}
              onChange={(_, data) => setForm({ ...form, custom_color: data.value })}
            />
          </Field>
          <div className={styles.actions}>
            <Button appearance="primary" onClick={save}>
              Save
            </Button>
            <Button appearance="secondary" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}