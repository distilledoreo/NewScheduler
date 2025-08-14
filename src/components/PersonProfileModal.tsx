import React from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  Button,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

interface PersonProfileModalProps {
  personId: number;
  onClose: () => void;
  all: (sql: string, params?: any[]) => any[];
}

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "8px",
  },
  sectionTitle: {
    color: tokens.colorNeutralForeground2,
    fontWeight: 600,
    marginBottom: "4px",
  },
  cell: { fontSize: "0.9rem" },
});

function fmtAvail(v: string) {
  switch (v) {
    case "AM":
      return "AM";
    case "PM":
      return "PM";
    case "B":
      return "Both";
    case "U":
    default:
      return "Unknown";
  }
}

export default function PersonProfileModal({ personId, onClose, all }: PersonProfileModalProps) {
  const s = useStyles();

  const person = all('SELECT * FROM person WHERE id=?', [personId])[0];

  const trainings = all(
    'SELECT r.name, t.status FROM training t JOIN role r ON r.id=t.role_id WHERE t.person_id=? ORDER BY r.name',
    [personId]
  );

  const historySql =
    'SELECT a.date, a.segment, r.name as role_name, g.name as group_name ' +
    'FROM assignment a ' +
    'JOIN role r ON r.id=a.role_id ' +
    'JOIN grp g ON g.id=r.group_id ' +
    'WHERE a.person_id=? ORDER BY a.date DESC LIMIT 30';

  const history = all(historySql, [personId]);

  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface aria-describedby={undefined}>
        <DialogTitle>{person.first_name} {person.last_name}</DialogTitle>
        <DialogBody>
          <div className={s.sectionTitle}>Info</div>
          <div className={s.grid}>
            <div className={s.cell}><b>Email:</b> {person.work_email}</div>
            <div className={s.cell}><b>Status:</b> {person.active ? "Active" : "Inactive"}</div>
            <div className={s.cell}><b>Brother/Sister:</b> {person.brother_sister || "-"}</div>
            <div className={s.cell}><b>Commuter:</b> {person.commuter ? "Yes" : "No"}</div>
          </div>

          <div className={s.sectionTitle} style={{ marginTop: 16 }}>Availability</div>
          <div className={s.grid}>
            <div className={s.cell}><b>Mon:</b> {fmtAvail(person.avail_mon)}</div>
            <div className={s.cell}><b>Tue:</b> {fmtAvail(person.avail_tue)}</div>
            <div className={s.cell}><b>Wed:</b> {fmtAvail(person.avail_wed)}</div>
            <div className={s.cell}><b>Thu:</b> {fmtAvail(person.avail_thu)}</div>
            <div className={s.cell}><b>Fri:</b> {fmtAvail(person.avail_fri)}</div>
          </div>

          <div className={s.sectionTitle} style={{ marginTop: 16 }}>Training</div>
          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
            {trainings.map((t: any, idx: number) => (
              <li key={idx} className={s.cell}>{t.name} — {t.status}</li>
            ))}
            {trainings.length === 0 && <div className={s.cell}>No training records.</div>}
          </ul>

          <div className={s.sectionTitle} style={{ marginTop: 16 }}>Recent Assignments</div>
          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
            {history.map((h: any, idx: number) => (
              <li key={idx} className={s.cell}>
                {new Date(h.date).toLocaleDateString()} — {h.segment} — {h.group_name} / {h.role_name}
              </li>
            ))}
            {history.length === 0 && <div className={s.cell}>No recent assignments.</div>}
          </ul>
        </DialogBody>
        <DialogActions>
          <Button appearance="primary" onClick={onClose}>Close</Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
