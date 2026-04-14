# FrostLink User Manual

> **Application:** FrostLink — Refrigeration Fleet Management & Monitoring  
> **Version:** 0.0.1  
> **Last updated:** 2026-04-11

---

## Table of Contents

1. [Introduction](#1-introduction)  
2. [Getting Started](#2-getting-started)  
3. [Navigation Overview](#3-navigation-overview)  
4. [Pages](#4-pages)  
   - 4.1 [Asset Manager](#41-asset-manager)  
   - 4.2 [Workspace](#42-workspace)  
   - 4.3 [Settings](#43-settings)  
   - 4.4 [Performance Report](#44-performance-report)  
   - 4.5 [Maintenance Report](#45-maintenance-report)  
5. [User Roles & Permissions](#5-user-roles--permissions)  
6. [Common Tasks](#6-common-tasks)

---

## 1. Introduction

### What is FrostLink?

FrostLink is a web-based dashboard for managing and monitoring a fleet of refrigeration units (fridges). It allows organisations to:

- Register and track every fridge by its unique identifiers
- Detect and resolve identity mismatches reported from the field
- Monitor fleet health, maintenance needs, and operational performance
- Manage users and their access across one or more organisations

### Key Concepts

| Term | Meaning |
|------|---------|
| **Unit / Fridge** | A refrigeration device tracked in the system |
| **Serial Number** | The unique manufacturer serial number printed on the unit |
| **MAC Address** | The IoT module's hardware address (12 hex characters, e.g. `A4E57C7654E4`) |
| **C-Number** | The commercial/client identifier for the unit (e.g. `C56568`) |
| **Verified** | A unit whose MAC and C-Number have been confirmed as correct in the field |
| **Mismatch** | A discrepancy between the identifiers received from a field scan and the values stored in the database |
| **Organisation** | A client company whose fridges and users are grouped together |
| **Tier** | A performance classification for a unit: Gold, Silver, Bronze, or Insufficient |

---

## 2. Getting Started

### 2.1 Logging In

1. Open your browser and navigate to the FrostLink URL (e.g. `https://localhost:3000` for local development).
2. You will be redirected to the **Login** page if you are not already signed in.
3. Enter your **Email** and **Password**.
4. Click **Sign in**.

On success you are taken directly to the **Asset Manager** (or the first page your role has access to).

> **Note:** Passwords must be at least 8 characters. Contact your administrator if you have forgotten your password.

### 2.2 Logging Out

Click the **Sign out** button at the bottom of the left sidebar. You will be returned to the Login page and your session will be cleared.

---

## 3. Navigation Overview

FrostLink uses a **collapsible sidebar** on the left side of the screen.

### Sidebar Items

| Icon | Label | Route | Who sees it |
|------|-------|-------|-------------|
| Refrigerator | Asset Manager | `/admin/assets` | Users with any asset permission |
| Users | Workspace | `/workspace` | Advanced, Admin |
| Settings | Settings | `/settings` | Everyone |

> Pages marked as hidden in the sidebar (Performance Report, Maintenance Report) are accessible by navigating directly to their URLs but are not linked from the main menu.

### Sidebar Behaviour

- **Desktop:** The sidebar is expanded by default showing labels. Click the collapse toggle to show only icons.
- **Mobile / Tablet:** A hamburger menu button (top-left) opens the sidebar as an overlay.
- The **active page** is highlighted in blue in the sidebar.
- The **user's name**, **permission level**, and **sign-out button** are displayed at the bottom of the sidebar.

---

## 4. Pages

### 4.1 Asset Manager

**Route:** `/admin/assets`  
**Access:** Any user with at least one asset-related permission (Basic, Intermediate, Advanced, Admin)

The Asset Manager is the primary operational workspace. It has a **tabbed interface** — the tabs visible to you depend on your permission level.

| Tab | Route | Who can see it |
|-----|-------|---------------|
| Inventory | `/admin/assets/inventory` | Basic, Advanced, Admin |
| Add Fridge | `/admin/assets/add` | Advanced, Admin |
| Mismatches | `/admin/assets/mismatches` | Basic, Intermediate, Advanced, Admin |
| Device Checker | `/admin/assets/device-checker` | Intermediate, Advanced, Admin |
| History | `/admin/assets/history` | Basic, Advanced, Admin |

**Admin users** see an **Organisation filter** dropdown in the header, allowing them to switch between viewing all organisations or a specific one.

---

#### 4.1.1 Inventory Tab

**Route:** `/admin/assets/inventory`  
**Required permission:** `assets.view`

The Inventory tab displays every fridge registered in the system for your organisation.

**Features:**
- **Search bar** — filter by serial number, MAC address, or C-Number
- **Sort** — click any column header to sort ascending/descending
- **Pagination** — navigate between pages of results
- **Download** — export the current view as an Excel (.xlsx) file

**Table columns:**

| Column | Description |
|--------|-------------|
| Serial Number | Manufacturer serial (e.g. `003004192150`) |
| MAC Address | IoT module MAC (e.g. `A4E57C7654E4`) |
| C-Number | Commercial identifier (e.g. `C56568`) |
| Verified | Green badge if verified; unverified otherwise |
| Verified At | Date/time of last verification |
| History | Clock icon — opens a modal showing all audit events for this unit |
| Edit | Pencil icon — opens inline editing (Advanced/Admin only) |
| Delete | Trash icon — deletes the fridge record (Advanced/Admin only) |

**Editing a fridge (Advanced/Admin):**
1. Click the **pencil** icon on the row you want to edit.
2. The row switches to inline edit mode. Update MAC Address or C-Number as needed.
3. Click **Save** to apply changes, or **Cancel** to discard.

**Deleting a fridge (Advanced/Admin):**
1. Click the **trash** icon.
2. A confirmation dialog appears — enter a reason for deletion.
3. Click **Delete** to confirm. This action is logged in History.

**Viewing device history:**
1. Click the **clock** icon on any row.
2. A modal opens showing a full audit trail of all changes to that unit (Added, Updated, Verified, Mismatches, etc.).

---

#### 4.1.2 Add Fridge Tab

**Route:** `/admin/assets/add`  
**Required permission:** `assets.create`

Allows registration of new fridge units, either individually or in bulk.

**Single Entry:**
1. Enter the **Serial Number** (required).
2. Enter the **MAC Address** (optional — 12 hex characters).
3. Enter the **C-Number** (optional — format validated per organisation rules).
4. Click **Add Fridge**.

On success, a confirmation message appears and the form resets.

**Bulk Upload:**
1. Click **Download Template** to get the Excel template showing the required column format.
2. Fill in your data in the template.
3. Click **Upload File** and select your completed Excel file.
4. A **preview table** will show the rows that will be imported and a summary of any rows that will be skipped (with reasons).
5. Review the preview, then click **Upload** to confirm the import.
6. If any rows were skipped, click **View Skipped Rows** to see details.

**Bulk Update:**  
An additional section allows uploading an Excel file to update existing records (e.g. replace MAC addresses in bulk).

> **Validation:** Serial numbers, MAC addresses, and C-Numbers are validated against your organisation's configured rules. Malformed values are rejected before submission.

---

#### 4.1.3 Mismatches Tab

**Route:** `/admin/assets/mismatches`  
**Required permission:** `mismatches.view` (to view); `mismatches.resolve` (to resolve); `mismatches.delete` (to delete)

A mismatch is created when a field device scan reports identifiers that do not match what is stored for that serial number in the database.

**Filters:**

| Filter | Options |
|--------|---------|
| Status | Open, Resolve, Delete, All |
| Serial | Free text — serial contains |
| From date | Date range start |
| To date | Date range end |

**Table columns:**

| Column | Description |
|--------|-------------|
| Received At | Timestamp when the mismatch was reported |
| Serial Number | The fridge serial number involved |
| Received MAC | MAC address reported by the scanner |
| Expected MAC | MAC address stored in the database |
| Received C-Number | C-Number reported by the scanner |
| Expected C-Number | C-Number stored in the database |
| Location | GPS coordinates (if provided by the scanner) |
| Status | Open / Resolved / Deleted |
| Actions | Resolve or Delete buttons (if you have permission) |

**Resolving a mismatch (Advanced/Admin):**
1. Click **Resolve** on the mismatch row.
2. A dialog appears showing the received values that will be applied.
3. Enter a **resolution note** (reason/context).
4. Click **Resolve**. The fridge record is updated with the received MAC/C-Number and marked as verified.

**Deleting a mismatch (Advanced/Admin):**
1. Click **Delete** on the mismatch row.
2. Enter a **reason** (required for audit purposes).
3. Click **Delete**. The mismatch is soft-deleted (still visible in history).

**Exporting:** Click **Download** to export the current filtered view as Excel.

---

#### 4.1.4 Device Checker Tab

**Route:** `/admin/assets/device-checker`  
**Required permission:** `device_checker.submit`

The Device Checker is used by field technicians to verify a fridge's identity on-site. You enter (or scan) the identifiers of a physical device — the system checks them against the database and either confirms a match or creates a mismatch record.

**Form fields:**

| Field | Description |
|-------|-------------|
| Serial Number | The fridge's manufacturer serial |
| MAC Address | The IoT module's MAC address |
| C-Number | The commercial identifier |

**Input methods:**

- **Manual entry** — type identifiers directly into the fields.
- **Camera scan** — click the **Scan** button to open the barcode scanner. Point your device camera at the serial number barcode. When decoded, it pre-fills the Serial Number field and searches the database for a match.
- **Image upload** — upload a photo of the barcode if camera scanning is not available.
- **Bluetooth scan** — if using a Chromium-based browser over HTTPS, click **Scan Bluetooth** to detect a nearby `Penguin+` IoT device and auto-fill the MAC address.

**Result outcomes:**

| Result | Meaning |
|--------|---------|
| **VERIFIED** | The submitted identifiers match the database exactly. The fridge is marked as verified. |
| **MISMATCH_CREATED** | The submitted identifiers do not match the database. A mismatch record has been created for review. |

> **Location:** If browser location permissions are granted, GPS coordinates are automatically attached to the submission.

---

#### 4.1.5 History Tab

**Route:** `/admin/assets/history`  
**Required permission:** `history.view`

The History tab shows a complete audit log of all asset-related actions across your organisation.

**Table columns:**

| Column | Description |
|--------|-------------|
| Time | When the action occurred |
| Action | Type of action (colour-coded badge) |
| Serial Number | The fridge involved |
| Old MAC → New MAC | Previous and new MAC values |
| Old C-Number → New C-Number | Previous and new C-Number values |
| User | Who performed the action |

**Action types and colours:**

| Action | Badge colour | Meaning |
|--------|-------------|---------|
| Added | Grey | A new fridge was registered |
| Updated | Grey | A fridge's identifiers were changed |
| Verified | Green | A fridge was marked as verified |
| Unverified | Amber | A fridge's verified status was removed |
| Deleted | Red | A fridge was deleted |
| Mismatch Found | Grey | A field check created a mismatch |
| Mismatch Updated | Grey | A mismatch record was updated |
| Mismatch Resolved | Green | A mismatch was resolved |
| Mismatch Deleted | Red | A mismatch was soft-deleted |

**Exporting:** Click **Download** to export the full history as Excel.

---

### 4.2 Workspace

**Route:** `/workspace`  
**Access:** Advanced (own organisation), Admin (all organisations)

The Workspace page is for managing users. Users are displayed grouped by their permission level.

**Header controls:**

| Control | Description |
|---------|-------------|
| Search | Filter by name or email address |
| Status filter | All / Active / Inactive |
| Organisation filter | (Admin only) Filter users by organisation |
| Refresh | Reload the user list |
| Add User | Opens the Create User dialog |

**User table columns:**

| Column | Description |
|--------|-------------|
| Full Name | User's display name |
| Email | Login email address |
| Organisation | (Admin only) Which organisation the user belongs to |
| Status | Active (green) or Inactive (grey) badge |
| Created | Date the account was created |
| Actions | Role, Organisation, Password, Activate/Deactivate buttons |

**Organisations section (Admin only):**  
At the top of the Workspace page, Admins see an **Organisations** card where they can:
- Create a new organisation by entering a Name and email domain
- Delete an existing organisation (blocked if users or fridges are still linked to it)

---

### 4.3 Settings

**Route:** `/settings`  
**Access:** Everyone

The Settings page has two sections: **Profile Settings** (left) and **System Info** (right).

**Profile Settings:**

| Field | Editable? | Description |
|-------|-----------|-------------|
| First Name | Yes | Your first name |
| Last Name | Yes | Your last name |
| Email | Yes | Your login email address |
| Role | No (read-only) | Your assigned permission level |
| Organisation | No (read-only) | The organisation you belong to |

Click **Save Profile** to apply changes or **Refresh Profile** to reload from the server.

**Change Password:**  
Under the Profile Settings card, enter a new password (minimum 8 characters) and confirm it, then click **Update Password**.

**Organisation Asset Validation Settings (Advanced/Admin):**  
Below the profile card, users with asset permissions can view and configure per-organisation validation rules for serial numbers, MAC addresses, and C-Numbers. These rules define the expected format for each field and are enforced when adding or checking devices.

**System Info (right panel):**

| Field | Description |
|-------|-------------|
| Version | The current application version |
| Total Units | Total number of fridges registered (visible if you have `assets.view`) |

---

### 4.4 Performance Report

**Route:** `/performance-report`  
**Access:** All authenticated users (not in sidebar navigation)

The Performance Report provides a snapshot of the entire fleet's operational health.

**Top metric cards:**

| Metric | Description |
|--------|-------------|
| Total Units | Number of units in the fleet |
| Active & Powered ON | Percentage of units currently active and powered |
| Temp OK Rate | Percentage of units within acceptable temperature range |
| High Voltage Risk | Count of units with voltage warnings |
| Avg Case Temp | Fleet average case temperature (°C) |
| Avg Door Opens | Fleet average door open count |

**Fleet Health Snapshot:**  
A distribution bar chart showing units split into:
- Active & Powered On (green)
- Active but Powered Off (amber)
- Inactive (red)

**Critical Focus Areas:**  
Three highlight cards showing:
- Top temperature offenders (count and cluster)
- Highest door opens (peak value and location)
- Newly degraded units (count and region)

**Unit Performance Details table:**  
A scrollable table showing per-unit breakdown with:
- MAC, C-Code, District, Tier badge, Temperature/Power/Voltage status badges, Door Opens, Last Seen timestamp

---

### 4.5 Maintenance Report

**Route:** `/maintenance-report`  
**Access:** All authenticated users (not in sidebar navigation)

The Maintenance Report focuses on refrigeration diagnostics and prioritising maintenance visits.

**Top metric cards:**

| Metric | Description |
|--------|-------------|
| Units Measured | Total units with diagnostic data |
| Not Measured | Units missing diagnostic readings |
| Critical Count | Units classified as critical |
| Avg Diff Con | Average condenser differential temperature (°C) |
| New Critical | Units that became critical since last report |

**Severity Distribution:**  
A distribution bar chart showing units across severity categories:
- Normal
- Normal (Not Meeting Temp)
- Power/Voltage Issue
- Blocked Condenser Warning
- Gas Leakage Critical

**Priority Queue table:**  
Lists units requiring maintenance, sorted by priority score (0–100). Columns: MAC, District, Severity badge, Diff Con temperature, Priority score, and a **Review** action.

Clicking **Review** opens a modal with:
- The selected unit's identifier
- A diagnostic summary (e.g. condenser temperature and refrigerant charge indication)
- **Mark Reviewed** button to close the item

---

## 5. User Roles & Permissions

FrostLink has four permission levels. Each level controls both what data a user can see (data scope) and what actions they can perform.

### 5.1 Role Overview

| Role | Data Scope | Description |
|------|-----------|-------------|
| **Admin** | All organisations | Full system access. Can view and manage all organisations and their data. |
| **Advanced** | Own organisation only | Can manage users, perform all asset operations, resolve/delete mismatches, and use the device checker. |
| **Intermediate** | Own organisation only | Field-focused role. Can view mismatches and submit device checks. No access to inventory or history. |
| **Basic** | Own organisation only | Read-only access to inventory, mismatches, and history. Cannot create, edit, or delete records. |

### 5.2 Permission Flags by Role

| Permission | Admin | Advanced | Intermediate | Basic |
|------------|:-----:|:--------:|:------------:|:-----:|
| `users.manage` | ✓ | ✓ | — | — |
| `users.view` | ✓ | ✓ | — | — |
| `assets.create` | ✓ | ✓ | — | — |
| `assets.edit` | ✓ | ✓ | — | — |
| `assets.delete` | ✓ | ✓ | — | — |
| `assets.view` | ✓ | ✓ | — | ✓ |
| `mismatches.resolve` | ✓ | ✓ | — | — |
| `mismatches.delete` | ✓ | ✓ | — | — |
| `mismatches.view` | ✓ | ✓ | ✓ | ✓ |
| `history.view` | ✓ | ✓ | — | ✓ |
| `device_checker.submit` | ✓ | ✓ | ✓ | — |

### 5.3 What Each Role Sees

**Admin**
- Sidebar: Asset Manager, Workspace, Settings
- Asset Manager tabs: Inventory, Add Fridge, Mismatches, Device Checker, History
- Workspace: All users across all organisations + Organisations management card
- Settings: Full profile + validation rules + Total Units stat
- Organisation filter dropdown in Asset Manager and Workspace headers

**Advanced**
- Sidebar: Asset Manager, Workspace, Settings
- Asset Manager tabs: Inventory, Add Fridge, Mismatches, Device Checker, History
- Workspace: Users in their own organisation only (no Organisations card)
- Settings: Full profile + validation rules + Total Units stat
- No organisation filter dropdown

**Intermediate**
- Sidebar: Asset Manager, Settings
- Asset Manager tabs: Mismatches, Device Checker only
- No access to Workspace
- Settings: Profile only (no Total Units stat, no validation rules)

**Basic**
- Sidebar: Asset Manager, Settings
- Asset Manager tabs: Inventory (read-only), Mismatches (view only), History (read-only)
- No edit, delete, or create buttons visible
- No access to Workspace
- Settings: Profile only + Total Units stat (read-only)

---

## 6. Common Tasks

### 6.1 Adding a New Fridge

> Requires: **Advanced** or **Admin** role

1. Go to **Asset Manager** → **Add Fridge** tab.
2. Enter the **Serial Number** (required).
3. Optionally enter the **MAC Address** and **C-Number**.
4. Click **Add Fridge**.
5. A success message confirms the fridge has been registered.

**To add many fridges at once:**
1. Click **Download Template** and fill in the Excel sheet.
2. Click **Upload File**, select your sheet, and review the preview.
3. Click **Upload** to import all valid rows.

---

### 6.2 Running a Device Check (Field Verification)

> Requires: **Intermediate**, **Advanced**, or **Admin** role

1. Go to **Asset Manager** → **Device Checker** tab.
2. Enter or scan the fridge's **Serial Number**, **MAC Address**, and **C-Number**.
   - Use the **Scan** button for barcode scanning via camera.
   - Use **Scan Bluetooth** (Chromium + HTTPS only) to auto-detect a Penguin+ device MAC.
3. Click **Submit**.
4. The result will be either:
   - **VERIFIED** — identifiers match; the fridge is now marked verified.
   - **MISMATCH_CREATED** — identifiers differ; a mismatch has been logged for review.

---

### 6.3 Resolving a Mismatch

> Requires: **Advanced** or **Admin** role

1. Go to **Asset Manager** → **Mismatches** tab.
2. Filter by **Status: Open** to see pending mismatches.
3. Find the mismatch and click **Resolve**.
4. Review the received vs. expected values in the dialog.
5. Enter a **resolution note** explaining the decision.
6. Click **Resolve**. The fridge record is updated with the received values and marked verified.

---

### 6.4 Creating a New User

> Requires: **Advanced** (own organisation) or **Admin** (any organisation)

1. Go to **Workspace**.
2. Click **Add User** (top right) or the **Add [Role] User** button in a specific role section.
3. Fill in:
   - **Full Name**
   - **Email** (will be used as the login username)
   - **Password** (minimum 8 characters)
   - **Permission** level
   - **Organisation** (Admin only — non-Admin users automatically inherit their own organisation)
4. Click **Create User**.

> **Note:** Admins can assign any permission level. Advanced users can only create users at the Advanced level or below.

---

### 6.5 Resetting a User's Password

> Requires: **Advanced** or **Admin** role (for other users); any role (for your own password via Settings)

**For another user (Workspace):**
1. Go to **Workspace**.
2. Find the user in the table and click **Password**.
3. Enter a new password (minimum 8 characters).
4. Click **Update Password**.

**For your own account (Settings):**
1. Go to **Settings**.
2. Scroll to the **Change Password** section.
3. Enter your new password and confirm it.
4. Click **Update Password**.

---

### 6.6 Updating Your Profile

1. Go to **Settings**.
2. Edit **First Name**, **Last Name**, or **Email** as needed.
3. Click **Save Profile**.

> Role and Organisation are read-only — contact your administrator to change these.

---

### 6.7 Deactivating a User

> Requires: **Advanced** or **Admin** role

1. Go to **Workspace**.
2. Find the user and click **Deactivate**.
3. The user's status changes to **Inactive** and they can no longer log in.

To re-enable a deactivated user, click **Activate** on their row.

> You cannot deactivate your own account.

---

*For support or to report issues, contact your system administrator.*
