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
    rowGap: tokens.spacingVerticalS,
  },
  actions: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
  input: {
    width: "100%",
  },
  segmentList: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
});

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
  const styles = useStyles();

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
    <Card className={styles.root}>
      <div className={styles.header}>
        <div>Roles</div>
        <Button className={styles.addButton} onClick={startAdd}>
          Add Role
        </Button>
      </div>

      <div className={styles.tableContainer}>
        <Table>
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
                <TableCell className={styles.rowActionCell}>
                  <Button appearance="subtle" className={styles.editButton} onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  <Button appearance="subtle" className={styles.deleteButton} onClick={() => remove(r.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {formVisible && editing && (
        <div className={styles.form}>
          <Input
            className={styles.input}
            placeholder="Code"
            value={editing.code}
            onChange={(_, data) => setEditing({ ...editing, code: data.value })}
          />
          <Input
            className={styles.input}
            placeholder="Name"
            value={editing.name}
            onChange={(_, data) => setEditing({ ...editing, name: data.value })}
          />
          <Dropdown
            className={styles.input}
            selectedOptions={[String(editing.group_id)]}
            onOptionSelect={(_, data) => setEditing({ ...editing, group_id: Number(data.optionValue) })}
          >
            {groups.map((g: any) => (
              <Option key={g.id} value={String(g.id)}>
                {g.name}
              </Option>
            ))}
          </Dropdown>
          <div className={styles.segmentList}>
            {segments.map((s) => (
              <Checkbox
                key={s.name}
                label={s.name}
                checked={editing.segs.has(s.name)}
                onChange={() => toggleSeg(s.name)}
              />
            ))}
          </div>
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
