# Design: Phase 1.1 Operational Console Redesign

## Technical Approach

Preserve application/repository boundaries, UI-only Zustand, exact WebMCP, and approved navy/light visuals. Routes are checked-in generation-time ORS HGV output; runtime never contacts ORS.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Routing | Quota/review | Use offline ORS fixtures. |
| Output | Review/atomicity | One generated GeoJSON. |
| Position | Computation | `routeId`+`routeProgress`. |
| Dependencies | Local validation | Existing stack suffices. |

## Visual and Application Contract

Desktop retains `56px` topbar, `64px|232px` rail, dominant map, `clamp(336px,27vw,400px)` Overview/Results/Inspection panel. Tablet keeps overlay rail/results and trapped Inspection. Preserve accessibility, reduced motion, i18n, Spain styling, sorting, and follow.

UI state retains filters/context/selection/follow/rail/map-focus; React mutations use `OperationsApi` only.

## ORS Generation Boundary

Add `"routes:generate":"bun run --no-env-file scripts/generate-ors-routes.ts"`; run `bun run routes:generate`. The entry requires `process.env.ORS_API_KEY`; it never reads/writes `.env`, logs/exposes secrets, or starts HTTP without the key.

`src/scenario/fixtures/ors-route-manifest.json` conforms to typed `RouteGenerationManifest={version,routes:[{routeId,origin:{id,coordinates:[lon,lat]},destination:{id,coordinates:[lon,lat]},request:{preference,options,radiuses?:readonly number[]}}]}`: stable geometry-affecting configuration, no shape waypoints/alternatives. Radiuses length MUST equal coordinates length and every value MUST be finite/positive.

`scripts/routes/generator.ts` sequentially POSTs sorted routes to `https://api.openrouteservice.org/v2/directions/driving-hgv/geojson` with `Authorization: <ORS_API_KEY>`, JSON content, `{coordinates:[origin,destination],...request,instructions:false}`, and no alternatives. It forwards optional radiuses unchanged beside original logical coordinates; it MUST NOT substitute pre-snapped coordinates or add waypoints. Honor `Retry-After`; retry 429/5xx thrice; fail other status/JSON/schema errors.

### Route-014 Radius Evidence

`route-014` alone declares `radiuses:[547,350]`; every other route omits radiuses and uses ORS's 350m default unless separately evidenced. Accepted output stores logical endpoints, returned LineString first/last endpoints, and Turf-computed snap distances separately. Each distance MUST be within its configured/default radius and the global 2km tolerance. Safe diagnostics: route-014 origin `546.8199476793687` m, destination `113.79408158125304` m, successful `2,002`-point LineString; route-015 default-radius preflight succeeded. These facts justify request configuration/acceptance only; response summaries remain generated ORS data, never hand-authored fixtures.

Write only `src/scenario/fixtures/ors-routes.geojson`; top-level `xSupplyMesh` records generated marker, versions, endpoint/profile, UTC `generatedAt`, and `sourceRevision`. Validate all in memory, write/fsync sibling temp, then rename; failure preserves the accepted file.

### `sourceRevision` Canonical Contract

`sourceRevision` is the lowercase-hex `sha256(UTF-8(canonicalJSON(payload)))` over exactly `{fixtureSchemaVersion,provider:"openrouteservice",profile:"driving-hgv",manifest:{version,routes},routes}`. Sorted `manifest.routes` contain IDs, logical endpoints, geometry-affecting `preference/options`, and materialized `radiuses` (`null` when omitted/default; arrays otherwise; empty arrays invalid). Sorted output routes contain route ID, ordered LineString coordinates, summaries, logical/returned endpoints, snap distances, endpoint associations, and risk references sorted by stable risk ID with indices/coordinates. Any radius change changes the hash.

Canonical JSON recursively sorts object keys; arrays preserve semantic order except explicitly sorted manifest/output-route/risk-reference collections; UTF-8 has no BOM or insignificant whitespace. Every payload number is finite IEEE-754 at full parsed precision: no rounding. Serialize with ECMAScript `JSON.stringify` shortest round-trippable decimal, normalizing `-0` to `0`; coordinates remain exact and summaries remain ORS meters/seconds. Canonicalization never alters route shape.

Exclude API key/Authorization/headers, raw response, provider timestamps, uncontrolled ORS engine/build metadata, `generatedAt`, prior `sourceRevision`, temp paths, and volatile provenance. `generatedAt` changes only with the hash; unchanged payload/hash performs a byte-for-byte no-op preserving timestamp/file bytes.

Snap point restrictions to vertices and route risks to contiguous segment endpoints. Persist IDs, indices, and exact coordinates in the generated fixture; `routeCatalog.ts` and fixture composition consume them, validate associations/index equality, and reject drift.

## Runtime Contracts and Files

`src/scenario/fixtures/routeCatalog.ts` validates/catalogs the manifest and generated GeoJSON; `src/scenario/routeRuntime.ts` owns progress/position runtime behavior. Static fixture imports require no fetch. Runtime cannot reach scripts/ORS/key/fetch.

`Vehicle` uses `routeId` plus finite `[0,1]` `routeProgress`, not seeded position. Turf segment traversal returns first/last coordinate at bounds or the interior segment point without rewriting geometry. Invalid route/progress/snap throws typed error; `spain-v1.ts` derives position/route/risks.

Prior UI changes remain. Add generator tests, raw typing, and future route-fixture workflow; this phase edits only design.

## Testing and Delivery

Trace 58 scenarios. Mock-fetch tests cover radius validation/exact passthrough, route-014 acceptance, default omission, failures/retries/redaction/atomicity, and prohibition of coordinate substitution/geometry rewriting. Canonical tests prove ordering/exclusions, radius/input/output sensitivity, and no-op byte preservation. Fixture tests cover logical/returned endpoints, snap-radius bounds, provenance/routes/progress/snaps/offline load/unchanged geometry. Runtime guards reject ORS/key/fetch; Playwright allows only token-free OSM tiles after app assets.

Preserve `scenario_current`/`fleet_status`/`vehicle_get`/`vehicle_rename` schemas/envelopes/API/gate/cleanup/bypass/native proof and six screenshots: desktop overview/expanded-Weather-affected/selected-route-risk/two-active-filters; tablet filter-results/vehicle-detail.

Units: 1 shell/store; 2 filters/panels; 3A generator/fixture/progress/snaps/guards; 3B map; 4 inspection/i18n; 5 WebMCP/evidence. 3A precedes 3B; slices are <800 lines/revertible. Feature-chain PRs target predecessor, never `main`/auto-merge. Old unpublished Unit 3 stays outside history.

## Threat Matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | Fixed TypeScript entry; no executable classification. |
| Git repository selection | N/A | Generator runs no Git command. |
| Commit state | N/A | No staging/commit automation. |
| Push state | N/A | No push automation. |
| PR commands | N/A | No PR command composition. |

## Migration / Rollback

No storage migration. Roll back 3B before 3A and restore the reviewed fixture. Require secret-safe regeneration receipts/diffs/scans. Phase 2 routing/live-provider/simulation/backend/driver/agent work remains excluded.

## Open Questions

None.
