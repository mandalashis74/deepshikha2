# Cultural Events Module — User Guide

## Overview
The Cultural Events module lets building admins organize events (festivals, gatherings, competitions) and residents participate — register performances, contribute funds, sign up as volunteers, vote in competitions, and more.

---

## Setup

Run these SQL migrations in **Supabase SQL Editor** in order:

| # | File | Purpose |
|---|------|---------|
| 1 | `scratch/add_cultural_events_schema.sql` | Creates all 10 event tables with RLS |
| 2 | `scratch/add_event_volunteers_expenses.sql` | Creates volunteers + expenses tables |
| 3 | `scratch/add_push_notifications.sql` | Creates push subscriptions + notification history |
| 4 | `scratch/add_contact_no_column.sql` | Adds contact_no column to owners (if missing) |
| 5 | `scratch/update_roles_for_events.sql` | Adds event permissions to existing admin role |
| 6 | `scratch/add_gdrive_columns.sql` | Adds Google Drive API + VAPID columns |
| 7 | `scratch/add_building_config.sql` | Full schema with all integration columns |

---

## Permissions

11 new permissions are assigned to **admin** by default. The role merge in `loadRoles()` propagates them to existing DB roles automatically.

| Permission | Who gets it | What it does |
|------------|-------------|-------------|
| `events:view` | All | See event list & details |
| `events:create` | Admin | Create, edit, delete events |
| `events:delete` | Admin | Delete events |
| `events:contribute` | All | Pay contribution toward an event |
| `events:perform` | All | Register a performance |
| `events:manage_vendors` | Admin | Add/edit/delete vendors, stalls, expenses |
| `events:manage_competitions` | Admin | Create/manage competitions & judges |
| `events:vote` | All | Vote in resident-judged competitions |
| `events:score` | Admin/Judges | Score participants in judge-judged competitions |
| `events:upload_gallery` | Admin | Add/delete gallery photos |
| `events:generate_passes` | Admin | Generate visitor gate passes |

---

## Features

### 1. Event List
- Access via sidebar → **Cultural Events**
- Filter by status: Upcoming, Ongoing, Completed, All
- Each card shows: event name, date, countdown timer, progress bar (contributions vs target), contribution stats
- "New Event" button (admin only)

### 2. Create / Edit Event (Admin)
Fields: event name, start/end date, contribution amount (₹), target amount, banner image URL, status (upcoming/ongoing/completed), notes.

### 3. Event Detail — 6 Tabs

#### Schedule
- Admin adds time-blocked entries (day label, time from/to, activity, location, notes)
- Auto-incrementing sort order
- Edit / delete each entry

#### Food & Stalls
- Admin adds vendors (name, stall number, category dropdown, amount, contact, status)
- Cards show vendor info with status badges (pending / confirmed / cancelled)
- Edit / delete each vendor

#### Performances
- Residents click **"Register Performance"** from the event footer
- Modal: name, type (singing, dance, drama, comedy, instrument, speech, other), special requirements
- Performances listed with participant name and type

#### Competitions
- Admin creates competitions (name, description, judge type, max score, status)
- **Judge type** determines voting/scoring:
  - *Residents* → residents click **Vote** button, pick nominee flat (duplicate votes prevented via unique constraint)
  - *Judges* → admin/judge clicks **Score**, enters participant name, flat, score
  - *Both* → residents vote + judges score
- Results computed automatically

#### Contributions
- **Fund Transparency Board**: 3 KPI cards (Collected / Spent / Balance) + stacked bar chart
- **Expense Breakdown**: admin can "Add Expense" with description, amount, category, vendor, invoice URL
- **Resident Contributions**: per-flat list with amounts and dates
- Residents click **"Pay Contribution"** from event footer
- Payment modal: base amount, late fee (if applicable), voluntary donation toggle, payment mode dropdown
- Success screen with receipt details
- **PDF Receipt**: landscape A5 with building name, receipt number, amount in words, committee stamp

#### Gallery
- Admin clicks **"Add Photo"** (permission: `events:upload_gallery`)
- If Google Drive credentials configured → **"Browse from Google Drive"** button launches Google Picker
- Falls back to manual URL entry when credentials missing
- Grid display with delete button for admins

### 4. Visitor Pass (Admin)
- Generate gate passes for event guests
- Modal: guest name, contact, visit date
- Saves to `event_visitor_passes` table
- Downloads compact PDF (80×120mm) with auto-print for gate scanning

### 5. Volunteer Signup (All Residents)
- "Volunteer" button in event detail footer
- Modal: name, contact, role preference dropdown, availability notes
- Saves to `event_volunteers` table

### 6. Push Notifications (Admin)
Requires VAPID key setup + Edge Function deployment (see below).
- "Notify" button in event detail footer (admin only)
- Send custom title + message to all subscribed residents
- Residents toggle subscription via sidebar bell icon

---

## Integrating Google Drive (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Picker API**
3. Create **API Key** (no restriction needed for dev)
4. Create **OAuth Client ID** → Web application
   - Add `http://localhost:5173` (and your production URL) to **Authorized JavaScript origins**
5. Paste both keys in **Building Setup → Integrations → Google Drive Integration**
6. Residents see "Browse from Google Drive" button when adding gallery photos

## Setting Up Push Notifications

### Step 1: Generate VAPID Keys
In **Building Setup → Integrations**, click **Generate Keys**. This creates a public/private key pair in your browser. Save the config.

### Step 2: Deploy Edge Function
Install Supabase CLI and deploy:
```bash
npm install -g supabase
supabase login
supabase functions deploy send-notification --project-ref YOUR_PROJECT_REF
```

### Step 3: Residents Subscribe
Each resident clicks the bell icon in the sidebar → grants browser notification permission → subscribed.

### Step 4: Send Notifications
Admin opens any event detail → clicks **Notify** → types title + message → sends to all subscribers.

---

## New SQL Migrations (in order)

| File | What it adds |
|------|-------------|
| `scratch/add_cultural_events_schema.sql` | 10 event tables |
| `scratch/add_event_volunteers_expenses.sql` | volunteers + expenses tables |
| `scratch/add_push_notifications.sql` | push_subscriptions + event_notifications + VAPID cols |
| `scratch/add_contact_no_column.sql` | contact_no on owners |
| `scratch/update_roles_for_events.sql` | event permissions for admin |
| `scratch/add_gdrive_columns.sql` | google_api_key + google_client_id on building_config |
| `scratch/add_building_config.sql` | Full schema with all integration columns |
| `scratch/add_event_volunteers_expenses.sql` | (already listed above) |

---

## File Reference

| File | Purpose |
|------|---------|
| `static/app.js` | All event JS (~900 lines): CRUD, tabs, scoring, voting, payments, PDFs, Google Picker, push notifications |
| `index.html` | Sidebar nav, dashboard workspace, 12+ event modals, building config modal with integration fields |
| `static/style.css` | Cultural Events module styles + dashboard + gallery grid + integrations |
| `sw.js` | Service worker for push notifications |
| `supabase/functions/send-notification/index.ts` | Edge Function for Web Push delivery |
