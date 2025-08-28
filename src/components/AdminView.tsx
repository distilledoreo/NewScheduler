import React from "react";
import {
  makeStyles,
  Button,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@fluentui/react-components";
import SegmentEditor from "./SegmentEditor";
import SegmentAdjustmentEditor from "./SegmentAdjustmentEditor";
import GroupEditor from "./GroupEditor";
import RoleEditor from "./RoleEditor";
import ExportGroupEditor from "./ExportGroupEditor";
import type { SegmentRow } from "../services/segments";
import TimeOffManager from "./TimeOffManager";
import AvailabilityOverrideManager from "./AvailabilityOverrideManager";

interface AdminViewProps {
  sqlDb: any;
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
  segments: SegmentRow[];
}

export default function AdminView({ sqlDb, all, run, refresh, segments }: AdminViewProps) {
  const useStyles = makeStyles({
    root: {
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      rowGap: "24px",
    },
  });
  const s = useStyles();
  const [showOverrides, setShowOverrides] = React.useState(false);
  return (
    <div className={s.root}>
      <Button onClick={() => setShowOverrides(true)}>Availability Overrides</Button>
      {showOverrides && (
        <Dialog open onOpenChange={(_, d) => { if (!d.open) setShowOverrides(false); }}>
          <DialogSurface aria-describedby={undefined}>
            <DialogBody>
              <DialogTitle>Availability Overrides</DialogTitle>
              <DialogContent>
                <AvailabilityOverrideManager sqlDb={sqlDb} all={all} refresh={refresh} />
              </DialogContent>
              <DialogActions>
                <Button appearance="primary" onClick={() => setShowOverrides(false)}>Close</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
      <TimeOffManager all={all} run={run} refresh={refresh} />
      <SegmentEditor all={all} run={run} refresh={refresh} />
      <SegmentAdjustmentEditor all={all} run={run} refresh={refresh} segments={segments} />
      <GroupEditor all={all} run={run} refresh={refresh} />
      <RoleEditor all={all} run={run} refresh={refresh} segments={segments} />
      <ExportGroupEditor all={all} run={run} refresh={refresh} />
    </div>
  );
}
