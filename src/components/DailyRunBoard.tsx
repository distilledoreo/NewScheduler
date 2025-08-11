import React, { useEffect, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Segment } from "../config/domain";

const Grid = WidthProvider(GridLayout);

interface DailyRunBoardProps {
  activeRunSegment: Exclude<Segment, "Early">;
  setActiveRunSegment: (seg: Exclude<Segment, "Early">) => void;
  groups: any[];
  lockEmail: string;
  sqlDb: any | null;
  all: (sql: string, params?: any[], db?: any) => any[];
  roleListForSegment: (segment: Segment) => any[];
  selectedDate: string;
  selectedDateObj: Date;
  setSelectedDate: (date: string) => void;
  fmtDateMDY: (d: Date) => string;
  parseYMD: (s: string) => Date;
  ymd: (d: Date) => string;
  setShowNeedsEditor: (v: boolean) => void;
  diag: { passed: number; failed: number; details: string[] } | null;
  canEdit: boolean;
  peopleOptionsForSegment: (
    date: Date,
    segment: Exclude<Segment, "Early">,
    role: any
  ) => Array<{ id: number; label: string; blocked: boolean }>;
  getRequiredFor: (
    date: Date,
    groupId: number,
    roleId: number,
    segment: Segment
  ) => number;
  addAssignment: (
    dateMDY: string,
    personId: number,
    roleId: number,
    segment: Segment
  ) => void;
  deleteAssignment: (id: number) => void;
}

export default function DailyRunBoard({
  activeRunSegment,
  setActiveRunSegment,
  groups,
  lockEmail,
  sqlDb,
  all,
  roleListForSegment,
  selectedDate,
  selectedDateObj,
  setSelectedDate,
  fmtDateMDY,
  parseYMD,
  ymd,
  setShowNeedsEditor,
  diag,
  canEdit,
  peopleOptionsForSegment,
  getRequiredFor,
  addAssignment,
  deleteAssignment,
}: DailyRunBoardProps) {
  const seg: Exclude<Segment, "Early"> = activeRunSegment;
  const [layout, setLayout] = useState<any[]>([]);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  useEffect(() => {
    setLayoutLoaded(false);
    const key = `layout:${seg}:${lockEmail || 'default'}`;
    let saved: any[] = [];
    try {
      const rows = all(`SELECT value FROM meta WHERE key=?`, [key]);
      if (rows[0] && rows[0].value) saved = JSON.parse(String(rows[0].value));
    } catch {}
    const byId = new Map(saved.map((l: any) => [l.i, l]));
    const merged = groups.map((g: any, idx: number) => {
      const roleCount = roleListForSegment(seg).filter((r) => r.group_id === g.id).length;
      const h = Math.max(2, roleCount + 1);
      return byId.get(String(g.id)) || { i: String(g.id), x: (idx % 4) * 3, y: Math.floor(idx / 4) * h, w: 3, h };
    });
    setLayout(merged);
    setLayoutLoaded(true);
  }, [groups, lockEmail, seg, roleListForSegment]);

  function handleLayoutChange(l: any[]) {
    setLayout(l);
    if (!layoutLoaded) return;
    const key = `layout:${seg}:${lockEmail || 'default'}`;
    try {
      const stmt = sqlDb.prepare(`INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)`);
      stmt.bind([key, JSON.stringify(l)]);
      stmt.step();
      stmt.free();
    } catch {}
  }

  function RoleCard({ group, role }: { group: any; role: any }) {
    const assigns = all(
      `SELECT a.id, p.first_name, p.last_name, p.id as person_id FROM assignment a JOIN person p ON p.id=a.person_id WHERE a.date=? AND a.role_id=? AND a.segment=? ORDER BY p.last_name,p.first_name`,
      [ymd(selectedDateObj), role.id, seg]
    );
    const trainedBefore = new Set(
      all(
        `SELECT DISTINCT person_id FROM assignment WHERE role_id=? AND date < ?`,
        [role.id, ymd(selectedDateObj)]
      ).map((r: any) => r.person_id)
    );
    const opts = peopleOptionsForSegment(selectedDateObj, seg, role);

    const req = getRequiredFor(selectedDateObj, group.id, role.id, seg);
    const assignedCount = assigns.length;
    const cardColor =
      assignedCount < req
        ? 'bg-pink-100'
        : assignedCount === req
        ? 'bg-green-50'
        : 'bg-yellow-50';
    const statusColor =
      assignedCount < req
        ? 'bg-red-100 text-red-800'
        : assignedCount === req
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800';
    const isOverstaffed = assignedCount > req;

    function handleMove(a: any, target: any) {
      if (
        confirm(
          `Move ${a.last_name}, ${a.first_name} to ${target.group.name} - ${target.role.name}?`
        )
      ) {
        deleteAssignment(a.id);
        addAssignment(selectedDate, a.person_id, target.role.id, seg);
      }
    }

    return (
      <div className={`border rounded p-2 ${cardColor}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">{role.name}</div>
          <div className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>{assignedCount}/{req}</div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <select
            className="border rounded w-full px-2 py-1"
            defaultValue=""
            disabled={!canEdit}
            onChange={(e) => {
              const pid = Number(e.target.value);
              if (!pid) return;
              const sel = opts.find((o) => o.id === pid);
              if (sel?.blocked) {
                alert("Blocked by time-off for this segment.");
                return;
              }
              addAssignment(selectedDate, pid, role.id, seg);
              (e.target as HTMLSelectElement).value = "";
            }}
          >
            <option value="">{canEdit ? "+ Add person…" : "Add person…"}</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id} disabled={o.blocked}>
                {o.label}
                {o.blocked ? " (Time-off)" : ""}
              </option>
            ))}
          </select>
        </div>
        <ul className="space-y-1">
          {assigns.map((a: any) => (
            <li key={a.id} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
              <span>
                {a.last_name}, {a.first_name}
                {!trainedBefore.has(a.person_id) && " (Untrained)"}
              </span>
              {canEdit && (
                <div className="flex gap-2">
                  {isOverstaffed && (
                    (() => {
                      const target = deficitRoles.find((d: any) => {
                        const opts = peopleOptionsForSegment(selectedDateObj, seg, d.role);
                        return opts.some(
                          (o) => o.id === a.person_id && !o.blocked
                        );
                      });
                      return target ? (
                        <button
                          className="text-blue-600 text-sm"
                          onClick={() => handleMove(a, target)}
                        >
                          Move
                        </button>
                      ) : null;
                    })()
                  )}
                  <button
                    className="text-red-600 text-sm"
                    onClick={() => deleteAssignment(a.id)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const roles = roleListForSegment(seg);
  const assignedCountRows = all(
    `SELECT role_id, COUNT(*) as c FROM assignment WHERE date=? AND segment=? GROUP BY role_id`,
    [ymd(selectedDateObj), seg]
  );
  const assignedCountMap = new Map<number, number>(
    assignedCountRows.map((r: any) => [r.role_id, r.c])
  );
  const groupMap = new Map(groups.map((g: any) => [g.id, g]));
  const deficitRoles = roles
    .map((r: any) => {
      const assigned = assignedCountMap.get(r.id) || 0;
      const req = getRequiredFor(selectedDateObj, r.group_id, r.id, seg);
      return assigned < req ? { role: r, group: groupMap.get(r.group_id) } : null;
    })
    .filter(Boolean) as Array<{ role: any; group: any }>;

  return (
    <div className="p-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm whitespace-nowrap">Date</label>
          <input
            type="date"
            className="border rounded px-2 py-1 min-w-0"
            value={ymd(selectedDateObj)}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSelectedDate(fmtDateMDY(parseYMD(v)));
            }}
          />
        </div>
        <div className="flex gap-2">
          {["AM", "Lunch", "PM"].map((s) => (
            <button
              key={s}
              className={`px-3 py-1 rounded text-sm ${
                activeRunSegment === s ? "bg-indigo-600 text-white" : "bg-slate-200"
              }`}
              onClick={() => setActiveRunSegment(s as Exclude<Segment, "Early">)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <button
            className="px-3 py-2 bg-slate-200 rounded text-sm"
            onClick={() => setShowNeedsEditor(true)}
          >
            Edit Needs for This Day
          </button>
        </div>
      </div>

      <Grid
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={80}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
      >
        {groups.map((g: any) => {
          const rolesForGroup = roles.filter((r) => r.group_id === g.id);
          const groupNeedsMet = rolesForGroup.every((r: any) => {
            const assignedCount = assignedCountMap.get(r.id) || 0;
            const req = getRequiredFor(selectedDateObj, g.id, r.id, seg);
            return assignedCount >= req;
          });
          const groupColor = groupNeedsMet ? 'bg-green-50' : 'bg-pink-100';
          return (
            <div
              key={String(g.id)}
              className={`border rounded-lg shadow-sm flex flex-col h-full ${groupColor}`}
            >
              <div className="font-semibold flex items-center justify-between mb-2 drag-handle px-3 pt-3">
                <span>{g.name}</span>
                <span className="text-xs text-slate-500">Theme: {g.theme_color || '-'}</span>
              </div>
              <div
                className="flex-1 grid gap-3 px-3 pb-3 overflow-auto"
                style={{ gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))" }}
              >
                {rolesForGroup.map((r: any) => (
                  <RoleCard key={r.id} group={g} role={r} />
                ))}
              </div>
            </div>
          );
        })}
      </Grid>

      {diag && (
        <div className="mt-6 border rounded bg-white p-3">
          <div className="font-semibold mb-2">Diagnostics</div>
          <div className="text-sm mb-2">Passed: {diag.passed} | Failed: {diag.failed}</div>
          <ul className="text-sm list-disc ml-5 space-y-1">
            {diag.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

