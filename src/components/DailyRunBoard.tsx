import React, { useState } from "react";
import type { Segment } from "../config/domain";
import PersonName from "./PersonName";

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
  const [moveContext, setMoveContext] = useState<{
    assignment: any;
    targets: Array<{ role: any; group: any }>;
  } | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<number | null>(null);

  function RoleCard({ group, role }: { group: any; role: any }) {
    const assigns = all(
      `SELECT a.id, p.first_name, p.last_name, p.id as person_id FROM assignment a JOIN person p ON p.id=a.person_id WHERE a.date=? AND a.role_id=? AND a.segment=? ORDER BY p.last_name,p.first_name`,
      [ymd(selectedDateObj), role.id, seg]
    );
    const trainedBefore = new Set([
      ...all(`SELECT person_id FROM training WHERE role_id=? AND status='Qualified'`, [role.id]).map(
        (r: any) => r.person_id
      ),
      ...all(
        `SELECT DISTINCT person_id FROM assignment WHERE role_id=? AND date < ?`,
        [role.id, ymd(selectedDateObj)]
      ).map((r: any) => r.person_id),
    ]);
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

    function handleMove(a: any, targets: any[]) {
      if (!targets.length) return;
      setMoveContext({ assignment: a, targets });
      setMoveTargetId(null);
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
              <PersonName personId={a.person_id}>
                {a.last_name}, {a.first_name}
                {!trainedBefore.has(a.person_id) && " (Untrained)"}
              </PersonName>
              {canEdit && (
                <div className="flex gap-2">
                  {isOverstaffed && (
                    (() => {
                      const targets = deficitRoles.filter((d: any) => {
                        const opts = peopleOptionsForSegment(selectedDateObj, seg, d.role);
                        return opts.some(
                          (o) => o.id === a.person_id && !o.blocked
                        );
                      });
                      return targets.length ? (
                        <button
                          className="text-blue-600 text-sm"
                          onClick={() => handleMove(a, targets)}
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

  function confirmMove() {
    if (!moveContext || moveTargetId == null) return;
    const chosen = moveContext.targets.find((t) => t.role.id === moveTargetId);
    if (!chosen) return;
    if (
      !confirm(
        `Move ${moveContext.assignment.last_name}, ${moveContext.assignment.first_name} to ${chosen.group.name} - ${chosen.role.name}?`
      )
    )
      return;
    deleteAssignment(moveContext.assignment.id);
    addAssignment(selectedDate, moveContext.assignment.person_id, chosen.role.id, seg);
    setMoveContext(null);
    setMoveTargetId(null);
  }

  function cancelMove() {
    setMoveContext(null);
    setMoveTargetId(null);
  }

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

      <div className="grid grid-cols-4 gap-4">
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
              <div className="font-semibold flex items-center justify-between mb-2 px-3 pt-3">
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
      </div>

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

      {moveContext && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-md w-72">
            <div className="mb-2 font-medium">
              Move {moveContext.assignment.last_name}, {moveContext.assignment.first_name} to:
            </div>
            <select
              className="border rounded w-full px-2 py-1 mb-4"
              value={moveTargetId ?? ""}
              onChange={(e) =>
                setMoveTargetId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Select destination</option>
              {moveContext.targets.map((t) => (
                <option key={t.role.id} value={t.role.id}>
                  {t.group.name} - {t.role.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 text-sm bg-slate-200 rounded"
                onClick={cancelMove}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                disabled={moveTargetId == null}
                onClick={confirmMove}
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

