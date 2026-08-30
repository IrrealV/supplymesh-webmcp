# Deterministic Fleet Scenario Specification

## Purpose

Provide a reproducible operating-region scenario for console operations.

## Requirements

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

Each vehicle MUST include a plausible checked-in deterministic multi-point GeoJSON road-corridor route, origin, destination, current route, status, cargo/refrigeration/priority, dimensions/type/weight, driving/rest timing, ETA/delay, and relevant risk. Each vehicle MUST store a stable `routeId` and bounded normalized `routeProgress`; runtime position MUST be derived deterministically from that route geometry and progress, with progress at or below zero at the origin and at or above one at the destination. Independent arbitrary position data MUST NOT contradict the route. Runtime MUST make zero routing requests and contain no API key, provider client, dynamic alternatives, rerouting, or Phase 2 route assignment. Fixtures SHALL cover driving, resting, needs-attention, and critical states.
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

#### Scenario: Derive a position from route progress
- GIVEN a vehicle references a fixture route and normalized progress
- WHEN runtime resolves its current position
- THEN the position is on that geometry and resolves to its endpoint at each bound

### Requirement: Static Risk Set

The region MUST include controlled, plausibly corridor-aligned risk segments and markers for a 3.9 m height restriction, 26 t weight restriction, road closure, driving/rest deadline, severe-snow weather zone, and their severity. Restriction coordinates and segments MUST snap to actual route polyline points or segments and retain deterministic vehicle associations. It MUST expose data sufficient for a route/risk legend and MUST NOT use live provider output.
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
- THEN the relevant fixture risk snaps to its polyline point or segment and retains that vehicle association

## ADDED Requirements

### Requirement: Reproducible HGV Route Generation

Route geometry MUST be precalculated by the OpenStreetMap-based openrouteservice `driving-hgv` router; manual, invented, generated interpolation/smoothing, and hand-drawn polylines are prohibited. A manifest MUST preserve original logical origin/destination coordinates and MAY include per-endpoint `radiuses` passed directly to ORS directions. `radiuses` MUST contain exactly one finite positive radius per requested coordinate and are geometry-affecting canonical input. Route-014 MUST use `[547,350]`, the minimum tested integer bound above its measured 546.77 m origin snap; every other route MUST retain the default 350 m unless independently evidenced. The generator MUST NOT substitute pre-snapped coordinates, add shape waypoints, request alternatives, smooth, simplify, or rewrite returned geometry. It MUST validate returned geometry endpoints against each configured radius and the existing 2 km logical-endpoint tolerance, while retaining logical endpoint associations separately from ORS-selected geometry endpoints. A reproducible documented Bun/TypeScript generation script MUST use `ORS_API_KEY` only at generation time, send authenticated POST requests to `/v2/directions/driving-hgv/geojson` with `[longitude, latitude]` coordinates, and fail clearly for a missing key or malformed response. Generated fixtures MUST be reviewed, versioned, checked-in GeoJSON with stable route IDs, schema version, profile/source, generated-at/source-data provenance or reproducibility metadata, endpoint association, distance/duration summary, and validated geometry.

#### Scenario: Generate an authenticated HGV route
- GIVEN `ORS_API_KEY` and valid endpoint coordinates
- WHEN the documented Bun/TypeScript generator runs
- THEN it POSTs authenticated `[longitude, latitude]` coordinates to the HGV GeoJSON endpoint

#### Scenario: Reject unusable generation input or output
- GIVEN a missing `ORS_API_KEY` or malformed mocked router response
- WHEN generation runs
- THEN it fails clearly without writing an unvalidated route fixture

#### Scenario: Review generated route fixtures
- GIVEN generated GeoJSON is proposed for check-in
- WHEN fixture validation runs
- THEN every route has required stable identity, provenance, endpoints, summary, and valid geometry

#### Scenario: Pass canonical endpoint radiuses to ORS
- GIVEN manifest logical coordinates and valid per-endpoint radiuses
- WHEN the generator requests directions
- THEN it forwards exactly one finite positive radius per coordinate without changing coordinates

#### Scenario: Reject invalid radius input
- GIVEN a radius list with wrong length, non-finite, or non-positive value
- WHEN manifest validation runs
- THEN generation fails before an ORS request or fixture write

#### Scenario: Hash geometry-affecting radius input
- GIVEN otherwise identical manifests with different radiuses
- WHEN their canonical inputs are hashed
- THEN their hashes differ and retain their logical endpoint coordinates

#### Scenario: Generate route-014 with its measured snap bound
- GIVEN route-014 logical endpoints and `radiuses` `[547,350]`
- WHEN the generator receives a valid mocked ORS response
- THEN it succeeds with the original logical associations and validated geometry endpoints

#### Scenario: Prohibit pre-snapped route substitution
- GIVEN ORS-selected geometry endpoints differ from logical endpoints within validation bounds
- WHEN the fixture is generated
- THEN it preserves manifest coordinates, returned geometry, and no added waypoints, alternatives, smoothing, simplification, or rewriting

### Requirement: Route Fixture Verification and Documentation

Verification MUST cover fixture schema/provenance, every expected route, non-two-point long geometry, endpoint and plausibility bounds, progress-derived positions, snapped restrictions, deterministic offline runtime loading, mocked generation-time HTTP missing-key/malformed-response failures, radius passthrough and validation, canonical-hash sensitivity, route-014 success, prohibition of pre-snapped coordinate substitution, absence of runtime provider/network imports, and absence of secrets. Documentation MUST explain the regeneration command, `ORS_API_KEY` generation-only boundary, review expectations, and generated-file marking. Final visual and map tests MUST use only checked-in fixtures.

#### Scenario: Verify runtime and fixture invariants
- GIVEN checked-in routes and scenario fixtures
- WHEN the verification suite runs
- THEN it proves geometry, progress, snapped risks, offline load, all expected routes, no runtime provider/network imports, and no secrets

#### Scenario: Verify generation boundary and evidence
- GIVEN generation documentation and final map tests
- WHEN reviewers inspect the workflow
- THEN mocked generator failures, key boundary, generated-file review, and checked-in-fixture-only evidence are covered

### Requirement: Deterministic Clearance Alternative Generation

The system MUST generate one logical `driving-hgv` candidate and one GeoJSON feature for `vehicle-011` on `route-011`; its `vehicleId`, risk, current-route identity, and original endpoints MUST remain fixed. Generation SHALL request ORS using a closed deterministic avoid polygon derived only from the exact `restriction-height-3.9` snap at index 537, `[-3.897481,40.149232]`. Bounded retries for 429/5xx MAY repeat that candidate and MUST NOT create another alternative.

#### Scenario: Generate the fixed alternative
- GIVEN accepted `route-011` and its exact clearance-risk snap
- WHEN the generation command runs with a valid key
- THEN it produces one logical candidate and one GeoJSON feature between the original endpoints
- AND permitted 429/5xx retries retain that same candidate and polygon

#### Scenario: Reject changed source identities
- GIVEN input that changes the vehicle, risk, route, snap, or endpoints
- WHEN generation validates the input
- THEN it fails before admitting an alternative fixture

### Requirement: Versioned Alternative Fixture and Plausibility

An accepted alternative MUST be a separate versioned GeoJSON with `alternativeRouteId`, `vehicleId`, `currentRouteId`, `avoidsRiskId`, geometry, distance, duration, provider, profile, `sourceRevision`, generated timestamp, and avoidance metadata. The normalized candidate/fixture canonical payload and `sourceRevision` MUST be the admission boundary; raw provider JSON MAY be non-canonical. Geometry MUST contain at least three coordinates, be disjoint without touching the exclusion polygon, record a positive measurable clearance margin, retain endpoints within existing tolerance, and have positive distance and duration no greater than twice the current route.

#### Scenario: Admit a plausible disjoint result
- GIVEN ORS output normalized to a canonical candidate outside the exclusion polygon
- WHEN fixture validation runs
- THEN it writes the versioned GeoJSON with all required provenance and relation fields
- AND it records the validated positive clearance margin

#### Scenario: Reject invalid route geometry
- GIVEN geometry that intersects or touches the polygon, has fewer than three coordinates, drifts endpoints, or violates plausibility bounds
- WHEN fixture validation runs
- THEN it rejects the result without admitting it

### Requirement: Fail-Closed Generation and Protected Fixtures

The generator MUST fail without `ORS_API_KEY` or, after permitted retries, on provider failure, malformed output, or failed admission validation, without replacing an accepted fixture. The key MUST be process-only and MUST NOT be logged or persisted. The current route and main ORS fixture MUST remain byte-identical to `435f14f`, and protected runtime behavior MUST remain unchanged.

#### Scenario: Preserve an accepted fixture on failure
- GIVEN an accepted alternative fixture
- WHEN generation lacks a key or receives a provider or validation failure
- THEN it reports failure and leaves that fixture unchanged

#### Scenario: Prove protected fixture boundaries
- GIVEN the generation, fixture, and verification changes
- WHEN protected-boundary verification runs
- THEN it proves the current route and main ORS fixture match `435f14f` byte-for-byte

### Requirement: Offline-Only Consumption and Evidence

A dedicated static offline catalog MAY load the minimal relation, geometry, summary, and provenance; its relation MUST contain `{ vehicleId, currentRouteId, avoidsRiskId, alternativeRouteId }`. Runtime MUST remain offline and keyless. `App`, UI/features, `OperationsApi`, WebMCP, and `createSpainScenario` MUST NOT import or use this catalog in this batch. Explicit exclusions: UI, application, staged plan, routing request, key, new tool, and other-alternative integration. Documentation MUST provide the regeneration command; tests MUST prove fixture validity, failure preservation, protected fixtures/runtime, and scan those consumers to assert no staged-plan, application, new-tool, or other-alternative integration.

#### Scenario: Load only an in-scope offline relation
- GIVEN a dedicated static offline catalog is in scope
- WHEN its approved offline boundary loads the relation
- THEN it uses only checked-in relation, geometry, summary, and provenance without network or key

#### Scenario: Review the regeneration boundary
- GIVEN the documented regeneration command and verification suite
- WHEN maintainers run or inspect them
- THEN they scan the named consumers and prove the exclusions and protected boundaries
