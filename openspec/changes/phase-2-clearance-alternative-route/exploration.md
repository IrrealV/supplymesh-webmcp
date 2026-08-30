## Exploration: phase-2-clearance-alternative-route

### Current State
`vehicle-011` is FM-211 (`Unit 211`), 3.8 m high, on `route-011` from Toledo to Alcobendas. Its checked-in HGV route is 99,706.6 m / 5,292.1 s with 1,120 coordinates; the high `restriction-height-3.9` risk (3.9 m) snaps at index 537, `[-3.897481,40.149232]`. The current fixture pipeline posts only at generation time to ORS `driving-hgv`, validates canonical provenance and endpoint snaps, atomically writes, and runtime loads GeoJSON offline. Current UI/features, `OperationsApi`, WebMCP, and `createSpainScenario` contain no alternative-fixture/catalog, assignment, or rerouting reference. Phase 2 may add a static, offline-only catalog, but no current application consumer may use it.

### Affected Areas
- `scripts/routes/generator.ts` — export the existing `requestRoute` and `writeAtomically` primitives plus a `canonicalSha256` wrapper/alias, without changing existing main-generator behavior or callers.
- `scripts/generate-clearance-alternative-route.ts` — new thin generation/verification entrypoint that reads the current route's actual risk snap, builds one deterministic exclusion polygon, and delegates the ORS POST/retry/validation to the shared generator.
- `scripts/generate-clearance-alternative-route.test.ts` — mocked-provider, canonical/no-op, logical-candidate-versus-HTTP-attempt, offline acceptance/rejection, and explicit application-exclusion tests.
- `src/scenario/fixtures/clearance-alternative-route-v1.manifest.json` — new versioned, compact input declaring only the vehicle/current-route/risk/alternative relation and fixed exclusion-radius policy.
- `src/scenario/fixtures/clearance-alternative-route-v1.geojson` — new generated single-feature fixture; preserve `ors-route-manifest.json` and `ors-routes.geojson` byte-for-byte.
- `src/scenario/fixtures/clearanceAlternativeCatalog.ts` — new dedicated static parser exposing immutable relation, route geometry, summary, and provenance; it is not imported by the current scenario, UI, application API, or WebMCP.
- `package.json` and `docs/route-fixtures.md` — narrow generate/verify commands and review guidance for this separate fixture only.

### Approaches
1. **Thin dedicated alternative entrypoint over shared provider primitives** — Export the existing `requestRoute`, `writeAtomically`, and `canonicalSha256` wrapper, then add a focused script, verifier, and inert static catalog for one versioned alternative fixture.
   - Pros: preserves the main manifest and fixture bytes; reuses the canonical, retry, secret-safe HGV POST pipeline; keeps relation/provenance and polygon validation specific to the one alternative; supports future static runtime reading without network, keys, assignment, or UI work.
   - Cons: introduces a small dedicated fixture schema and command pair.
   - Effort: Medium.

2. **Generalize the all-routes manifest and fixture schema** — Extend the existing route manifest/generator to model alternatives, relations, custom risk behavior, and avoidance provenance.
   - Pros: one generalized fixture format.
   - Cons: expands blast radius across all 15 accepted routes, conflicts with the requirement to preserve the main fixture, and risks changing synthetic risk-snap assumptions without serving a second alternative.
   - Effort: High.

### Recommendation
Use approach 1. The entrypoint MUST load `route-011` from the accepted main GeoJSON, locate `restriction-height-3.9`, and derive a closed, deterministic GeoJSON polygon from that exact snapped coordinate at index 537; it MUST NOT embed a replacement coordinate. It should send one `options.avoid_polygons` polygon with the unchanged Toledo/Alcobendas logical endpoints through the existing `driving-hgv` POST path. One logical generated candidate MUST produce exactly one fixture feature; the existing bounded retries for 429/5xx are HTTP attempts, not additional alternatives. The emitted fixture should carry standard provider/hash provenance plus a versioned alternative block containing the current main-fixture revision, the polygon, and exactly `{ vehicleId, currentRouteId, avoidsRiskId, alternativeRouteId }`; its feature records returned geometry and distance/duration.

Generation and offline verification MUST reject a geometry that touches or enters the exclusion polygon, has fewer than three coordinates, loses endpoint association, has non-positive or implausible (over 2× current) distance/duration, or fails the exact normalized candidate/fixture canonical payload, `sourceRevision`, or no-op checks. “Non-canonical” concerns that normalized artifact only; raw ORS JSON is neither persisted nor required to be canonical. The generated fixture is admitted only after those checks; failed generation leaves it unchanged. `clearanceAlternativeCatalog` MAY statically read the checked-in alternative GeoJSON and expose immutable relation, geometry, summary, and provenance, but makes no request and needs no key; it remains unused by current UI/features, application operations, WebMCP, and scenario composition.

Tests MUST separately assert one logical candidate/one feature and the expected number of retried HTTP calls. The exclusion guard MUST scan `src/features`, `src/domain/operations`, `src/platform/webmcp`, and `src/scenario/fixtures/spain-v1.ts`, proving none imports or uses the alternative fixture/catalog or gains assignment, rerouting, staged plans, application behavior, or tools; only the dedicated catalog, generation path, and tests may reference the fixture.

Estimated authored implementation: source 165–185 lines, tests 120–140 lines, docs/manifests/package scripts 35–45 lines; total 320–370 manual lines. The generated GeoJSON is excluded from that count. The batch can remain below the 400-line manual budget: `Decision needed before apply: No`; `Chained PRs recommended: No`; `400-line budget risk: Low`.

Rollback is deletion of the new alternative manifest/GeoJSON/catalog/script/test and reversal of the three shared exports, package commands, and documentation; `git diff --exit-code 435f14f -- src/scenario/fixtures/ors-route-manifest.json src/scenario/fixtures/ors-routes.geojson` proves the protected main fixtures remain untouched.

### Risks
- ORS may reject the avoidance polygon or return an HGV route that intersects its boundary; do not widen dynamically or invent waypoints—fail admission and report the provider result for an explicit follow-up decision.
- The current generator derives risk snaps from numeric route IDs, so forcing the alternative into the main collection would create false risk metadata; a separate verified fixture avoids that coupling.
- The generated route's exact distance, duration, coordinate count, and hash cannot be claimed until the one authorized logical generation succeeds; `ORS_API_KEY` must remain process-only and never appear in logs, tests, fixtures, or provenance.

### Ready for Proposal
Yes. Propose one logical generation-only alternative fixture, its inert static catalog, explicit canonical/non-intersection/exclusion gates, and no current UI, application, WebMCP, scenario-composition, main-fixture, or additional-alternative scope.
