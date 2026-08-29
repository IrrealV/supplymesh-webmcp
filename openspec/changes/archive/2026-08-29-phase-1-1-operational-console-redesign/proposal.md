# Proposal: Phase 1.1 Operational Console Redesign

## Intent and Problem

Repair Phase 1 operationally, not cosmetically; workflows lack approved logistics hierarchy.

## Outcomes

- Professional three-column logistics console: dark SupplyMesh topbar/rail, balanced Spain map, and default/results/inspection right-panel modes.
- OR multi-filter rail: derived counts and deduplicated, priority-sorted contextual results.
- Visible truck markers/labels, realistic deterministic road routes, clear risks, useful Spain viewport, one-click focus, and correct follow cancellation.
- Hierarchical localized inspection/humanized values preserving view/follow, rename, deletion, English/Spanish roundtrip, accessibility, reduced-motion, and tablet behavior.
- Real semantic components, never static images or canvas tricks.

## Scope

### In Scope
- UI/filter/map/inspection/i18n/accessibility/responsiveness plus reproducible fixture generation.
- Deterministic offline runtime and acceptance evidence.

### Out of Scope
- Simulation, movement, random fleets, country selection, vehicle creation, Fleet Edit Mode, drag/drop, batch actions, dynamic routing, alternatives, smoothing, invented waypoints, live runtime providers, backend/database/auth, driver UI, chat, agent behavior, new WebMCP tools, Phase 2 route assignment/rerouting, and every other Phase 2 capability.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `operational-shell-i18n`: panels/rail/locale/accessibility/tablet.
- `interactive-fleet-map`: OR layers, focus, viewport, follow.
- `deterministic-fleet-scenario`: versioned routes, derived positions, snapped risks.
- `vehicle-operations`: localized, humanized inspection.

## Approach and Constraints

Use the superseding OSM-router fixture strategy. A reproducible Bun script uses `ORS_API_KEY` only during generation to POST openrouteservice `driving-hgv` requests to `/v2/directions/driving-hgv/geojson`. Commit versioned checked-in GeoJSON route fixtures and provenance metadata. Runtime reads fixtures only, without routing API, key, or network path. Vehicles reference `routeId`/`routeProgress`; geometry derives position. Mock restrictions/closures and relevant risks snap to real fixture polyline points/segments.

Preserve React UI -> application/domain operations -> Zustand `ScenarioRepository` and separate UI state. WebMCP keeps the same operations and exactly `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`; names, schemas, responses, gate, cleanup, and dev-only bypass remain unchanged.

References govern composition/hierarchy beneath the written contract, not pixel matching/assets. Missing `PRODUCT.md`/`DESIGN.md` is non-blocking; the approved brief is confirmed shape authority.

## Affected Areas

| Area | Impact |
|---|---|
| features/styles/UI/i18n | Console behavior/presentation |
| generator and scenario fixtures | Routes/provenance |
| WebMCP | Preservation regression surface |

## Acceptance and Governance

- Pass the full matrix: lint, typecheck, Vitest, Playwright, build, accessibility/responsive/motion, and native WebMCP; runtime remains offline deterministic.
- Capture desktop default/filters/inspection and tablet default/filters/inspection under `docs/evidence/phase1-1/`; critically compare all six with supplied references.
- Auto-chain under 800 lines from issue #15/baseline `d0856b8`; discard old unpublished Unit 3 branch and begin replacement from Unit 2. Publish branch and PR for human visual review, never auto-merge.

## Dependencies, Risks, and Rollback

Panel density, filter/selection/follow conflicts, and base tiles remain risks. Regeneration adds ORS availability/quota, key-handling, and response-stability risks. Validate output/provenance and fixture diffs without weakening offline acceptance. Roll back replacement slices; runtime architecture remains intact.
