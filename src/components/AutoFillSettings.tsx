import React, { useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Dropdown,
  Option,
} from "@fluentui/react-components";

const STORAGE_KEY = "autoFillPriority";

export function getAutoFillPriority(): string {
  if (typeof localStorage === "undefined") return "trained";
  return localStorage.getItem(STORAGE_KEY) || "trained";
}

interface AutoFillSettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function AutoFillSettings({ open, onClose }: AutoFillSettingsProps) {
  const [priority, setPriority] = useState<string>(() => getAutoFillPriority());

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, priority);
    } catch {}
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Auto-Fill Priority</DialogTitle>
          <DialogContent>
            <Dropdown
              selectedOptions={[priority]}
              onOptionSelect={(_, data) => setPriority(String(data.optionValue))}
            >
              <Option value="trained">Trained first</Option>
              <Option value="alphabetical">Alphabetical</Option>
            </Dropdown>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={handleSave}>Save</Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
