# FrostLink Permission Role Matrix

Last updated: 2026-04-23

This document is the backend-aligned role/permission snapshot implemented in `operations-api/server.js`.

## Role to Permission Mapping

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

## Assignment Rule Map

| Target Role | Required Permission |
|-------------|---------------------|
| `Basic` | `users.assign_basic` |
| `Intermediate` | `users.assign_intermediate` |
| `Advanced` | `users.assign_advanced` |
| `Admin` | `users.assign_admin` |

## Route to Permission Summary

| Route | Permission |
|------|------------|
| `GET /users` | `workspace.view` |
| `POST /users` | `workspace.view` + target role assignment permission |
| `PUT /users/:id/permissions` | `workspace.view` + target role assignment permission |
| `PUT /users/:id/password` | self: none, other user: `workspace.view` + target role assignment permission |
| `PUT /users/:id/active` | `workspace.view` + target role assignment permission |
| `PUT /users/:id/organisation` | `organisations.manage` + target role assignment permission |
| `GET /organisations` | `organisations.manage` |
| `POST /organisations` | `organisations.manage` |
| `DELETE /organisations/:id` | `organisations.manage` |
| `PUT /profile` | `profile.edit_details` |
| `GET /organisation-asset-validation` | `organisation_asset_validation.manage` |
| `PUT /organisation-asset-validation` | `organisation_asset_validation.manage` |
| `POST /newDevice` | `assets.create` |
| `POST /newDevice/bulk` | `assets.bulk_add` |
| `POST /newDevice/bulk/preview` | `assets.bulk_add` |
| `POST /newDevice/bulk/update` | `assets.bulk_add` |
| `PUT /updateDevice/:serialNumber` | `assets.edit` |
| `DELETE /deleteDevice/:serialNumber` | `assets.delete` |
| `POST /deleteDevice/bulk` | `assets.bulk_delete` |
| `POST /moveDevice/bulk` | `organisations.manage` |
| `GET /getFridges` | any of `assets.view`, `device_checker.view`, `device_checker.submit`, `placement.view`, `placement.submit` |
| `GET /searchFridges` | any of `assets.view`, `device_checker.view`, `device_checker.submit`, `placement.view`, `placement.submit` |
| `GET /auditLog/:serialNumber` | `history.view` |
| `GET /auditLog` | `history.view` |
| `GET /mismatches` | `mismatches.view` |
| `POST /mismatches/manual` | `device_checker.submit` |
| `POST /placements` | `placement.submit` |
| `GET /exports/fridges` | `assets.download` |
| `GET /exports/history` | `history.download` |
| `GET /exports/mismatches` | `mismatches.download` |
| `POST /signup` | disabled (returns 403) |
