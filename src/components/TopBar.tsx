import * as React from "react";
import { makeStyles, tokens, Text, Tooltip, Toolbar as FluentToolbar, ToolbarButton, ToolbarDivider, Spinner } from "@fluentui/react-components";
import { Add20Regular, FolderOpen20Regular, Save20Regular, SaveCopy20Regular } from "@fluentui/react-icons";

interface TopBarProps {
  appName?: string;
  ready: boolean;
  sqlDb: any;
  canSave: boolean;
  createNewDb: () => void;
  openDbFromFile: () => void;
  saveDb: () => void;
  saveDbAs: () => void;
  status: string;
}

const useStyles = makeStyles({
  root: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  left: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM },
  actionsBar: { alignItems: 'center' },
  status: { color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 },
});

export default function TopBar({ appName = 'Scheduler', ready, sqlDb, canSave, createNewDb, openDbFromFile, saveDb, saveDbAs, status }: TopBarProps){
  const s = useStyles();
  return (
    <header className={s.root}>
      <div className={s.left}>
        <img src="/favicon-32x32.png" alt={appName} width={32} height={32} />
        {!sqlDb && <Tooltip content="No database loaded" relationship="label"><Spinner size="tiny" /></Tooltip>}
        <FluentToolbar aria-label="File actions" className={s.actionsBar} size="small">
          <Tooltip content="New DB" relationship="label">
            <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={createNewDb}>New</ToolbarButton>
          </Tooltip>
          <Tooltip content="Open DB" relationship="label">
            <ToolbarButton icon={<FolderOpen20Regular />} onClick={openDbFromFile}>Open</ToolbarButton>
          </Tooltip>
          <ToolbarDivider />
          <Tooltip content="Save" relationship="label">
            <ToolbarButton icon={<Save20Regular />} onClick={saveDb} disabled={!canSave}>Save</ToolbarButton>
          </Tooltip>
          <Tooltip content="Save As" relationship="label">
            <ToolbarButton icon={<SaveCopy20Regular />} onClick={saveDbAs} disabled={!sqlDb}>Save As</ToolbarButton>
          </Tooltip>
        </FluentToolbar>
      </div>
      <Text size={200} className={s.status}>{status}</Text>
    </header>
  );
}
