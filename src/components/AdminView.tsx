import React from "react";
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
  return (
    <div className="p-4 space-y-8">
      <SegmentEditor all={all} run={run} refresh={refresh} />
      <GroupEditor all={all} run={run} refresh={refresh} />
      <RoleEditor all={all} run={run} refresh={refresh} segments={segments} />
      <ExportGroupEditor all={all} run={run} refresh={refresh} />
    </div>
  );
}
