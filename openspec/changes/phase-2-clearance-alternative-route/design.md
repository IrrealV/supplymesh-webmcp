# Design: Phase 2 Clearance Alternative Route

## Technical Approach

Build one generation-only candidate/feature beside protected fixtures and an offline static catalog unused by current consumers. Reuse existing ORS/canonical/atomic behavior.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Extend main schema | Couples alternatives to synthetic risks and risks 15-route drift | Reject; protect both main fixture files at `435f14f`. |
| Dedicated pipeline | Narrow schema and inert catalog | Use schema/manifest `1`, ID `alternative-route-011-clearance-v1`, one candidate, one feature. |
| 32/64-edge circle | ~1.20/~0.30 m chord sagitta | Use Turf `circle([-3.897481,40.149232],250,{units:"meters",steps:64})`: 65 closed coordinates, no waypoint/substitution. |
| Duplicate plumbing | Forks provider behavior | Export private `requestRoute`/`writeAtomically` unchanged; add `canonicalSha256` over private SHA/canonical JSON. Preserve callers/main bytes. |

## Data Flow

```text
manifest + protected route-011 -> identity/snap checks -> Turf polygon
  -> one candidate -> shared ORS POST/retry -> one normalized feature
  -> canonical no-op check -> atomic GeoJSON rename -> offline relation catalog
```

The `driving-hgv` body is `{coordinates:[[-4.0273,39.8628],[-3.7496,40.4637]],preference:"recommended",options:{avoid_polygons:<Polygon>},instructions:false}`: no radiuses override or `alternative_routes`. The existing loop permits four attempts only for 429/5xx; numeric `Retry-After` caps at 5,000 ms, otherwise `min(250*2^retryIndex,2000)`. Attempts share body, candidate, and output path; other failures are immediate. The process-only key is never persisted/logged.

## Interfaces / Contracts

Manifest: `version:1`; relation `{vehicleId:"vehicle-011",currentRouteId:"route-011",avoidsRiskId:"restriction-height-3.9",alternativeRouteId:"alternative-route-011-clearance-v1"}`; guards for revision `16e9952c577cfcc7de3e1cd8bfbc1ea068557c049d5674052b3b1e74fcacc439`, endpoints, `99706.6 m/5292.1 s`, 1,120 coordinates, snap index/coordinate, and `{shape:"geodesic-circle",radiusMeters:250,steps:64}`. Resolve protected values; reject drift before HTTP.

GeoJSON metadata stores schema/provider/profile, `generatedAt`, revisions, and count `1`; its feature stores relation, endpoints/snaps, summary/count, avoidance/clearance, and geometry.

`clearanceAlternativeCatalog` imports that fixture and deeply freezes `{relation,geometry,summary,provenance}` including coordinate arrays; provenance is provider/profile/`sourceRevision`/`generatedAt`/avoidance. No current `App`/UI/feature, `OperationsApi`, WebMCP, or `createSpainScenario` consumer imports it.

Canonical payload: `{fixtureSchemaVersion,provider,profile,manifest,currentRouteSourceRevision,relation,request:{logicalEndpoints,preference,options,instructions},route:{returnedEndpoints,snapDistancesMeters,summary,coordinateCount,avoidance,coordinates}}`. Exclude `generatedAt`, secrets, headers, raw ORS JSON. “Non-canonical” means normalization fails or stored `sourceRevision!==canonicalSha256(payload)`; raw JSON is only parsed/validated. Equal verified revisions preserve bytes/timestamp/mtime. Verify before shared atomic write; failure preserves accepted bytes.

Admit `>=3` coordinates; `booleanIntersects(route,polygon)===false` (boundary included); finite `minimumClearanceMeters>0` from geodesic route-vertex `pointToPolygonDistance` and polygon-vertex `pointToLineDistance`; snaps `<=350 m`; `0<distance<=199413.2`; `0<duration<=10584.2`. Compare only in verification/docs.

## File Changes and Manual-Line Forecast

| File | Action | Forecast |
|---|---|---:|
| `scripts/routes/generator.ts` | Exports | 6 |
| `scripts/generate-clearance-alternative-route.ts` | Generate/verify | 145 |
| `scripts/generate-clearance-alternative-route.test.ts` | Pipeline tests | 120 |
| `src/scenario/fixtures/clearance-alternative-route-v1.manifest.json` | Manifest | 14 |
| `src/scenario/fixtures/clearance-alternative-route-v1.geojson` | Generated | excluded |
| `src/scenario/fixtures/clearanceAlternativeCatalog.ts` | Frozen catalog | 24 |
| `src/scenario/fixtures/clearanceAlternativeCatalog.test.ts` | Catalog/exclusions | 18 |
| `package.json`, `docs/route-fixtures.md` | Commands/docs | 27 |

Total: **354 manual changed lines**, one batch, one commit, one unmerged PR; no chained PR.

## Testing Strategy

RED tests cover identity/polygon, one candidate/feature, no alternatives; successful retry and four-attempt exhaustion preserving bytes; all geometry/summary/count bounds; payload-field tampering, revision mismatch, and canonical no-op; secret/log absence; deep catalog immutability and offline/keyless load. Scan `src/app/**`, `src/features/**`, `src/domain/operations/**`, `src/platform/webmcp/**`, and `spain-v1.ts` for catalog/fixture imports or staged-plan, application/apply/assign/reroute, new-tool, and other-alternative symbols/imports. Protected hashes remain `65172c3ae47fe52d97c41b9a811c9088fb464c3124a54367c17ecfd674b7ba3f` and `977629e48cb9266eb167b095085f6768bc7f94ffec44f9650210cca979ad6b0e` (`435f14f`).

Commands: `ORS_API_KEY=<secret> bun --no-env-file run routes:clearance:generate`; then, keyless, `bun --no-env-file run routes:clearance:verify`, `bun --no-env-file run routes:verify`, `bun run test -- scripts/generate-clearance-alternative-route.test.ts src/scenario/fixtures/clearanceAlternativeCatalog.test.ts`, and `bun run check`.

## Threat Matrix

| Boundary | Applicability | Design response / RED test |
|---|---|---|
| Documentation-like paths | N/A — explicit `.ts` targets | No classification. |
| Git repository selection | N/A — fixed hashes | No Git call. |
| Commit state | N/A — no automation | No index semantics. |
| Push state | N/A — no automation | No destination. |
| PR commands | N/A — no automation | No composition. |

## Migration / Rollout

No migration or feature flag. Roll back by deleting the six new implementation/fixture files and reverting the three generator exports, two package scripts, and documentation block; re-run protected hashes. Do not archive, merge, add alternatives, or begin other Phase 2 work.

## Open Questions

None.
