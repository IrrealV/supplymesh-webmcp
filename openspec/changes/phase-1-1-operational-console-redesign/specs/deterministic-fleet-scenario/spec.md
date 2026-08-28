# Delta for Deterministic Fleet Scenario

**Coverage**: 3 MODIFIED requirements; 8 scenarios.

## MODIFIED Requirements

### Requirement: Region and Fleet Identity

The system MUST model one geography-agnostic `OperatingRegion` configured as a plausible Spain scenario. It SHALL provide approximately 15 deterministic static vehicles at plausible positions and MUST NOT randomly generate fleet data. Each vehicle MUST separate stable `internalId` from user-facing fleet number, label, and plate; marker labels MUST use the editable label, falling back to fleet number.
(Previously: Required the same deterministic Spain fleet and label fallback.)

#### Scenario: Load reproducible fleet
- GIVEN a fresh scenario load
- WHEN the region is queried repeatedly
- THEN the same static vehicles and positions are returned

#### Scenario: Resolve an absent label
- GIVEN a vehicle has no editable label
- WHEN its marker is rendered
- THEN its fleet number is used as the readable label

### Requirement: Controlled Operational Data

Each vehicle MUST include a plausible checked-in deterministic multi-point GeoJSON road-corridor route, origin, destination, current route, status, cargo/refrigeration/priority, dimensions/type/weight, driving/rest timing, ETA/delay, and relevant risk. Routes MUST NOT use long-distance two-point geometry or require runtime routing API, provider, secret, weather, or traffic input. Fixtures SHALL cover driving, resting, needs-attention, and critical states.
(Previously: Required plausible controlled route and operational fields.)

#### Scenario: Inspect fleet coverage
- GIVEN the fixture fleet
- WHEN statuses are grouped
- THEN every required operational state has at least one vehicle

#### Scenario: Query vehicle context
- GIVEN a known vehicle
- WHEN its operational data is requested
- THEN all required route, load, timing, and risk fields are available

#### Scenario: Render deterministic corridors
- GIVEN providers are unavailable
- WHEN routes are rendered repeatedly
- THEN the same plausible multi-point corridors, never long-distance two-point routes, are available without secrets or runtime routing

### Requirement: Static Risk Set

The region MUST include controlled, plausibly corridor-aligned risk segments and markers for a 3.9 m height restriction, 26 t weight restriction, road closure, driving/rest deadline, severe-snow weather zone, and their severity. It MUST expose data sufficient for a route/risk legend and MUST NOT use live provider output.
(Previously: Required the named static restrictions, closure, snow polygon, and deadline.)

#### Scenario: Display risk fixtures
- GIVEN region map data
- WHEN risk overlays are requested
- THEN each required restriction, closure, weather zone, deadline, severity, segment, and marker is present

#### Scenario: Remain offline deterministic
- GIVEN network providers are unavailable
- WHEN the scenario loads
- THEN the same routes and risks remain available without live routing, weather, or traffic

#### Scenario: Align risk to corridor
- GIVEN a vehicle has a route risk
- WHEN its route context is inspected
- THEN the relevant fixture risk is plausibly associated with that corridor
