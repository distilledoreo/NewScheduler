import React, { useMemo, useState, useEffect } from "react";
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

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const [inputValue, setInputValue] = useState(selectedOption?.label ?? "");

  useEffect(() => {
    setInputValue(selectedOption?.label ?? "");
  }, [selectedOption]);

  return (
    <Combobox
      key={`smart-${value ?? ""}-${optionsKey}`}
      value={inputValue}
      onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
      selectedOptions={value ? [value] : []}
      onOptionSelect={(_, data) => {
        const v = data.optionValue ?? null;
        onChange(v ?? null);
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      // Ensure the combobox never overflows its container so controls
      // in tight grids or tables don't overlap each other.
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {options.map((o) => (
        <Option key={o.value} value={o.value} disabled={o.disabled} text={o.label}>
          {o.label}
        </Option>
      ))}
    </Combobox>
  );
}
