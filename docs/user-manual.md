# FrostLink User Manual

> Application: FrostLink - Refrigeration Fleet Management  
> Version: 0.0.1  
> Last updated: 2026-04-23

---

## 1. Introduction

FrostLink is a web dashboard for managing refrigeration units, validating field scans, and administering users per organisation.

Key concepts:

| Term | Meaning |
|------|---------|
| Unit / Fridge | A refrigeration device tracked in FrostLink |
| Serial Number | Manufacturer serial identifier |
| MAC Address | IoT hardware address |
| C-Number | Commercial identifier for the unit |
| Mismatch | Field scan values differ from stored values |
| Organisation | Client/company scope for users and devices |

---

## 2. Getting Started

### 2.1 Logging In
1. Open FrostLink and sign in with email and password.
2. On success, you land on the first page your role can access.

> Accounts are created by workspace administrators. Public self-signup is disabled.

### 2.2 Logging Out
- Use **Sign out** at the bottom of the sidebar.

---

## 3. Navigation Overview

FrostLink uses a collapsible left sidebar.

| Label | Route | Who sees it |
|------|-------|-------------|
| Asset Manager | `/admin/assets` | Any role with asset-related access |
| Workspace | `/workspace` | Intermediate, Advanced, Admin |
| Settings | `/settings` | All authenticated users |

Performance and Maintenance report pages are available by direct route (not shown in sidebar).

---

## 4. Pages

### 4.1 Asset Manager
Route: `/admin/assets`  
Access: Basic, Intermediate, Advanced, Admin

Visible tabs are role-dependent:

| Tab | Route | Who can see it |
|-----|-------|----------------|
| Inventory | `/admin/assets/inventory` | Basic, Intermediate, Advanced, Admin |
| Add Fridge | `/admin/assets/add` | Intermediate, Advanced, Admin |
| Mismatches | `/admin/assets/mismatches` | Basic, Intermediate, Advanced, Admin |
| Device Checker | `/admin/assets/device-checker` | Basic, Intermediate, Advanced, Admin |
| Placement | `/admin/assets/placement` | Basic, Intermediate, Advanced, Admin |
| History | `/admin/assets/history` | Basic, Intermediate, Advanced, Admin |

Admin users get organisation filtering in Asset Manager.

#### 4.1.1 Inventory
- View permission: `assets.view`
- Download permission: `assets.download` (Intermediate+)
- Edit permission: `assets.edit` (Intermediate+)
- Delete permission: `assets.delete` (Advanced+)
- Bulk delete permission: `assets.bulk_delete` (Admin)

#### 4.1.2 Add Fridge
- Single add permission: `assets.create` (Intermediate+)
- Bulk upload/preview/update permission: `assets.bulk_add` (Advanced+)

#### 4.1.3 Mismatches
- View permission: `mismatches.view`
- Resolve permission: `mismatches.resolve` (Advanced+)
- Delete permission: `mismatches.delete` (Advanced+)
- Download permission: `mismatches.download` (Intermediate+)

#### 4.1.4 Device Checker
- Tab visibility: `device_checker.view` or `device_checker.submit`
- Submission permission: `device_checker.submit` (Intermediate+)

Basic users can open this tab in read-only mode but cannot submit checks.

#### 4.1.5 Placement
- Tab visibility: `placement.view` or `placement.submit`
- Submission permission: `placement.submit` (Intermediate+)

Basic users can open this tab in read-only mode but cannot submit placements.

#### 4.1.6 History
- View permission: `history.view`
- Download permission: `history.download` (Intermediate+)

History includes deletion reasons and mismatch resolution notes where available.

### 4.2 Workspace
Route: `/workspace`

Workspace access uses `workspace.view`.

| Role | Scope |
|------|-------|
| Intermediate | Can manage Basic users only (own organisation) |
| Advanced | Can manage Basic, Intermediate, and Advanced users (own organisation) |
| Admin | Can manage all users, all organisations |

Admin-only organisation management:
- Create organisation
- Delete organisation (only if no linked users/devices)
- Reassign user organisation

Role assignment is controlled by:
- `users.assign_basic`
- `users.assign_intermediate`
- `users.assign_advanced`
- `users.assign_admin`

### 4.3 Settings
Route: `/settings`

- Profile detail edit (`first_name`, `last_name`, `email`) requires `profile.edit_details` (Advanced/Admin).
- Password change for own account is available to all roles.
- Organisation asset validation settings require `organisation_asset_validation.manage` (Advanced/Admin).
- `Total Units` card is visible if user has `assets.view`.

### 4.4 Performance Report
Route: `/performance-report`  
Access: All authenticated users

### 4.5 Maintenance Report
Route: `/maintenance-report`  
Access: All authenticated users

---

## 5. User Roles and Permissions

### 5.1 Role Overview

| Role | Data scope | Summary |
|------|------------|---------|
| Admin | All organisations | Full access, including organisation management and all role assignments |
| Advanced | Own organisation | Asset management, mismatch resolution, profile edit, validation settings, assign up to Advanced |
| Intermediate | Own organisation | Field operations + workspace access for Basic-user management only |
| Basic | Own organisation | Read-only asset/mismatch/history plus view-only checker/placement tabs |

### 5.2 Permission Flags by Role

| Permission | Basic | Intermediate | Advanced | Admin |
|------------|:-----:|:------------:|:--------:|:-----:|
| `assets.view` | Yes | Yes | Yes | Yes |
| `assets.create` | No | Yes | Yes | Yes |
| `assets.edit` | No | Yes | Yes | Yes |
| `assets.delete` | No | No | Yes | Yes |
| `assets.bulk_add` | No | No | Yes | Yes |
| `assets.bulk_delete` | No | No | No | Yes |
| `assets.download` | No | Yes | Yes | Yes |
| `mismatches.view` | Yes | Yes | Yes | Yes |
| `mismatches.resolve` | No | No | Yes | Yes |
| `mismatches.delete` | No | No | Yes | Yes |
| `mismatches.download` | No | Yes | Yes | Yes |
| `history.view` | Yes | Yes | Yes | Yes |
| `history.download` | No | Yes | Yes | Yes |
| `device_checker.view` | Yes | Yes | Yes | Yes |
| `device_checker.submit` | No | Yes | Yes | Yes |
| `placement.view` | Yes | Yes | Yes | Yes |
| `placement.submit` | No | Yes | Yes | Yes |
| `workspace.view` | No | Yes | Yes | Yes |
| `users.assign_basic` | No | Yes | Yes | Yes |
| `users.assign_intermediate` | No | No | Yes | Yes |
| `users.assign_advanced` | No | No | Yes | Yes |
| `users.assign_admin` | No | No | No | Yes |
| `profile.edit_details` | No | No | Yes | Yes |
| `organisation_asset_validation.manage` | No | No | Yes | Yes |
| `organisations.manage` | No | No | No | Yes |

---

## 6. Common Tasks

### 6.1 Add a Fridge
- Single add: Intermediate, Advanced, Admin
- Bulk add: Advanced, Admin

### 6.2 Run Device Check
- Submit checks: Intermediate, Advanced, Admin
- Basic: view-only tab

### 6.3 Resolve Mismatch
- Advanced, Admin

### 6.4 Create a User
- Intermediate: Basic users only (own org)
- Advanced: Basic, Intermediate, Advanced (own org)
- Admin: all roles, any organisation

### 6.5 Reset a User Password
- Own password: all roles
- Other users:
  - Intermediate: Basic users only
  - Advanced: Basic/Intermediate/Advanced
  - Admin: any user

### 6.6 Update Profile Details
- Advanced, Admin (`profile.edit_details`)

### 6.7 Deactivate User
- Intermediate: Basic users only
- Advanced: Basic/Intermediate/Advanced
- Admin: any user
- You cannot deactivate your own account.

---

For support, contact your system administrator.
