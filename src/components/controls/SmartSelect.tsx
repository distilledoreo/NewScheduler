import React, { useMemo } from "react";
import { Combobox, Option } from "@fluentui/react-components";

export interface SmartOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SmartSelectProps {
  options: SmartOption[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function SmartSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  style,
}: SmartSelectProps) {
  // Create a stable signature to force remount when value/options truly change
  const optionsKey = useMemo(
    () => options.map(o => `${o.value}:${o.label}`).join(","),
    [options]
  );

  return (
    <Combobox
      key={`smart-${value ?? ""}-${optionsKey}`}
      selectedOptions={value ? [value] : []}
      onOptionSelect={(_, data) => {
        const v = data.optionValue ?? null;
        onChange(v ?? null);
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={style}
    >
      {options.map((o) => (
        <Option key={o.value} value={o.value} disabled={o.disabled} text={o.label}>
          {o.label}
        </Option>
      ))}
    </Combobox>
  );
}
