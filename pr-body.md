Title: Migrate UI to Fluent React v9 (phase 1)

Summary
- Introduces Fluent UI React v9 across key areas of the app for a consistent, accessible design system.
- Adds theme toggle (light/dark) with persistence and moves FluentProvider into App for runtime theming.
- Applies code-splitting to reduce initial bundle (lazy-load heavy views).

Scope of changes
- App shell: Theming moved into App; FluentProvider switches between webLightTheme/webDarkTheme.
- Toolbar: Converted to Fluent (Button, TabList/Tab, Text, Spinner) and added Dark mode switch.
- DailyRunBoard: Segment tabs, date input, add-person dropdown, move dialog, and actions → Fluent.
- Admin editors:
	- SegmentEditor → Fluent Table, Field/Input, Button.
	- ExportGroupEditor → Fluent Table, Field/Input, Dropdown/Option, Button.
- People & Needs in App.tsx:
	- PeopleEditor modal and availability pickers → Fluent (Input, Dropdown/Option, Checkbox, Button).
	- RequiredCell and Needs modal buttons → Fluent.
- Other components:
	- GroupEditor & RoleEditor → Fluent tables/forms.
	- MonthlyDefaults → Fluent Table for the main grid.
	- CrewHistoryView → Fluent Table for the main grid.
	- ExportPreview → Fluent action button (kept native date inputs for simplicity).
- Code-splitting: DailyRunBoard, ExportPreview, and AdminView are lazy-loaded with Suspense fallbacks.

Out of scope (follow-ups)
- Optional: System theme option (auto)
- Optional: Further table polish (sticky headers, virtualization) if needed for large datasets

Testing/verification
- Local typecheck/build via Vite: PASS.
- Verified basic interactions: creating/opening DB, Daily Run add/remove/move, admin editors CRUD, People modal, Needs editor, Export preview actions.
- Verified theme toggle persists and restores across reloads.

Notes
- sql.js warning about externalized Node modules is expected under Vite; functional in browser.

Checklist
- [x] App wrapped in FluentProvider with runtime theming
- [x] Key pages migrated to Fluent v9
- [x] MonthlyDefaults and CrewHistoryView tables migrated to Fluent Table
- [x] Code-splitting for heavy views (DailyRunBoard, ExportPreview, AdminView)
- [x] Theme toggle (light/dark) with localStorage persistence
- [x] Build/typecheck passes

