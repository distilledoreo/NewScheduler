import React from "react";
import { Button, Input, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell, makeStyles, tokens } from "@fluentui/react-components";

interface SkillsEditorProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
}

type SkillRow = { id: number; code: string; name: string; active: number; ordering: number | null };

export default function SkillsEditor({ all, run, refresh }: SkillsEditorProps) {
  const useStyles = makeStyles({
    root: { display: 'grid', gap: tokens.spacingVerticalS },
    row: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center', flexWrap: 'wrap' },
    tableWrap: { overflow: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge },
    code: { width: '140px' },
    name: { minWidth: '240px', flex: 1 },
    actions: { display: 'flex', gap: tokens.spacingHorizontalS },
  });
  const s = useStyles();

  const [rows, setRows] = React.useState<SkillRow[]>([]);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");

  const load = React.useCallback(() => {
    const res = all(`SELECT s.id, s.code, s.name, s.active, o.ordering
                     FROM skill s
                     LEFT JOIN skill_order o ON o.skill_id=s.id
                     ORDER BY COALESCE(o.ordering, 9999), s.name`);
    const list: SkillRow[] = (res || []).map((r: any) => ({
      id: r.id, code: String(r.code), name: String(r.name), active: Number(r.active ?? 1), ordering: r.ordering ?? null,
    }));
    setRows(list);
  }, [all]);

  React.useEffect(() => { load(); }, [load]);

  function addSkill() {
    const c = code.trim();
    const n = name.trim();
    if (!c || !n) return;
    run(`INSERT INTO skill (code, name, active) VALUES (?,?,1)`, [c, n]);
    setCode("");
    setName("");
    load();
    refresh();
  }

  function removeSkill(id: number) {
    // Soft delete by deactivating to avoid breaking references
    run(`UPDATE skill SET active=0 WHERE id=?`, [id]);
    load();
    refresh();
  }

  function move(id: number, dir: -1 | 1) {
    const ordered = rows.map(r => r).sort((a,b) => (a.ordering ?? 9999) - (b.ordering ?? 9999));
    const idx = ordered.findIndex(r => r.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    const aOrd = a.ordering ?? (idx+1);
    const bOrd = b.ordering ?? (swapIdx+1);
    run(`INSERT INTO skill_order (skill_id, ordering) VALUES (?,?) ON CONFLICT(skill_id) DO UPDATE SET ordering=excluded.ordering`, [a.id, bOrd]);
    run(`INSERT INTO skill_order (skill_id, ordering) VALUES (?,?) ON CONFLICT(skill_id) DO UPDATE SET ordering=excluded.ordering`, [b.id, aOrd]);
    load();
    refresh();
  }

  return (
    <div className={s.root}>
      <div className={s.row}>
        <Input className={s.code} placeholder="Code" value={code} onChange={(_,d)=>setCode(d.value)} />
        <Input className={s.name} placeholder="Name" value={name} onChange={(_,d)=>setName(d.value)} />
        <Button appearance="primary" onClick={addSkill}>Add</Button>
      </div>
      <div className={s.tableWrap}>
        <Table size="small" aria-label="Skills">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Active</TableHeaderCell>
              <TableHeaderCell>Order</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.active ? 'Yes' : 'No'}</TableCell>
                <TableCell className={s.actions}>
                  <Button size="small" onClick={() => move(r.id, -1)}>Up</Button>
                  <Button size="small" onClick={() => move(r.id, 1)}>Down</Button>
                </TableCell>
                <TableCell>
                  <Button appearance="subtle" onClick={() => removeSkill(r.id)}>Deactivate</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
