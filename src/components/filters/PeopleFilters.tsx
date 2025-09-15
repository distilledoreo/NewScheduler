import React from "react";
import { Input, Checkbox, Dropdown, Option, makeStyles, tokens } from "@fluentui/react-components";

export type CommuterFilter = "" | "commuter" | "non";
export type BrotherSister = "" | "Brother" | "Sister";

export interface PeopleFiltersState {
  text: string;
  activeOnly: boolean;
  commuter: CommuterFilter;
  bs: BrotherSister;
}

export const defaultPeopleFilters: PeopleFiltersState = {
  text: "",
  activeOnly: false,
  commuter: "",
  bs: "",
};

export function filterPeopleList<T extends Record<string, any>>(people: T[], state: PeopleFiltersState): T[] {
  const low = state.text.trim().toLowerCase();
  return people
    .filter((p) => !state.activeOnly || Boolean(p.active))
    .filter(
      (p) =>
        state.commuter === "" ||
        (state.commuter === "commuter" && Boolean(p.commuter)) ||
        (state.commuter === "non" && !Boolean(p.commuter))
    )
    .filter((p) => (state.bs ? String(p.brother_sister || "") === state.bs : true))
    .filter((p) => {
      if (!low) return true;
      const hay = [
        p.first_name,
        p.last_name,
        p.email,
        p.brother_sister,
        p.commuter ? "commuter" : "",
        p.active ? "active" : "",
        p.avail_mon,
        p.avail_tue,
        p.avail_wed,
        p.avail_thu,
        p.avail_fri,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(low);
    });
}

const useStyles = makeStyles({
  bar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    alignItems: "end",
    gap: tokens.spacingHorizontalS,
    width: "100%",
  },
  field: { width: "100%" },
});

export function PeopleFiltersBar({
  state,
  onChange,
  showText = true,
  showActive = true,
  showCommuter = true,
  showBS = true,
  textPlaceholder = "Filter people...",
}: {
  state: PeopleFiltersState;
  onChange: (next: Partial<PeopleFiltersState>) => void;
  showText?: boolean;
  showActive?: boolean;
  showCommuter?: boolean;
  showBS?: boolean;
  textPlaceholder?: string;
}) {
  const s = useStyles();
  return (
    <div className={s.bar}>
      {showText && (
        <Input
          className={s.field}
          placeholder={textPlaceholder}
          value={state.text}
          onChange={(_, d) => onChange({ text: d.value })}
        />
      )}
      {showActive && (
        <Checkbox
          label="Active"
          checked={state.activeOnly}
          onChange={(_, d) => onChange({ activeOnly: !!d.checked })}
        />
      )}
      {showCommuter && (
        <Dropdown
          className={s.field}
          placeholder="Commuter"
          selectedOptions={state.commuter ? [state.commuter] : []}
          onOptionSelect={(_, data) => onChange({ commuter: (data.optionValue as CommuterFilter) || "" })}
        >
          <Option value="">All People</Option>
          <Option value="commuter">Commuters</Option>
          <Option value="non">Non-Commuters</Option>
        </Dropdown>
      )}
      {showBS && (
        <Dropdown
          className={s.field}
          placeholder="Brother/Sister"
          selectedOptions={state.bs ? [state.bs] : []}
          onOptionSelect={(_, data) => onChange({ bs: (data.optionValue as BrotherSister) || "" })}
        >
          <Option value="">All B/S</Option>
          <Option value="Brother">Brother</Option>
          <Option value="Sister">Sister</Option>
        </Dropdown>
      )}
    </div>
  );
}

export default PeopleFiltersBar;
