# Tasks: Phase 1.1 Operational Console Redesign

## Review Workload Forecast

Total authored lines (source, tests, docs, reviewed GeoJSON; excludes PNG bytes): **4,190–4,715**. 400-line risk: **High**; 800-line risk: **Medium**. Six autonomous chained slices are required; no slice may exceed 800 authored lines.

| Unit / commit / PR boundary | Lines | Focused evidence; runtime harness; visual evidence | Safe rollback boundary |
|---|---:|---|---|
| 1 `feat(console): coordinate shell` | 640–760 | `bun run test -- src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx`; `VITE_WEBMCP_LOCAL_BYPASS=true bun run dev -- --host 127.0.0.1`; desktop overview | UI store, shell, topbar, CSS only |
| 2 `feat(console): add OR result panels` | 690–790 | `bun run test -- src/features/fleet`; same dev harness; desktop filters | Filter/panel components and tests |
| 3A `feat(routes): generate reviewed ORS fixtures` | 745–795 | `ORS_API_KEY=<secret> bun --no-env-file run routes:generate`; `bun --no-env-file run routes:verify && bun run test -- scripts/generate-ors-routes.test.ts src/scenario && bun run test`; process-environment-only/redacted provenance review | Generator, manifest, GeoJSON, domain derivation, docs |
| 3B `feat(map): render accepted route fixtures` | 735–795 | `bun run test -- src/features/map && bun run test`; fixture-only map diagnostics; desktop route/risk | Map layers/tests only; no provider or key files |
| 4 `feat(inspection): localize operational detail` | 680–790 | `bun run test -- src/preferences src/features/fleet`; same rename/delete/tablet harness; tablet detail | Inspection, catalog, formatter changes |
| 5 `test(console): prove release evidence` | 710–790 | `bun run test`, Playwright/native commands below; six reviewed PNGs | E2E, evidence, docs only |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

`auto-chain` uses feature-branch-chain: tracker/integration branch `feat/phase1-1-operational-console-redesign`; Unit 1 targets the tracker, Unit 2 targets Unit 1, Unit 3A targets Unit 2, Unit 3B targets Unit 3A, Unit 4 targets Unit 3B, and Unit 5 targets Unit 4. The tracker PR alone targets `main`, remains unmerged for user visual review, and neither tracker nor child PRs may merge to `main` automatically. Base: `d0856b8`; issue #15 remains the approved tracker. Old unpublished Unit 3 branch/commits are abandoned and excluded from delivery; never rebase or cherry-pick them.

## Phase 1: Shell and Coordination (Unit 1; depends on baseline)

- [x] 1.1 Add `src/app/state/useUiCoordinationStore.test.ts` RED tests, then modify `useUiCoordinationStore.ts` for immutable OR-ready filters, panel context, selection/follow, focus requests, and restoration.
- [x] 1.2 Modify/create `src/features/shell/{OperationalShell,Topbar,ContextPanel}.tsx`, `src/styles.css`, `index.html`; prove landmarks, topbar-only content, tokens, desktop grid, focus, and reduced motion.
- [x] 1.3 Commit Unit 1 with its tests; preserve `App -> OperationsApi -> ScenarioRepository` and exclude all Phase 2 capabilities.

## Phase 2: Filters and Context Panels (Unit 2; depends on 1)

- [x] 2.1 Add `filtering.test.ts`, `OperationalOverview.test.tsx`, and `FilterResults.test.tsx` RED tests; create `src/features/fleet/{filtering.ts,OperationalOverview.tsx,FilterResults.tsx,VehicleResultCard.tsx}` and modify `FilterRail.tsx` for derived OR counts, dedupe, exact priority, chips, and reset.
- [x] 2.2 Modify `ContextPanel.tsx` and shell tests for overview/results/selection priority, result-card selection, and close/delete focus restoration on desktop/tablet.
- [x] 2.3 Commit Unit 2 with filter/panel tests and dev-server filter harness; capture its two desktop states only in Unit 5.

## Phase 3A: ORS Route Fixture Pipeline and Domain Derivation (depends on 1–2)

- [x] 3A.1 Add RED `scripts/generate-ors-routes.test.ts`; modify `package.json` and create `scripts/generate-ors-routes.ts` with `ORS_API_KEY=<secret> bun --no-env-file run routes:generate` and `bun --no-env-file run routes:verify`: process-environment-only secret loading, no repository `.env` read or key output, canonical SHA-256/no-op output sensitive to `null` versus array radiuses, Authorization-only request, atomic writes, redaction, and missing-key/HTTP/malformed-response/optional-per-coordinate-positive-radius coverage.
- [x] 3A.2 Create reviewed versioned `src/scenario/fixtures/{ors-route-manifest.json,ors-routes.geojson,routeCatalog.ts}` and `docs/route-fixtures.md`; document exactly `ORS_API_KEY=<secret> bun --no-env-file run routes:generate` and `bun --no-env-file run routes:verify`, ORS provenance, manifest hashes, offline runtime, route-014 `[547,350]` passthrough with unchanged logical coordinates, omitted radiuses/default 350 elsewhere, and fixture review procedure.
- [x] 3A.3 Add invariant tests and modify `src/{domain/entities.ts,scenario/fixtures/spain-v1.ts,scenario/geometry.ts,scenario/routeRuntime.ts}` for `routeId`/`routeProgress`, geometry-derived positions, catalog loading, separate logical/returned endpoints and snap distances, dual configured/default radiuses with 2 km validation, and snapped symmetric restriction/risk references; prohibit pre-snapping, waypoints, alternatives, and geometry rewriting; guard runtime imports, network, and secrets, with no visual map work beyond position-shape compatibility. Commit this child slice targeting Unit 2 after focused and full tests pass.

## Phase 3B: Fixture-Only Visual Map (depends on 3A)

- [x] 3B.1 Add map RED tests; modify/create `src/features/map/{FleetMap,layers,MapEventCoordinator,VehicleMarkerLayer,MapLegend}.ts*` for checked-in fixture markers/labels, routes, severity encodings, legend, desaturated attributed OSM, and Spain viewport/invalidation.
- [x] 3B.2 Add pointer/touch/tablet diagnostics proving one-click focus, user-versus-programmatic follow cancellation, panel/dialog resize invalidation, and fixture-only route/risk rendering; do not change generator, provider, API, key, manifest, or fixture pipeline files.
- [x] 3B.3 Commit this child slice targeting Unit 3A with `bun run test -- src/features/map && bun run test` and the fixture-only dev harness; retain Unit 5 as the sole final screenshot capture and visual comparison boundary.

## Phase 4: Inspection and Localization (Unit 4; depends on 3B)

- [ ] 4.1 Add `src/features/fleet/{formatters,VehicleInspection}.test.ts*` RED tests; replace `VehicleDrawer.tsx` with `VehicleInspection.tsx` and `formatters.ts` for five sections, fallbacks, View on route, Follow, valid-save feedback, and confirmed deletion.
- [ ] 4.2 Modify `src/preferences/i18n/{catalog,en,es}.ts` and relevant tests for typed English/Spanish strings, `Intl` values, persistence independence, dialog focus trap/restoration, keyboard access, and reduced motion.
- [ ] 4.3 Commit Unit 4 with rename/reload, invalid/corrupt override recovery, cancel/confirm delete, and tablet dialog tests.

## Phase 5: Release Regression and Evidence (Unit 5; depends on 4)

- [ ] 5.1 Extend `e2e/operational-console.spec.ts` and `e2e/production-gate.spec.ts` to trace all 58 corrected scenarios, operational/a11y/tablet/reduced-motion flows, gate/lifecycle, exactly four tools/schemas/responses, and Phase 2 absence.
- [ ] 5.2 Run genuine native Chromium `/usr/bin/chromium --enable-features=WebMCP` with no seam, polyfill, interception, or bypass; prove registration-before-render, rename restore, abort cleanup, stopped processes, and free port 4173.
- [ ] 5.3 Capture and critically compare: `docs/evidence/phase1-1/desktop-overview.png`, `docs/evidence/phase1-1/desktop-weather-filter.png`, `docs/evidence/phase1-1/desktop-selected-route-risk.png`, `docs/evidence/phase1-1/desktop-two-filters.png`, `docs/evidence/phase1-1/tablet-results.png`, `docs/evidence/phase1-1/tablet-detail.png`; add `docs/evidence/phase1-1/visual-comparison.md` and update only current release-readiness docs.
- [ ] 5.4 Require `bun run lint`, `bun run typecheck`, `bun run test`, `bun run test:e2e -- e2e/operational-console.spec.ts`, `bun run test:e2e -- e2e/production-gate.spec.ts`, `bun run build`; run tracked-secret/generated-output guards and process/output cleanup before the Unit 5 review PR.

## Dependencies and Threat Matrix

`1 -> 2 -> 3A -> 3B -> 4 -> 5`; tests travel with each behavior. Every design threat-matrix row is explicitly N/A, so no threat RED-test task applies. Retain only `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`; no new tools or Phase 2 work.

Exactly 12/19 tasks are complete. Units 4 and 5 remain pending.
