# Tasks: Phase 1.1 Operational Console Redesign

## Review Workload Forecast

Total authored lines (source, tests, docs; excludes PNG bytes): **3,440–3,940**. 400-line risk: **High**; 800-line risk: **Medium**. Five autonomous chained slices are required; no slice may exceed 800 authored lines.

| Unit / commit / PR boundary | Lines | Focused evidence; runtime harness; visual evidence | Safe rollback boundary |
|---|---:|---|---|
| 1 `feat(console): coordinate shell` | 640–760 | `bun run test -- src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx`; `VITE_WEBMCP_LOCAL_BYPASS=true bun run dev -- --host 127.0.0.1`; desktop overview | UI store, shell, topbar, CSS only |
| 2 `feat(console): add OR result panels` | 690–790 | `bun run test -- src/features/fleet`; same dev harness; desktop filters | Filter/panel components and tests |
| 3 `feat(map): render deterministic corridors` | 720–790 | `bun run test -- src/scenario src/features/map`; same map pointer/touch harness; desktop route/risk | Fixtures, geometry, map layers only |
| 4 `feat(inspection): localize operational detail` | 680–790 | `bun run test -- src/preferences src/features/fleet`; same rename/delete/tablet harness; tablet detail | Inspection, catalog, formatter changes |
| 5 `test(console): prove release evidence` | 710–790 | `bun run test`, Playwright/native commands below; six reviewed PNGs | E2E, evidence, docs only |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

`auto-chain` uses feature-branch-chain: tracker/integration branch `feat/phase1-1-operational-console-redesign`; Unit 1 targets the tracker, Units 2–5 each target their immediate predecessor branch. The tracker PR alone targets `main`, remains unmerged for user visual review, and neither tracker nor child PRs may merge to `main` automatically. Base: `d0856b8`; issue #15 remains the approved tracker.

## Phase 1: Shell and Coordination (Unit 1; depends on baseline)

- [ ] 1.1 Add `src/app/state/useUiCoordinationStore.test.ts` RED tests, then modify `useUiCoordinationStore.ts` for immutable OR-ready filters, panel context, selection/follow, focus requests, and restoration.
- [ ] 1.2 Modify/create `src/features/shell/{OperationalShell,Topbar,ContextPanel}.tsx`, `src/styles.css`, `index.html`; prove landmarks, topbar-only content, tokens, desktop grid, focus, and reduced motion.
- [ ] 1.3 Commit Unit 1 with its tests; preserve `App -> OperationsApi -> ScenarioRepository` and exclude all Phase 2 capabilities.

## Phase 2: Filters and Context Panels (Unit 2; depends on 1)

- [ ] 2.1 Add `filtering.test.ts`, `OperationalOverview.test.tsx`, and `FilterResults.test.tsx` RED tests; create `src/features/fleet/{filtering.ts,OperationalOverview.tsx,FilterResults.tsx,VehicleResultCard.tsx}` and modify `FilterRail.tsx` for derived OR counts, dedupe, exact priority, chips, and reset.
- [ ] 2.2 Modify `ContextPanel.tsx` and shell tests for overview/results/selection priority, result-card selection, and close/delete focus restoration on desktop/tablet.
- [ ] 2.3 Commit Unit 2 with filter/panel tests and dev-server filter harness; capture its two desktop states only in Unit 5.

## Phase 3: Deterministic Map (Unit 3; depends on 1–2)

- [ ] 3.1 Add `src/scenario/{geometry.test.ts,fixtures/spain-v1.test.ts}` RED guards; modify `src/scenario/{geometry.ts,fixtures/spain-v1.ts}` and create `fixtures/spain-route-waypoints.ts` for multi-point Spain corridors, symmetric risk links, route subsequences, and offline risk coverage.
- [ ] 3.2 Add `src/features/map/{layers,MapEventCoordinator,VehicleMarkerLayer,MapLegend}.test.ts*` RED tests; modify/create `src/features/map/{FleetMap,layers,MapEventCoordinator,VehicleMarkerLayer,MapLegend}.ts*` for OSM attribution/desaturation, accessible markers/labels, encodings, legend, viewport, focus, and cancellable follow.
- [ ] 3.3 Commit Unit 3 with drag/wheel/control/pinch/replacement and programmatic-layout evidence; do not add providers, secrets, or runtime routing.

## Phase 4: Inspection and Localization (Unit 4; depends on 1–3)

- [ ] 4.1 Add `src/features/fleet/{formatters,VehicleInspection}.test.ts*` RED tests; replace `VehicleDrawer.tsx` with `VehicleInspection.tsx` and `formatters.ts` for five sections, fallbacks, View on route, Follow, valid-save feedback, and confirmed deletion.
- [ ] 4.2 Modify `src/preferences/i18n/{catalog,en,es}.ts` and relevant tests for typed English/Spanish strings, `Intl` values, persistence independence, dialog focus trap/restoration, keyboard access, and reduced motion.
- [ ] 4.3 Commit Unit 4 with rename/reload, invalid/corrupt override recovery, cancel/confirm delete, and tablet dialog tests.

## Phase 5: Release Regression and Evidence (Unit 5; depends on 1–4)

- [ ] 5.1 Extend `e2e/operational-console.spec.ts` and `e2e/production-gate.spec.ts` to trace all 47 scenarios, operational/a11y/tablet/reduced-motion flows, gate/lifecycle, exactly four tools/schemas/responses, and Phase 2 absence.
- [ ] 5.2 Run genuine native Chromium `/usr/bin/chromium --enable-features=WebMCP` with no seam, polyfill, interception, or bypass; prove registration-before-render, rename restore, abort cleanup, stopped processes, and free port 4173.
- [ ] 5.3 Capture and critically compare: `docs/evidence/phase1-1/desktop-overview.png`, `docs/evidence/phase1-1/desktop-weather-filter.png`, `docs/evidence/phase1-1/desktop-selected-route-risk.png`, `docs/evidence/phase1-1/desktop-two-filters.png`, `docs/evidence/phase1-1/tablet-results.png`, `docs/evidence/phase1-1/tablet-detail.png`; add `docs/evidence/phase1-1/visual-comparison.md` and update only current release-readiness docs.
- [ ] 5.4 Require `bun run lint`, `bun run typecheck`, `bun run test`, `bun run test:e2e -- e2e/operational-console.spec.ts`, `bun run test:e2e -- e2e/production-gate.spec.ts`, `bun run build`; run tracked-secret/generated-output guards and process/output cleanup before the Unit 5 review PR.

## Dependencies and Threat Matrix

`1 -> 2 -> 3 -> 4 -> 5`; tests travel with each behavior. Every design threat-matrix row is explicitly N/A, so no threat RED-test task applies. Retain only `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`; no new tools or Phase 2 work.
