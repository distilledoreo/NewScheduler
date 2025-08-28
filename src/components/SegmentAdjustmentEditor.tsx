import React, { useEffect, useState } from "react";
import {
  Button,
  Field,
  Input,
  Dropdown,
  Option,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableBody,
  TableCell,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { SegmentRow } from "../services/segments";
import type { SegmentAdjustmentRow } from "../services/segmentAdjustments";

interface Props {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
  segments: SegmentRow[];
}

const baselineOpts = [
  { value: "condition.start", label: "Condition Start" },
  { value: "condition.end", label: "Condition End" },
  { value: "target.start", label: "Target Start" },
  { value: "target.end", label: "Target End" },
];

export default function SegmentAdjustmentEditor({ all, run, refresh, segments }: Props) {
  const empty: Omit<SegmentAdjustmentRow, "id"> = {
    condition_segment: "",
    condition_role_id: null,
    target_segment: "",
    target_field: "start",
    baseline: "condition.start",
    offset_minutes: 0,
  };
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);
  const [roles, setRoles] = useState<any[]>([]);

  function load() {
    setRows(all(`SELECT id,condition_segment,condition_role_id,target_segment,target_field,baseline,offset_minutes FROM segment_adjustment`));
    setRoles(all(`SELECT id,name FROM role ORDER BY name`));
  }
  useEffect(load, []);

  function startAdd() {
    setEditing(null);
    setForm(empty);
    setFormVisible(true);
  }

  function startEdit(r: any) {
    setEditing(r);
    setForm({
      condition_segment: r.condition_segment,
      condition_role_id: r.condition_role_id ?? null,
      target_segment: r.target_segment,
      target_field: r.target_field,
      baseline: r.baseline,
      offset_minutes: r.offset_minutes,
    });
    setFormVisible(true);
  }

  function save() {
    if (!form.condition_segment || !form.target_segment) {
      window.alert("Segments required");
      return;
    }
    const params = [
      form.condition_segment,
      form.condition_role_id,
      form.target_segment,
      form.target_field,
      form.baseline,
      form.offset_minutes,
    ];
    if (editing) {
      run(
        `UPDATE segment_adjustment SET condition_segment=?, condition_role_id=?, target_segment=?, target_field=?, baseline=?, offset_minutes=? WHERE id=?`,
        [...params, editing.id]
      );
    } else {
      run(
        `INSERT INTO segment_adjustment (condition_segment,condition_role_id,target_segment,target_field,baseline,offset_minutes) VALUES (?,?,?,?,?,?)`,
        params
      );
    }
    load();
    refresh();
    cancel();
  }

  function cancel() {
    setFormVisible(false);
    setEditing(null);
    setForm(empty);
  }

  function remove(id: number) {
    if (!window.confirm("Delete adjustment?")) return;
    run(`DELETE FROM segment_adjustment WHERE id=?`, [id]);
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
    flex1: { flex: 1 },
    actionsRow: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
    number: { width: "12ch" },
  });
  const s = useStyles();

  return (
    <div className={s.section}>
      <div className={s.header}>
        <Text weight="semibold">Segment Adjustments</Text>
        <Button appearance="primary" onClick={startAdd}>
          Add Adjustment
        </Button>
      </div>
      <div className={s.tableWrap}>
        <Table aria-label="Segment adjustments">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Condition Segment</TableHeaderCell>
              <TableHeaderCell>Condition Role</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
              <TableHeaderCell>Field</TableHeaderCell>
              <TableHeaderCell>Baseline</TableHeaderCell>
              <TableHeaderCell>Offset (min)</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.condition_segment}</TableCell>
                <TableCell>{roles.find((ro:any)=>ro.id===r.condition_role_id)?.name || ""}</TableCell>
                <TableCell>{r.target_segment}</TableCell>
                <TableCell>{r.target_field}</TableCell>
                <TableCell>{r.baseline}</TableCell>
                <TableCell>{r.offset_minutes}</TableCell>
                <TableCell>
                  <div className={s.actionsRow}>
                    <Button size="small" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button size="small" appearance="secondary" onClick={() => remove(r.id)}>
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
        <div className={s.section}>
          <div className={s.row}>
            <Field label="Condition Segment" className={s.flex1}>
              <Dropdown
                selectedOptions={[form.condition_segment]}
                onOptionSelect={(_, d) => setForm({ ...form, condition_segment: d.optionValue })}
              >
                {segments.map((sg) => (
                  <Option key={sg.name} value={sg.name}>
                    {sg.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Condition Role" className={s.flex1}>
              <Dropdown
                selectedOptions={[form.condition_role_id == null ? "" : String(form.condition_role_id)]}
                onOptionSelect={(_, d) =>
                  setForm({ ...form, condition_role_id: d.optionValue ? Number(d.optionValue) : null })
                }
              >
                <Option value="">Any</Option>
                {roles.map((ro: any) => (
                  <Option key={ro.id} value={String(ro.id)}>
                    {ro.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Target Segment" className={s.flex1}>
              <Dropdown
                selectedOptions={[form.target_segment]}
                onOptionSelect={(_, d) => setForm({ ...form, target_segment: d.optionValue })}
              >
                {segments.map((sg) => (
                  <Option key={sg.name} value={sg.name}>
                    {sg.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Field" className={s.flex1}>
              <Dropdown
                selectedOptions={[form.target_field]}
                onOptionSelect={(_, d) =>
                  setForm({ ...form, target_field: d.optionValue as "start" | "end" })
                }
              >
                <Option value="start">start</Option>
                <Option value="end">end</Option>
              </Dropdown>
            </Field>
          </div>
          <div className={s.row}>
            <Field label="Baseline" className={s.flex1}>
              <Dropdown
                selectedOptions={[form.baseline]}
                onOptionSelect={(_, d) =>
                  setForm({ ...form, baseline: d.optionValue as SegmentAdjustmentRow["baseline"] })
                }
              >
                {baselineOpts.map((o) => (
                  <Option key={o.value} value={o.value}>
                    {o.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Offset Minutes" className={s.number}>
              <Input
                type="number"
                value={String(form.offset_minutes)}
                onChange={(_, d) =>
                  setForm({ ...form, offset_minutes: Number(d.value || 0) })
                }
              />
            </Field>
          </div>
          <div className={s.row}>
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
