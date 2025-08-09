export const SEGMENTS = ["Early", "AM", "Lunch", "PM"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const GROUPS: Record<string, { theme: string; color: string }> = {
  "Bakery": { theme: "4. Purple", color: "#e9d5ff" },
  "Lunch": { theme: "11. DarkPink", color: "#f9a8d4" },
  "Dining Room": { theme: "12. DarkYellow", color: "#fde68a" },
  "Veggie Room": { theme: "3. Green", color: "#bbf7d0" },
  "Machine Room": { theme: "10. DarkPurple", color: "#c4b5fd" },
  "Main Course": { theme: "5. Pink", color: "#fbcfe8" },
  "Prepack": { theme: "9. DarkGreen", color: "#a7f3d0" },
  "Office": { theme: "12. DarkYellow", color: "#fde68a" },
  "Receiving": { theme: "8. DarkBlue", color: "#bfdbfe" },
  "Weekend Duty": { theme: "5. Pink", color: "#fbcfe8" },
};

export const ROLE_SEED: Array<{ code: string; name: string; group: keyof typeof GROUPS; segments: Segment[] }> = [
  { code: "DR", name: "Buffet", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Buffet Training", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Buffet Sup", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Buffet Assistant", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Pattern", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Pattern Training", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Pattern Supervisor", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Pattern Assistant", group: "Dining Room", segments: ["AM", "PM"] },
  { code: "DR", name: "Breakfast", group: "Dining Room", segments: ["Early"] },

  { code: "MR", name: "MRC", group: "Machine Room", segments: ["AM", "PM"] },
  { code: "MR", name: "Feeder", group: "Machine Room", segments: ["AM", "PM"] },
  { code: "MR", name: "Silverware", group: "Machine Room", segments: ["AM", "PM"] },
  { code: "MR", name: "Cold End", group: "Machine Room", segments: ["AM", "PM"] },
  { code: "MR", name: "Hot End 1", group: "Machine Room", segments: ["AM", "PM"] },
  { code: "MR", name: "Hot End 2", group: "Machine Room", segments: ["AM", "PM"] },
  { code: "MR", name: "MR Assist", group: "Machine Room", segments: ["AM", "PM"] },

  { code: "MC", name: "Main Course", group: "Main Course", segments: ["AM", "PM"] },
  { code: "MC", name: "Main Course Coordinator", group: "Main Course", segments: ["AM", "PM"] },
  { code: "MC", name: "Main Course Assistant", group: "Main Course", segments: ["AM", "PM"] },

  { code: "VEG", name: "Veggie Room", group: "Veggie Room", segments: ["AM", "PM"] },
  { code: "VEG", name: "Veggie Room Coordinator", group: "Veggie Room", segments: ["AM", "PM"] },
  { code: "VEG", name: "Veggie Room Assistant", group: "Veggie Room", segments: ["AM", "PM"] },

  { code: "BKRY", name: "Bakery", group: "Bakery", segments: ["AM", "PM"] },
  { code: "BKRY", name: "Bakery Coordinator", group: "Bakery", segments: ["AM", "PM"] },
  { code: "BKRY", name: "Bakery Assistant", group: "Bakery", segments: ["AM", "PM"] },

  { code: "RCVG", name: "Receiving", group: "Receiving", segments: ["AM", "PM"] },

  { code: "PP", name: "Prepack", group: "Prepack", segments: ["AM", "PM"] },
  { code: "PP", name: "Prepack Coordinator", group: "Prepack", segments: ["AM", "PM"] },
  { code: "PP", name: "Prepack Backup", group: "Prepack", segments: ["AM", "PM"] },

  { code: "OFF", name: "Office", group: "Office", segments: ["AM", "PM"] },

  { code: "L SUP", name: "Lunch Supervisor", group: "Lunch", segments: ["Lunch"] },
  { code: "B SUP", name: "Buffet Supervisor", group: "Lunch", segments: ["Lunch"] },
  { code: "ATT SUP", name: "Attendant Supervisor", group: "Lunch", segments: ["Lunch"] },
  { code: "R SUP", name: "Guest Supervisor", group: "Lunch", segments: ["Lunch"] },
  { code: "CK-IN", name: "Guest Check-In", group: "Lunch", segments: ["Lunch"] },
  { code: "ATT", name: "Attendant", group: "Lunch", segments: ["Lunch"] },
  { code: "WAITER", name: "Waiter", group: "Lunch", segments: ["Lunch"] },
  { code: "LN ATT", name: "Line Attendant", group: "Lunch", segments: ["Lunch"] },
  { code: "TL", name: "Tray Line", group: "Lunch", segments: ["Lunch"] },
  { code: "ATR", name: "ATR", group: "Lunch", segments: ["Lunch"] },
  { code: "TKO", name: "Take-Out Line", group: "Lunch", segments: ["Lunch"] },
  { code: "ATKO", name: "Assist Take-Out Line", group: "Lunch", segments: ["Lunch"] },

  // Lunch duties in other groups still count as Lunch segment
  { code: "MC", name: "Consolidation Table", group: "Main Course", segments: ["Lunch"] },
  { code: "VEG", name: "Consolidation Table", group: "Veggie Room", segments: ["Lunch"] },
];

export function baseSegmentTimes(date: Date, hasLunch: boolean, hasEarly: boolean): Record<Exclude<Segment, "Early">, { start: Date; end: Date }> {
  // All times in America/New_York implicit local
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mk = (h: number, m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);

  if (hasLunch) {
    // Lunch day pattern
    const am = { start: mk(8, 0), end: mk(11, 0) };
    const lunch = { start: mk(11, 0), end: mk(13, 0) };
    const pm = { start: mk(14, 0), end: mk(hasEarly ? 16 : 17, 0) };
    return { AM: am, Lunch: lunch, PM: pm };
  } else {
    const am = { start: mk(8, 0), end: mk(12, 0) };
    const pm = { start: mk(13, 0), end: mk(hasEarly ? 16 : 17, 0) };
    return { AM: am, Lunch: { start: mk(11, 0), end: mk(13, 0) }, PM: pm }; // Lunch unused if no Lunch assignment; kept for reference
  }
}

export function earlyTimes(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mk = (h: number, m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
  return { start: mk(6, 20), end: mk(7, 20) };
}

