# NewScheduler

## Migrations

Opening an older database will automatically rename Buffet AM/PM roles to Dining Room, while the Lunch "Buffet Supervisor" role remains unchanged.

## Adjusting scheduling parameters

Administrative settings are available directly in the application and are saved to the active SQLite database immediately. To change scheduling behaviour without editing code:

1. Load or create a database and open the **Admin** tab.
2. Use the **Segments** panel to add or edit time segments. Start and end times must be entered in `HH:MM` format and the list is ordered by the numeric *Order* field.
3. Manage **Groups** and **Roles** with the corresponding panels. Each form validates required fields and will prompt before deleting records.
4. Configure **Export Groups** to control export codes, colors and column groupings for each group.
5. Use **Segment Adjustments** to define conditional time offsets. Rules can shift the start or end of a segment when another segment has assignments. Each rule can optionally require a specific role in the condition segment, and the editor includes a visual preview showing how the rule will change segment times. Default rules are included for Lunch and Early shifts.

All changes are written to the database immediately using the built in SQL helpers, so reopening the database will reflect the updates without further code changes.

## SharePoint/Graph provider (optional)

You can switch the data backend from the default local SQL.js database to a Microsoft Graph/SharePoint Lists provider using a feature flag. When enabled, Training reads/writes go through your SharePoint lists. Other parts of the app continue to use SQL.js for now.

1) Create a `.env.local` file in the project root and add:

```
# Microsoft Entra app registration
VITE_AAD_CLIENT_ID=00000000-0000-0000-0000-000000000000
VITE_AAD_TENANT_ID=00000000-0000-0000-0000-000000000000
# Optional: defaults to Sites.ReadWrite.All
# VITE_AAD_SCOPES=Sites.ReadWrite.All,User.Read

# SharePoint site and list IDs
VITE_SP_SITE_ID=your-site-id
VITE_SP_LIST_PEOPLE=your-people-list-id
VITE_SP_LIST_GROUPS=your-groups-list-id
VITE_SP_LIST_ROLES=your-roles-list-id
VITE_SP_LIST_SKILLS=your-skills-list-id
VITE_SP_LIST_PERSON_SKILL=your-person-skill-list-id
VITE_SP_LIST_PERSON_QUALITY=your-person-quality-list-id

# Feature flag (off by default)
# VITE_USE_SHAREPOINT=true
```

2) Start the dev server. The app will handle MSAL redirects automatically. When `VITE_USE_SHAREPOINT` is set to `true` or `1`, the Training view will use SharePoint lists via Graph; otherwise it uses the current SQL.js behavior.

