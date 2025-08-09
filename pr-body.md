## Summary
Adds robust time-off XLSX import and introduces Early segment across the scheduling application.

## Key Changes
- Time-Off Import: flexible email header detection, case-insensitive matching, tolerant time parsing (HH:MM, AM/PM, compact), improved diagnostics with unmatched preview.
- Segment Expansion: Added "Early" segment into domain (already present) now surfaced across Daily Run, Monthly Defaults, Crew History, Needs (overrides), Baseline editor, and coverage calculations.
- Monthly Defaults: Early segment selectable/stored/applied when availability permits.
- Needs & Baseline: Dynamic segment grid per role; Early requirements configurable (no longer forced to zero).
- Coverage: Role cards and export include Early; required vs assigned indicators reflect Early requirements.
- Export: Early assignments mapped to Dining Room group with proper time window split around time-off.

## Notes
- Time-off blocks are not enforced for Early when adding assignments (consistent with prior behavior). Can be adjusted later.
- Added local git user.email temporarily for commit; please update if needed.

## Testing
- Ran in-browser diagnostics (Run Diagnostics button) – all tests pass.
- Verified import with sample XLSX (emails normalized) – status message reports counts.
- Spot-checked Early requirement save & coverage indicators.

## Migration
No schema changes beyond existing migrations; Early already included in Segment enum.

## Next Ideas (Not Included)
- Optional enforcement of time-off for Early.
- Aggregated daily coverage summary bar including Early.
- Unit tests harness (e.g., Vitest) around time parsing & interval subtraction.

---
Let me know if any adjustments are desired before merge.
