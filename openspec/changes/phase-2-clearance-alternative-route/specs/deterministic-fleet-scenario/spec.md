# Delta for Deterministic Fleet Scenario

## ADDED Requirements

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
