# MaintApp Development Session Summary

## Goal
Maintain and enhance a building management application with role-based access, owner directory, event management, and maintenance fee tracking.

## Constraints & Preferences
- Passcode field must be masked (`type="password"`) at all times; eye toggle visible to administrators only
- Owner directory fields show as text labels in view mode; "Enable Editing" swaps to editable inputs
- Floor managers see only flats on their assigned floors
- Sidebar navigation replaces top toolbar
- "Connected" badge in sidebar is informational only (no click action)
- Data and Administration sections are collapsible
- Vacant flats show `—` for rate/pending in maintenance collections; cumulative arrears from previous occupied months still display
- Multi-owner/contact entries use structured rows (JSON array format in DB)

## Progress
### Done
- Dynamic role management with `roles` Supabase table, `hasPermission()`, and CRUD UI
- Permission matrix/grid editor (`PERMISSION_GROUPS` → rows=modules, columns=action types); edit modal widened to 900px
- Floor manager floor assignment system (`assigned_floors` JSONB column, `filterFlatsByAssignment()`, assignment modal)
- Left sidebar navigation; colored navigation buttons with distinct `--nav-clr` per button; collapsible Data/Admin sections with chevron toggle
- Dashboard ticket count fixed: now queries `['Pending', 'Recommended', 'Approved', 'Reopened']` instead of wrong lowercase statuses
- "Connected" badge is informational (no `onclick`, no pointer cursor)
- Quick Action section removed from sidebar
- Owner directory: lavish detail card (gradient header, sectioned layout, glow effects); view-mode shows `<span>` text labels instead of disabled inputs; multi-owner/contact via structured rows; bullet dots on records; backward-compatible `displayStructured()` helper handles JSON arrays and plain strings
- Event dossier PDF generation (`generateEventDossier()`) — 8-section A4 PDF: overview, financial summary, schedule, vendors, performances, competitions (with scores), volunteers, expenses, gallery
- Maintenance Fees collection tab: vacant flats excluded from rate/pending for current month; cumulative pending calculated across all months from occupancy start to selected month, including arrears from previously occupied months
- Committee Position CRUD: Add, Edit, Delete, Reorder (up/down arrows) for committee positions via SweetAlert2 forms in the Manage Committee modal
- Multi-month Maintenance Collection: Click "Collect" on any flat → shows month grid (checkboxes) from occupancy start to 6 months ahead, with rate per month from rate history, paid/due/advance status, "All Due" / "Clear" buttons, override amount field. Saves one income row per selected month with prorated amount. Supports advance payment (future months uncheckable by default but selectable).

### In Progress
- None

### Blocked
- None

## Key Decisions
- `ALL_PERMISSIONS` is derived by flattening `PERMISSION_GROUPS` for backward compatibility
- Matrix columns fixed to View, Add, Edit, Delete, Approve, Other; non-standard permissions go into "Other"
- Owner/contact stored as JSON array strings (`[{"name":"..."}]`) in existing DB columns; `displayStructured()` handles both JSON and plain strings
- Event dossier uses jsPDF A4 portrait with auto page breaks; opens in new tab or downloads as fallback
- Cumulative pending = (total occupied months up to selected month − months with collections) × current rate
- Committee position CRUD uses SweetAlert2 modals (consistent with existing patterns), `sort_order` swapping for reorder

## Next Steps
- None

## Critical Context
- `dist/` is regenerated on build, no manual update needed
- `owners.owner_name` and `owners.contact_no` columns now hold JSON arrays after first edit-save; `displayStructured()` and `parseStructuredField()` handle migration from plain strings
- `maintenance_collections` uses `UNIQUE(flat_no, month, year)` constraint; collections stored in `income` table with `category = 'Monthly Maintenance'`
- `getDefaultRoles()` in `app.js` still has hardcoded fallback arrays — keep in sync if new permissions added

## Relevant Files
- `C:\developer\MaintApp\static\app.js`: Core app logic (permissions matrix, roles CRUD, owner detail, event dossier, board, tickets, dashboard)
- `C:\developer\MaintApp\static\js\maintenance.js`: Maintenance fees module (collections tab, rate cards, cumulative pending logic)
- `C:\developer\MaintApp\static\js\committee.js`: Committee management (view cards, member assign/remove, position CRUD)
- `C:\developer\MaintApp\static\style.css`: All styles (sidebar, matrix, structured rows, directory details, maintenance tables)
- `C:\developer\MaintApp\index.html`: All modal HTML (edit role, owner directory, events, maintenance, committee, etc.)
- `C:\developer\MaintApp\scratch\add_maintenance_fees.sql`: SQL for `maintenance_rates` and `maintenance_collections` tables
- `C:\developer\MaintApp\scratch\add_committee_system.sql`: SQL for committee positions and members tables
- `C:\developer\MaintApp\scratch\setup_roles_table.sql`: SQL for roles table + `assigned_floors` column
