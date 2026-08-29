# Vehicle Operations Specification

## Purpose

Define vehicle inspection, local identity changes, deletion, and resilient presentation.

## Requirements

### Requirement: Operational Inspection

Selected inspection MUST organize identity, route/status, cargo/specification, timing/ETA, and risk into a clear hierarchy with accessible secondary tabs or sections. It MUST show editable label, fleet number, plate, origin/destination/current route, localized humanized status, cargo, dimensions, remaining drive time/rest deadline, ETA/delay, localized dates/units, and risk comparison. Driving/rest risk MUST be represented in inspection. Missing optional values MUST use meaningful cataloged fallback copy. `View on route` and Follow SHALL be available without obscuring inspection.
(Previously: Required a flat set of identity and operational fields with cataloged fallbacks.)

#### Scenario: Inspect a complete vehicle
- GIVEN a selected vehicle with all fixture fields
- WHEN inspection opens
- THEN every required identity and operational field is visible in its hierarchy

#### Scenario: Render absent optional data
- GIVEN a selected vehicle lacks an optional value
- WHEN inspection opens
- THEN localized fallback copy appears without a malformed field

#### Scenario: Humanize localized values
- GIVEN either supported locale
- WHEN status, time, date, unit, or risk values render
- THEN each is human-readable and localized

#### Scenario: View and follow route
- GIVEN inspection is open
- WHEN the user chooses View on route or Follow
- THEN map context focuses or follow is restored without losing inspection

### Requirement: Safe Label Edit Storage

Renaming through the application operation MUST accept and persist only a valid label, immediately update inspection and marker identity, and provide localized success or validation feedback. Save MUST be disabled when unchanged or invalid and enabled only for a valid change. Editable scenario data MUST use versioned validated local storage; corrupt or obsolete content MUST deterministically fall back to fixtures independently of locale storage.
(Previously: Required immediate persistent rename and deterministic recovery from invalid storage.)

#### Scenario: Rename a vehicle
- GIVEN a selected vehicle with a valid changed label
- WHEN Save becomes enabled and the user saves
- THEN inspection and marker update immediately, survive reload, and show localized confirmation feedback

#### Scenario: Reject invalid label
- GIVEN an unchanged or invalid label
- WHEN editing validation runs
- THEN Save remains disabled, no identity change persists, and localized validation feedback is shown

#### Scenario: Recover invalid edits
- GIVEN stored edits are corrupt or obsolete
- WHEN the scenario loads
- THEN deterministic fixture identities are restored and locale preference is unchanged

### Requirement: Confirmed Scenario Deletion

Delete MUST remain a secondary configuration action. It SHALL require explicit confirmation naming the vehicle display name and removal consequence, support cancellation, and on confirmation remove that vehicle and current route. After confirmation, selection MUST clear and the prior filtered-results or default context MUST be restored.
(Previously: Required named confirmation, cancellation, and removal of vehicle and route.)

#### Scenario: Cancel deletion
- GIVEN delete confirmation for a vehicle
- WHEN the user cancels
- THEN the vehicle, route, and current inspection remain available

#### Scenario: Confirm deletion
- GIVEN confirmation names the vehicle and consequence
- WHEN the user confirms deletion
- THEN the vehicle and its current route no longer exist in the scenario

#### Scenario: Restore context after deletion
- GIVEN deletion was confirmed from selected inspection
- WHEN the panel updates
- THEN focus returns to the applicable filtered-results or default context
