# Deterministic Fleet Scenario Specification

## Purpose

Provide a reproducible operating-region scenario for console operations.

## Requirements

### Requirement: Region and Fleet Identity

The system MUST model one geography-agnostic `OperatingRegion` configured as a plausible Spain scenario. It SHALL provide approximately 15 deterministic, static vehicles at plausible positions and MUST NOT randomly generate fleet data. Each vehicle MUST separate stable `internalId` from user-facing fleet number, label, and plate; its marker MUST use the editable label, falling back to fleet number.

#### Scenario: Load reproducible fleet
- GIVEN a fresh scenario load
- WHEN the region is queried repeatedly
- THEN the same static vehicles and positions are returned

#### Scenario: Resolve an absent label
- GIVEN a vehicle has no editable label
- WHEN its marker is rendered
- THEN its fleet number is used as the label

### Requirement: Controlled Operational Data

Each vehicle MUST include a plausible controlled GeoJSON route corridor, origin, destination, current route, status, cargo/refrigeration/priority, dimensions/type/weight, driving/rest timing, ETA/delay, and relevant risk. The fixtures SHALL cover driving, resting, needs-attention, and critical states.

#### Scenario: Inspect fleet coverage
- GIVEN the fixture fleet
- WHEN statuses are grouped
- THEN every required operational state has at least one vehicle

#### Scenario: Query vehicle context
- GIVEN a known vehicle
- WHEN its operational data is requested
- THEN all required route, load, timing, and risk fields are available

### Requirement: Static Risk Set

The region MUST include static risks: a 3.9 m height restriction, 26 t weight restriction, road-closure segment, discreet severe-snow high-severity polygon, and driving/rest deadline data. These risks MUST be controlled fixture data, not live provider output.

#### Scenario: Display risk fixtures
- GIVEN the region map data
- WHEN risk overlays are requested
- THEN each required restriction, closure, snow polygon, and deadline is present

#### Scenario: Remain offline deterministic
- GIVEN network providers are unavailable
- WHEN the scenario loads
- THEN the same routes and risks remain available without live routing, weather, or traffic
