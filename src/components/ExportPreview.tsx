import React, { useMemo } from "react";

interface ExportPreviewProps {
  sqlDb: any;
  exportStart: string;
  exportEnd: string;
  setExportStart: (v: string) => void;
  setExportEnd: (v: string) => void;
  exportShifts: () => void;
  all: (sql: string, params?: any[]) => any[];
  segmentTimesForDate: (date: Date) => Record<string, { start: Date; end: Date }>;
  listTimeOffIntervals: (personId: number, date: Date) => Array<{ start: Date; end: Date }>;
  subtractIntervals: (
    start: Date,
    end: Date,
    offs: Array<{ start: Date; end: Date }>
  ) => Array<{ start: Date; end: Date }>;
  groups: any[];
  people: any[];
  roles: any[];
}

export default function ExportPreview({
  sqlDb,
  exportStart,
  exportEnd,
  setExportStart,
  setExportEnd,
  exportShifts,
  all,
  segmentTimesForDate,
  listTimeOffIntervals,
  subtractIntervals,
  groups,
  people,
  roles,
}: ExportPreviewProps) {
  function pad2(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
  }
  function fmtDateMDY(d: Date): string {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const y = d.getFullYear();
    return `${m}/${day}/${y}`;
  }
  function fmtTime24(d: Date): string {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function ymd(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function parseYMD(str: string): Date {
    const [y, m, d] = str.split("-").map((s) => parseInt(s, 10));
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
  }
  function weekdayName(d: Date): string {
    const n = d.getDay();
    switch (n) {
      case 1:
        return "Monday";
      case 2:
        return "Tuesday";
      case 3:
        return "Wednesday";
      case 4:
        return "Thursday";
      case 5:
        return "Friday";
      default:
        return "Weekend";
    }
  }

  const previewRows = useMemo(() => {
    if (!sqlDb) return [] as any[];
    const start = parseYMD(exportStart);
    const end = parseYMD(exportEnd);
    if (end < start) return [] as any[];
    const rows: any[] = [];
    let d = new Date(start.getTime());
    while (d <= end) {
      if (weekdayName(d) !== "Weekend") {
        const dYMD = ymd(d);
        const assigns = all(
          `SELECT a.id, a.person_id, a.role_id, a.segment,
                  p.first_name, p.last_name, p.work_email,
                  r.name as role_name, r.code as role_code, r.group_id,
                  g.name as group_name
           FROM assignment a
           JOIN person p ON p.id=a.person_id
           JOIN role r ON r.id=a.role_id
           JOIN grp g  ON g.id=r.group_id
           WHERE a.date=?`,
          [dYMD]
        );

        const segMap = segmentTimesForDate(d);
        for (const a of assigns) {
          const seg = segMap[a.segment];
          if (!seg) continue;
          let windows: Array<{ start: Date; end: Date }> = [
            { start: seg.start, end: seg.end },
          ];
          let group = a.group_name;

          const intervals = listTimeOffIntervals(a.person_id, d);
          for (const w of windows) {
            const split = subtractIntervals(w.start, w.end, intervals);
            for (const s of split) {
              rows.push({
                date: fmtDateMDY(d),
                member: `${a.last_name}, ${a.first_name}`,
                email: a.work_email,
                group,
                start: fmtTime24(s.start),
                end: fmtTime24(s.end),
                label: a.role_name,
                color: groups.find((gg) => gg.name === group)?.theme || "",
              });
            }
          }
        }
      }
      d = addMinutes(d, 24 * 60);
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlDb, exportStart, exportEnd, people.length, roles.length]);

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <label>Start</label>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={exportStart}
          onChange={(e) => setExportStart(e.target.value)}
        />
        <label>End</label>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={exportEnd}
          onChange={(e) => setExportEnd(e.target.value)}
        />
        <button
          className="ml-auto px-3 py-2 bg-emerald-700 text-white rounded"
          onClick={exportShifts}
        >
          Download XLSX
        </button>
      </div>
      <div className="overflow-auto max-h-[60vh] border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Member</th>
              <th className="p-2 text-left">Work Email</th>
              <th className="p-2 text-left">Group</th>
              <th className="p-2 text-left">Start</th>
              <th className="p-2 text-left">End</th>
              <th className="p-2 text-left">Custom Label</th>
              <th className="p-2 text-left">Theme</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-slate-50">
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.member}</td>
                <td className="p-2">{r.email}</td>
                <td className="p-2">{r.group}</td>
                <td className="p-2">{r.start}</td>
                <td className="p-2">{r.end}</td>
                <td className="p-2">{r.label}</td>
                <td className="p-2">{r.color}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-slate-500 text-sm mt-2">Rows: {previewRows.length}</div>
    </div>
  );
}

