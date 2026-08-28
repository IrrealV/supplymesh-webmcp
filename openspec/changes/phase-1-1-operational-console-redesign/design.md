# Design: Phase 1.1 Operational Console Redesign

## Technical Approach

Preserve `App -> OperationsApi -> ScenarioRepository`, UI-only Zustand, exact WebMCP, and approved navy/light operational visuals without gradients/glass/AI decoration. Replace manual corridors with checked-in generation-time ORS HGV output; runtime never contacts ORS.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Manual/runtime routing vs fixtures | Quota/review | Choose offline ORS fixtures. |
| Multiple outputs vs collection | Review/atomicity | One GeoJSON owns all generated data. |
| Positions vs progress | Computation | `routeId`+`routeProgress` prevents drift. |
| New libraries vs stack | Local validation | Bun/Turf/Vite/crypto suffice. |

## Visual and Application Contract

Desktop: `56px` topbar over `64px|232px rail + minmax(0,1fr) map + clamp(336px,27vw,400px) panel`; Overview/Results/Inspection. Tablet (`768–1023px`): `56px + 56px/map`, overlay rail/results, trapped `min(560px,calc(100vw - 32px))` Inspection. Preserve accessibility, reduced motion, topbar/language, sorting, inspection/i18n, Spain map styling, and cancellable follow.

UI state retains filters/context/selection/follow/rail/map-focus; React mutations use `OperationsApi` only.

## ORS Generation Boundary

Add `"routes:generate":"bun run --no-env-file scripts/generate-route-fixtures.ts"`; run `bun run routes:generate`. The entry requires `process.env.ORS_API_KEY`; it never reads/writes `.env`, logs/exposes secrets, or starts HTTP without the key.

`scripts/routes/manifest.ts` exports typed `RouteGenerationManifest={version,routes:[{routeId,origin:{id,coordinates:[lon,lat]},destination:{id,coordinates:[lon,lat]},request:{preference,options}}]}`: stable geometry-affecting configuration, no shape waypoints/alternatives. `scripts/routes/risk-snap-input.ts` holds risk/route IDs and approximate anchors.

`scripts/routes/generator.ts` sequentially POSTs sorted routes to `https://api.openrouteservice.org/v2/directions/driving-hgv/geojson` with `Authorization: <ORS_API_KEY>`, JSON content, `{coordinates:[origin,destination],...request,instructions:false}`, and no alternatives. Honor `Retry-After`; retry 429/5xx thrice with bounded backoff; fail other status/JSON/schema errors. Require one three-plus-point `Feature<LineString>`, finite `[lon,lat]`, 2km endpoint tolerance, Spain bounds, positive summary.

Write only `src/scenario/fixtures/generated/spain-hgv.v1.geojson`; top-level `xSupplyMesh` records generated marker, versions, endpoint/profile, UTC `generatedAt`, and `sourceRevision`. Validate all in memory, write/fsync sibling temp, then rename; failure preserves the accepted file.

### `sourceRevision` Canonical Contract

`sourceRevision` is the 64-character lowercase-hex `sha256(UTF-8(canonicalJSON(payload)))`, where `payload` is exactly `{fixtureSchemaVersion,provider:"openrouteservice",profile:"driving-hgv",manifest:{version,routes},routes}`. `manifest.routes` is sorted by `routeId`; each item contains `routeId`, origin/destination IDs and `[lon,lat]`, and geometry-affecting `preference/options`. Output `routes` is sorted by `routeId`; each item contains `routeId`, accepted LineString coordinates in route order, `{distanceMeters,durationSeconds}`, endpoint ID associations, and snapped point/segment references sorted by stable `riskId`, including start/end coordinate indices and exact coordinates.

Canonical JSON recursively sorts object keys; arrays preserve semantic order except explicitly sorted manifest/output-route/risk-reference collections; UTF-8 has no BOM or insignificant whitespace. Every payload number is finite IEEE-754 at full parsed precision: no rounding. Serialize with ECMAScript `JSON.stringify` shortest round-trippable decimal, normalizing `-0` to `0`; coordinates remain exact and summaries remain ORS meters/seconds. Canonicalization never alters route shape.

Exclude API key/Authorization/headers, raw response, provider timestamps, uncontrolled ORS engine/build metadata, `generatedAt`, prior `sourceRevision`, temp paths, and volatile provenance. `generatedAt` changes only with the hash; unchanged payload/hash performs a byte-for-byte no-op preserving timestamp/file bytes.

Snap point restrictions to vertices and route risks to contiguous segment endpoints. Persist IDs, indices, exact coordinates; validate associations/index equality and reject drift.

## Runtime Contracts and Files

`src/scenario/fixtures/routes/{types,loadRouteFixtures}.ts` defines `RouteFixtureCollection`, `RouteFeature`, `RouteSummary`, `RiskSnap`, and validated static `?raw` loading. Runtime cannot reach scripts, ORS/client/key/fetch.

`Vehicle` retains `routeId`, adds finite `[0,1]` `routeProgress`, and drops seeded position. Turf-based `pointAtRouteProgress()` traverses segment distances: first coordinate at `<=0`, last at `>=1`, otherwise the containing-segment point without rewriting geometry. Missing route, malformed geometry, invalid stored progress, or stale snap throws typed fixture error, never fallback. `spain-v1.ts` derives position/route/risks.

Prior shell/filter/inspection/i18n/map changes remain. Add `scripts/routes/generator.test.ts`, raw typing config, and future `docs/route-fixtures.md` workflow; this phase edits only design.

## Testing and Delivery

Trace 53 scenarios: 16 shell/i18n, 13 map, 14 scenario/generation, 10 inspection. Mock-fetch generator tests cover exact request, failures/retries/redaction/atomicity. Canonical tests prove recursive ordering, volatile-field exclusion, input/coordinate/summary/snap changes alter the hash, and unchanged payload preserves bytes/timestamp. Fixture tests cover provenance/routes/endpoints/progress/snaps/offline load/unchanged geometry. Import/build guards reject ORS/key/fetch from runtime; Playwright allows only token-free OSM tiles after app assets.

Preserve `scenario_current`, `fleet_status`, `vehicle_get`, `vehicle_rename` schemas/single-text `JSON.stringify(DomainResult)` envelopes, shared API, gate/cleanup/dev bypass, and native proof. Preserve exactly six screenshots: desktop overview; expanded Weather affected; selected route/risk; two active filters; tablet filter results; tablet vehicle detail.

Forecast: Unit 1 shell/store; 2 filters/panels; 3A generator/schema/reviewed-fixture/progress/snaps/guards; 3B visual map; 4 inspection/i18n; 5 WebMCP/evidence. 3A MUST pass before 3B; each commit/PR is <800 authored lines and revertible. Feature-chain PRs target tracker/predecessor, never `main`/auto-merge. Abandoned unpublished old Unit 3 is not cherry-picked or delivery history.

## Threat Matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | Fixed TypeScript entry; no executable classification. |
| Git repository selection | N/A | Generator runs no Git command. |
| Commit state | N/A | No staging/commit automation. |
| Push state | N/A | No push automation. |
| PR commands | N/A | No PR command composition. |

## Migration / Rollback

No storage migration; retain existing keys. Roll back 3B before 3A and restore the last reviewed fixture. Regeneration review requires secret injection outside shell history, receipts, provenance/geometry diffs, and clean secret scan. Phase 2 alternatives/assignment/rerouting/live providers/simulation/backend/auth/driver/chat/agent remain excluded.

## Open Questions

None.
