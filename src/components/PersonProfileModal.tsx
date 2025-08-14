import React from "react";

interface PersonProfileModalProps {
  personId: number;
  onClose: () => void;
  all: (sql: string, params?: any[]) => any[];
}

function fmtAvail(v: string) {
  switch (v) {
    case "AM":
      return "AM";
    case "PM":
      return "PM";
    case "B":
      return "Both";
    default:
      return "Unavailable";
  }
}

export default function PersonProfileModal({ personId, onClose, all }: PersonProfileModalProps) {
  const person = all(`SELECT * FROM person WHERE id=?`, [personId])[0];
  if (!person) return null;
  const assignments = all(
    `SELECT a.date, a.segment, r.name as role_name FROM assignment a JOIN role r ON r.id=a.role_id WHERE a.person_id=? ORDER BY a.date DESC LIMIT 20`,
    [personId]
  );

  const availability = [
    { day: "Mon", value: person.avail_mon },
    { day: "Tue", value: person.avail_tue },
    { day: "Wed", value: person.avail_wed },
    { day: "Thu", value: person.avail_thu },
    { day: "Fri", value: person.avail_fri },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded shadow-lg p-4 w-96 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">
            {person.first_name} {person.last_name}
          </div>
          <button className="text-slate-600 hover:text-slate-800" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mb-4 text-sm">
          <div className="font-medium mb-1">Info</div>
          <div>Email: {person.work_email}</div>
          <div>Status: {person.active ? "Active" : "Inactive"}</div>
          <div>Brother/Sister: {person.brother_sister || "-"}</div>
          <div>Commuter: {person.commuter ? "Yes" : "No"}</div>
        </div>
        <div className="mb-4 text-sm">
          <div className="font-medium mb-1">Availability</div>
          <ul className="list-disc ml-4">
            {availability.map((a) => (
              <li key={a.day}>
                {a.day}: {fmtAvail(a.value)}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-1">Assignment History</div>
          <ul className="list-disc ml-4">
            {assignments.map((a: any, idx: number) => (
              <li key={idx}>
                {a.date} {a.segment} - {a.role_name}
              </li>
            ))}
            {assignments.length === 0 && <li>None</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
