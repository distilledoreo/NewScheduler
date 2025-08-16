# NewScheduler

## Migrations

Opening an older database will automatically rename Buffet AM/PM roles to Dining Room, while the Lunch "Buffet Supervisor" role remains unchanged.

## Adjusting scheduling parameters

Administrative settings are available directly in the application and are saved to the active SQLite database immediately. To change scheduling behaviour without editing code:

1. Load or create a database and open the **Admin** tab.
2. Use the **Segments** panel to add or edit time segments. Start and end times must be entered in `HH:MM` format and the list is ordered by the numeric *Order* field.
3. Manage **Groups** and **Roles** with the corresponding panels. Each form validates required fields and will prompt before deleting records.
4. Configure **Export Groups** to control export codes, colors and column groupings for each group.

On days with any **Lunch** assignments, the AM segment automatically ends at the Lunch start and the PM segment begins one hour after Lunch ends. If a day has an **Early** assignment, the PM segment is shortened by one hour. These adjustments use the segment times defined in the database as their baseline.

All changes are written to the database immediately using the built in SQL helpers, so reopening the database will reflect the updates without further code changes.

