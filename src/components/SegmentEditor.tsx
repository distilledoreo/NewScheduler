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

interface SegmentEditorProps {
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
  formRow: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
  actionRow: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
});

export default function SegmentEditor({ all, run, refresh }: SegmentEditorProps) {
  const classes = useStyles();
  const empty = { name: "", start_time: "", end_time: "", ordering: 0 };
  const [segments, setSegments] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const toasterId = useId("segment-editor-toast");
  const { dispatchToast } = useToastController(toasterId);

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
    if (!/^\d{2}:\d{2}$/.test(form.start_time) || !/^\d{2}:\d{2}$/.test(form.end_time)) {
      showError("Times must be HH:MM");
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
    <div className={classes.root}>
      <Toaster toasterId={toasterId} position="bottom" />
      <div className={classes.header}>
        <Text weight="semibold" size={500}>
          Segments
        </Text>
        <Button appearance="primary" onClick={startAdd}>
          Add Segment
        </Button>
      </div>
      <div className={classes.tableWrapper}>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Start</TableHeaderCell>
              <TableHeaderCell>End</TableHeaderCell>
              <TableHeaderCell>Order</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {segments.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.start_time}</TableCell>
                <TableCell>{s.end_time}</TableCell>
                <TableCell>{s.ordering}</TableCell>
                <TableCell>
                  <div className={classes.actionRow}>
                    <Button appearance="subtle" onClick={() => startEdit(s)}>
                      Edit
                    </Button>
                    <Button appearance="subtle" onClick={() => remove(s.id)}>
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
          <div className={classes.formRow}>
            <Field label="Start (HH:MM)">
              <Input
                value={form.start_time}
                onChange={(_, data) =>
                  setForm({ ...form, start_time: data.value })
                }
              />
            </Field>
            <Field label="End (HH:MM)">
              <Input
                value={form.end_time}
                onChange={(_, data) =>
                  setForm({ ...form, end_time: data.value })
                }
              />
            </Field>
            <Field label="Order">
              <Input
                type="number"
                value={form.ordering.toString()}
                onChange={(_, data) =>
                  setForm({ ...form, ordering: Number(data.value) })
                }
              />
            </Field>
          </div>
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
