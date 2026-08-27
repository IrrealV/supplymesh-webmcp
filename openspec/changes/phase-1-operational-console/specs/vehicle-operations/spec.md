# Vehicle Operations Specification

## Purpose

Define vehicle inspection, local identity changes, deletion, and resilient presentation.

## Requirements

### Requirement: Operational Inspection

The selected-vehicle drawer MUST show editable label, fleet number, plate, route origin/destination/current route, status, cargo, dimensions, remaining drive time/rest deadline, ETA/delay, and current-risk comparison. Missing optional values MUST render meaningful cataloged fallback copy, never broken UI.

#### Scenario: Inspect a complete vehicle
- GIVEN a selected vehicle with all fixture fields
- WHEN its drawer opens
- THEN every required identity and operational field is visible

#### Scenario: Render absent optional data
- GIVEN a selected vehicle lacks an optional value
- WHEN its drawer opens
- THEN the localized fallback is shown without a malformed field

### Requirement: Safe Label Edit Storage

Renaming a vehicle through the application operation MUST update its map label immediately and persist safely. Editable scenario data MUST use versioned validated local storage; corrupt or obsolete content MUST deterministically fall back to fixtures, independently of locale storage.

#### Scenario: Rename a vehicle
- GIVEN a selected vehicle
- WHEN the user saves a valid label edit
- THEN the drawer and marker label update immediately and survive reload

#### Scenario: Recover invalid edits
- GIVEN stored edits are corrupt or use an obsolete version
- WHEN the scenario loads
- THEN deterministic fixture identities are restored and locale preference is unchanged

### Requirement: Confirmed Scenario Deletion

Delete MUST be secondary configuration action. It SHALL require explicit confirmation naming the vehicle display name and removal consequence, support cancellation, and on confirmation remove that vehicle and its current route from this scenario.

#### Scenario: Cancel deletion
- GIVEN the delete confirmation for a vehicle
- WHEN the user cancels
- THEN the vehicle and route remain available

#### Scenario: Confirm deletion
- GIVEN confirmation names the vehicle and consequence
- WHEN the user confirms deletion
- THEN the vehicle and its current route no longer exist in the scenario
