import React from "react";
import { Input, Checkbox, Dropdown, Option, makeStyles, tokens, Label } from "@fluentui/react-components";

export type Gender = "" | "Brother" | "Sister";
export type Enrollment = "full-time" | "commuter" | string;

export interface PeopleFiltersState {
  text: string;
  activeOnly: boolean;
  gender: Gender; // Brother/Sister
  enrollment: Set<Enrollment>; // empty means all
  availDays: Set<1 | 2 | 3 | 4 | 5>; // ISO weekday 1-5
  availMode: "any" | "all"; // any of selected days, or all selected days
}

export const defaultPeopleFilters: PeopleFiltersState = {
  text: "",
  activeOnly: false,
  gender: "",
  enrollment: new Set<Enrollment>(),
  availDays: new Set<1 | 2 | 3 | 4 | 5>(),
  availMode: "any",
};

export function freshPeopleFilters(overrides: Partial<PeopleFiltersState> = {}): PeopleFiltersState {
  return {
    text: "",
    activeOnly: false,
    gender: "",
    enrollment: new Set<Enrollment>(),
    availDays: new Set<1 | 2 | 3 | 4 | 5>(),
    availMode: "any",
    ...overrides,
  };
}

export function filterPeopleList<T extends Record<string, any>>(people: T[], state: PeopleFiltersState): T[] {
  const low = state.text.trim().toLowerCase();
  const days = [1, 2, 3, 4, 5] as const; // Mon..Fri
  const dayKey: Record<number, keyof T> = {
    1: "avail_mon" as keyof T,
    2: "avail_tue" as keyof T,
    3: "avail_wed" as keyof T,
    4: "avail_thu" as keyof T,
    5: "avail_fri" as keyof T,
  };

  return people
    // Active
    .filter((p) => !state.activeOnly || Boolean((p as any).active))
    // Gender
    .filter((p) => (state.gender ? String((p as any).brother_sister || "") === state.gender : true))
    // Enrollment (empty set -> no restriction)
    .filter((p) => {
      if (!state.enrollment || state.enrollment.size === 0) return true;
      const enroll: Enrollment = (p as any).commuter ? "commuter" : "full-time";
      return state.enrollment.has(enroll);
    })
    // Availability day filter
    .filter((p) => {
      const selected = state.availDays || new Set();
      if (selected.size === 0) return true;
      const isAvail = (val: any) => String(val || "U").toUpperCase() !== "U"; // AM/PM/B count as available
      const results: boolean[] = [];
      for (const d of days) {
        if (!selected.has(d as any)) continue;
        const v = (p as any)[dayKey[d] as any];
        results.push(isAvail(v));
      }
      if (state.availMode === "all") return results.length > 0 && results.every(Boolean);
      return results.some(Boolean);
    })
    // Text search
    .filter((p) => {
      if (!low) return true;
      const hay = [
        (p as any).first_name,
        (p as any).last_name,
        (p as any).email,
        (p as any).brother_sister,
        (p as any).commuter ? "commuter" : "",
        (p as any).active ? "active" : "",
        (p as any).avail_mon,
        (p as any).avail_tue,
        (p as any).avail_wed,
        (p as any).avail_thu,
        (p as any).avail_fri,
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
  group: { display: "grid", gap: tokens.spacingHorizontalXS },
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

export function PeopleFiltersBar({
  state,
  onChange,
  showText = true,
  showActive = true,
  showGender = true,
  showEnrollment = true,
  showAvailability = true,
  textPlaceholder = "Filter people...",
}: {
  state: PeopleFiltersState;
  onChange: (next: Partial<PeopleFiltersState>) => void;
  showText?: boolean;
  showActive?: boolean;
  showGender?: boolean;
  showEnrollment?: boolean;
  showAvailability?: boolean;
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
      {showGender && (
        <div className={s.group}>
          <Label>Gender</Label>
          <Dropdown
            className={s.field}
            placeholder="All"
            selectedOptions={state.gender ? [state.gender] : []}
            onOptionSelect={(_, data) => onChange({ gender: (data.optionValue as Gender) || "" })}
          >
            <Option value="" text="All">All</Option>
            <Option value="Brother" text="Brother">Brother</Option>
            <Option value="Sister" text="Sister">Sister</Option>
          </Dropdown>
        </div>
      )}
      {showEnrollment && (
        <div className={s.group}>
          <Label>Enrollment</Label>
          <div className={s.row}>
            <Checkbox
              label="Full-Time"
              checked={state.enrollment?.has("full-time")}
              onChange={(_, d) => {
                const next = new Set(state.enrollment || []);
                if (d.checked) next.add("full-time"); else next.delete("full-time");
                onChange({ enrollment: next });
              }}
            />
            <Checkbox
              label="Commuter"
              checked={state.enrollment?.has("commuter")}
              onChange={(_, d) => {
                const next = new Set(state.enrollment || []);
                if (d.checked) next.add("commuter"); else next.delete("commuter");
                onChange({ enrollment: next });
              }}
            />
          </div>
        </div>
      )}
      {showAvailability && (
        <div className={s.group}>
          <Label>Availability</Label>
          <Dropdown
            className={s.field}
            selectedOptions={[state.availMode]}
            onOptionSelect={(_, data) => onChange({ availMode: (data.optionValue as "any" | "all") || "any" })}
          >
            <Option value="any" text="Any selected days">Any selected days</Option>
            <Option value="all" text="All selected days">All selected days</Option>
          </Dropdown>
          <div className={s.row}>
            {[
              { key: 1 as const, label: "Mon" },
              { key: 2 as const, label: "Tue" },
              { key: 3 as const, label: "Wed" },
              { key: 4 as const, label: "Thu" },
              { key: 5 as const, label: "Fri" },
            ].map((d) => (
              <Checkbox
                key={d.key}
                label={d.label}
                checked={state.availDays?.has(d.key)}
                onChange={(_, data) => {
                  const next = new Set(state.availDays || []);
                  if (data.checked) next.add(d.key); else next.delete(d.key);
                  onChange({ availDays: next });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PeopleFiltersBar;
