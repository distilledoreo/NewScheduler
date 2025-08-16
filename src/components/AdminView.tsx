import React from "react";
import { makeStyles } from "@fluentui/react-components";
import SegmentEditor from "./SegmentEditor";
import GroupEditor from "./GroupEditor";
import RoleEditor from "./RoleEditor";
import ExportGroupEditor from "./ExportGroupEditor";
import type { SegmentRow } from "../services/segments";

interface AdminViewProps {
  all: (sql: string, params?: any[]) => any[];
  run: (sql: string, params?: any[]) => void;
  refresh: () => void;
  segments: SegmentRow[];
}

export default function AdminView({ all, run, refresh, segments }: AdminViewProps) {
  const useStyles = makeStyles({
    root: {
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      rowGap: "24px",
    },
  });
  const s = useStyles();
  return (
    <div className={s.root}>
      <SegmentEditor all={all} run={run} refresh={refresh} />
      <GroupEditor all={all} run={run} refresh={refresh} />
      <RoleEditor all={all} run={run} refresh={refresh} segments={segments} />
      <ExportGroupEditor all={all} run={run} refresh={refresh} />
    </div>
  );
}
