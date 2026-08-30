# Proposal: Phase 2 Clearance Alternative Route

## Intent

Provide offline evidence of one genuine HGV clearance-avoiding route for Unit 211, without runtime routing or consumer changes.

## Scope

### In Scope
- Target `vehicle-011` / FM-211 / Unit 211 on `route-011`, Toledo→Alcobendas (99,706.6 m / 5,292.1 s).
- Derive one deterministic avoid polygon from `restriction-height-3.9` at route index 537, `[-3.897481,40.149232]`.
- Generate one logical ORS `driving-hgv` candidate and one feature; bounded transport retries do not create alternatives.
- Store a versioned fixture and static catalog exposing immutable relation, geometry, summary, and canonical provenance.

### Out of Scope
- Comparison UI, staged plans, approval/application, movement, tools, further alternatives, runtime routing, weather, and refactors.
- Current UI/application, `OperationsApi`, WebMCP, or scenario-composition consumption; main-fixture byte changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `deterministic-fleet-scenario`: Specify generation, validation, provenance, static catalog access, and offline storage for one fixture while prohibiting dynamic alternatives.

## Approach

Reuse minimally exported ORS request, canonical-hash, and atomic-write primitives. From accepted `route-011`, resolve the exact snap and submit one polygon with unchanged endpoints. Fail closed, preserving prior output, on provider rejection; malformed geometry; polygon contact; endpoint drift; fewer than three coordinates; non-positive/over-2× summary; or normalized fixture payload/`sourceRevision` verification failure. Raw ORS JSON need not be canonical.

A static catalog may import the fixture and expose immutable `{ vehicleId, currentRouteId, avoidsRiskId, alternativeRouteId }`, geometry, summary, and provenance. An exclusion guard prevents current UI/application, `OperationsApi`, WebMCP, and scenario composition from consuming either artifact or gaining staged plans, assignment, rerouting, behavior, or tools. Runtime has no network/key path; `ORS_API_KEY` remains process-only.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `scripts/routes/generator.ts` | Modified | Export provider/hash/write primitives only. |
| `scripts/generate-clearance-alternative-route.ts` | New | Generate and verify one alternative. |
| `src/scenario/fixtures/clearance-alternative-route-v1.*`, `clearanceAlternativeCatalog.ts` | New | Versioned artifacts and catalog. |
| `package.json`, `docs/route-fixtures.md` | Modified | Add commands and guidance. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| ORS rejects or intersects the polygon | Medium | Do not widen or invent waypoints; reject admission. |
| Fixtures or consumers drift | Low | Byte-compare `435f14f`; enforce exclusions. |

## Rollback Plan

Delete the script/tests/manifest/GeoJSON/catalog, revert exports/commands/docs, and prove both main fixtures match `435f14f` byte-for-byte.

## Dependencies

- One generation-time ORS request with process-only `ORS_API_KEY`; issue #26 stays open and any feature PR remains unmerged.

## Success Criteria

- [ ] One logical candidate produces one validated feature avoiding the exact polygon; retries are transport-only.
- [ ] Catalog is immutable; guards pass; runtime stays offline/keyless; main fixture bytes remain unchanged.
- [ ] Authored source/test/docs changes remain within the 400-line budget and the PR remains unmerged.
