import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Input,
  Option,
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableHeaderCell,
  makeStyles,
  shorthands,
  tokens,
  Field,
  Text,
  Toaster,
  Toast,
  ToastTitle,
  useId,
  useToastController,
} from "@fluentui/react-components";
import type { SegmentRow } from "../services/segments";

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
  tableWrapper: {
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    maxHeight: "40vh",
    overflowY: "auto",
  },
  actionRow: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
  checkboxRow: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
  },
});

interface RoleEditorProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
  segments: SegmentRow[];
}

export default function RoleEditor({ all, run, refresh, segments }: RoleEditorProps) {
  const classes = useStyles();
  const [roles, setRoles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const toasterId = useId("role-editor-toast");
  const { dispatchToast } = useToastController(toasterId);

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

  function showError(msg: string) {
    dispatchToast(
      <Toast>
        <ToastTitle>{msg}</ToastTitle>
      </Toast>,
      { intent: "error" }
    );
  }

  function save() {
    if (!editing) return;
    const segArr = Array.from(editing.segs);
    if (!editing.code.trim() || !editing.name.trim()) {
      showError("Code and name are required");
      return;
    }
    if (!segArr.length) {
      showError("Select at least one segment");
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
    <Card className={classes.root}>
      <Toaster toasterId={toasterId} position="bottom" />
      <div className={classes.header}>
        <Text weight="semibold" size={500}>
          Roles
        </Text>
        <Button appearance="primary" onClick={startAdd}>
          Add Role
        </Button>
      </div>

      <div className={classes.tableWrapper}>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Group</TableHeaderCell>
              <TableHeaderCell>Segments</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.group_name}</TableCell>
                <TableCell>{Array.from(r.segs).join(", ")}</TableCell>
                <TableCell>
                  <div className={classes.actionRow}>
                    <Button appearance="subtle" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button appearance="subtle" onClick={() => remove(r.id)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {formVisible && editing && (
        <div className={classes.form}>
          <Field label="Code">
            <Input
              value={editing.code}
              onChange={(_, data) => setEditing({ ...editing, code: data.value })}
            />
          </Field>
          <Field label="Name">
            <Input
              value={editing.name}
              onChange={(_, data) => setEditing({ ...editing, name: data.value })}
            />
          </Field>
          <Field label="Group">
            <Dropdown
              selectedOptions={[String(editing.group_id)]}
              onOptionSelect={(_, data) => setEditing({ ...editing, group_id: Number(data.optionValue) })}
            >
              {groups.map((g: any) => (
                <Option key={g.id} value={String(g.id)}>
                  {g.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <div className={classes.checkboxRow}>
            {segments.map((s) => (
              <Checkbox
                key={s.name}
                label={s.name}
                checked={editing.segs.has(s.name)}
                onChange={() => toggleSeg(s.name)}
              />
            ))}
          </div>
          <div className={classes.actionRow}>
            <Button appearance="primary" onClick={save}>
              Save
            </Button>
            <Button onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}