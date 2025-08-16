Title: Migrate UI to Fluent React v9 (phase 1)

Summary
- Introduces Fluent UI React v9 across key areas of the app for a consistent, accessible design system.
- Wraps app with FluentProvider/theme and progressively migrates controls.

Scope of changes
- App shell: Added FluentProvider with webLightTheme.
- Toolbar: Converted to Fluent (Button, TabList/Tab, Text, Spinner).
- DailyRunBoard: Segment tabs, date input, add-person dropdown, move dialog, and actions → Fluent.
- Admin editors:
	- SegmentEditor → Fluent Table, Field/Input, Button.
	- ExportGroupEditor → Fluent Table, Field/Input, Dropdown/Option, Button.
- People & Needs in App.tsx:
	- PeopleEditor modal and availability pickers → Fluent (Input, Dropdown/Option, Checkbox, Button).
	- RequiredCell and Needs modal buttons → Fluent.
- Other components:
	- GroupEditor & RoleEditor → Fluent tables/forms.
	- ExportPreview → Fluent action button (kept native date inputs for simplicity).

Out of scope (follow-ups)
- Convert MonthlyDefaults and CrewHistory tables to Fluent Table (they use Fluent for filters/controls already).
- Add theme toggle (light/dark) at the top level.
- Consider code-splitting for large bundle warning.

Testing/verification
- Local build via Vite: PASS.
- Verified basic interactions: creating/opening DB, Daily Run add/remove/move, admin editors CRUD, People modal, Needs editor, Export preview actions.

Notes
- sql.js warning about externalized Node modules is expected under Vite; functional in browser.

Checklist
- [x] App wrapped in FluentProvider
- [x] Key pages migrated to Fluent v9
- [x] Build passes
- [ ] Optional: Theme toggle (follow-up)
- [ ] Optional: Convert remaining tables to Fluent (follow-up)

