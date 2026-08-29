# Apply Progress: Phase 1.1 Operational Console Redesign

## State

- Mode: Standard; `strict_tdd: false` in `openspec/config.yaml`.
- Delivery: `auto-chain`, `feature-branch-chain`.
- Current boundary: Unit 3B `feat(map): render accepted route fixtures` on `feat/phase1-1-visual-map`, targeting Unit 3A at `0fcf574`.
- Completed tasks: 1.1–2.3, 3A.1–3A.3, and 3B.1–3B.3 (12/19). Units 4–5 remain pending.
- Approved issue: #15. Planning baseline: `9009983`.

## Immutable Unit 1 Candidate Binding

- Repository/product baseline: `d0856b8`.
- SDD planning commit and Unit 1 parent: `9009983e592a3f7d8d778a94f766f4e40b652393` (`9009983`).
- Unit 1 implementation commit: `5c0a74b6294852c3389ce0b3a4b3684a642622bd`.
- Candidate tree: `148ca62f8d3cd897d3ec789ba5015a29c9a098ba`.
- Diff revision: `sha256:39074033a7e23212e5b9ad8401e9785fd1a0c258b5421105363f1c581db49138`.
- Evidence revision: `sha256:56e386e8e0f2a44999e45cb9b36c2cf0a9fc08e363460925c65c68bcc506cddf`.
- Baseline chain: `d0856b8` → `9009983` → `5c0a74b`.
- Authored review size: **516 additions + 98 deletions = 614 changed lines**, below the hard 800-line Unit 1 limit. This count is `git show --numstat` for the immutable Unit 1 implementation commit and includes its authored source, tests, and SDD Markdown; it excludes generated build output and untracked files.

## Impeccable Preflight

`IMPECCABLE_PREFLIGHT: context=pass product=pass command_reference=pass shape=pass image_gate=skipped:user supplied three confirmed composition references; Unit 5 owns the mandated screenshot gate mutation=open`

The confirmed product and shape authority is the user-approved brief plus the current product/UI/architecture docs and SDD proposal/spec/design. Browser inspection remains required and passed; no Unit 5 evidence image was created.

## Work Unit 1 — Shell and Coordination

- [x] 1.1 Immutable OR-ready transient UI coordination state and RED/GREEN tests.
- [x] 1.2 Shell, topbar, ContextPanel framework, desktop/tablet layout hooks, tokens, landmarks, focus, and reduced motion.
- [x] 1.3 One coherent Unit 1 commit boundary with architecture and scope preservation.

### RED/GREEN Evidence

| Stage | Exact result |
|---|---|
| RED | `bun run test -- src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx` → exit 1; 2 files failed, 9 tests failed, 1 passed. Missing active filter set, selection/follow discriminants, focus request actions, ContextPanel, skip link, grid tokens, and reduced-motion contract were observed. |
| GREEN | Same command → exit 0; 2 files passed, 10 tests passed. |
| Direct test typecheck | `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --moduleResolution bundler --module esnext --target esnext --types vitest/globals,node src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx` → exit 0; no diagnostics. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command | `bun run test -- src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx` → exit 0; 2 files, 10 tests. |
| Relevant regression command | `bun run test -- src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx src/features/fleet/FilterRail.test.tsx src/features/map/FleetMap.test.ts src/features/fleet/VehicleDrawer.test.tsx src/preferences/i18n/catalog.test.ts` → exit 0; 6 files, 24 tests. |
| Full quality | `bun run check` → exit 0; ESLint and `tsc -b` clean, 10 Vitest files and 39 tests passed, Vite transformed 4,698 modules and built successfully. |
| Runtime harness | Managed Vite with `VITE_WEBMCP_LOCAL_BYPASS=true` at `127.0.0.1:4173`; headless Chromium at 1440×900 → PASS. Title included SupplyMesh; topbar had exactly three controls (language, Help, Account); landmarks were 1 banner, 1 named navigation, 1 main, 2 complementary regions, and 1 named map region; compact rail was 64px, map 987.203px, panel 388.797px, topbar 56px, workspace 844px; overview mode was present; skip-to-map focus worked; prohibited chrome count and console errors were zero; reduced-motion transition was `1e-05s`. Server terminated and port 4173 was free. |
| Threat matrix | N/A per design; no routing, shell, subprocess, VCS automation, executable-classification, or process-integration boundary changed. |
| Rollback boundary | Revert Unit 1 changes in `index.html`, `src/app/state/useUiCoordinationStore*`, `src/features/shell/{OperationalShell,OperationalShell.test,ContextPanel}.tsx`, the compatibility edits in `src/features/fleet/{FilterRail,FilterRail.test}.tsx` and `src/features/map/FleetMap.tsx`, `src/styles.css`, this progress file, and task checkboxes 1.1–1.3. No domain, repository, WebMCP, route geometry, filter predicates/results, inspection internals, evidence images, or later-unit work is removed. |

### Exact Unit 1 Rollback Files and Adapter Rationale

Reverting implementation commit `5c0a74b6294852c3389ce0b3a4b3684a642622bd` removes exactly these files from the Unit 1 candidate diff:

- `index.html`
- `openspec/changes/phase-1-1-operational-console-redesign/apply-progress.md`
- `openspec/changes/phase-1-1-operational-console-redesign/tasks.md`
- `src/app/state/useUiCoordinationStore.test.ts`
- `src/app/state/useUiCoordinationStore.ts`
- `src/features/fleet/FilterRail.test.tsx`
- `src/features/fleet/FilterRail.tsx`
- `src/features/map/FleetMap.tsx`
- `src/features/shell/ContextPanel.tsx`
- `src/features/shell/OperationalShell.test.tsx`
- `src/features/shell/OperationalShell.tsx`
- `src/styles.css`

`FilterRail.tsx` and `FilterRail.test.tsx` are compatibility adapters required to consume the new immutable `activeFilters` and `railState` APIs without implementing Unit 2 predicates or results. `FleetMap.tsx` is a compatibility adapter that reads the new selection/filter state while deliberately deferring map-focus consumption and OR map behavior to later units. No separate `Topbar.tsx` change was required: Unit 1 topbar composition behavior is established by `OperationalShell.tsx`, while the existing `Topbar.tsx` already contains only SupplyMesh, language, Help, and Account; its dark chrome and interaction treatment resides in `src/styles.css`.

## Scope and Compatibility Guard

- `App -> OperationsApi -> ScenarioRepository` remains unchanged; the UI store contains transient coordination only.
- `src/platform/webmcp/**`, domain operations, scenario fixtures/geometry, route behavior, filter predicates/results, inspection internals, evidence screenshots, and Phase 2 capabilities have no Unit 1 diff.
- The existing filter rail, map, and inspection are only adapted to consume the new state and fit the shell framework. OR predicates/results remain Unit 2; focus consumption and route/map redesign remain Unit 3.
- The orchestrator-owned native runtime attempt was not acquired, reset, or settled. Receipt-driven review is off and no review was started.

## Work Unit 2 — OR Result Panels

- [x] 2.1 Pure seven-category predicates, derived counts, All fallback, independent OR toggles, deduplication, exact priority, matching risk reasons/severity, overview, results, cards, rail counts/tooltips, and removable chips.
- [x] 2.2 ContextPanel overview/results/inspection priority with close focus restoration and deleted-card fallback to the restored results heading.
- [x] 2.3 One coherent Unit 2 implementation commit boundary with managed desktop runtime proof; final PNG evidence remains Unit 5.

### Unit 2 Implementation Attempt and Evidence Binding

- Immediate predecessor/base: `9f1a7a5278dd6d880b34827d0bd27fafece5118a` (`feat/phase1-1-shell-coordination`).
- Implementation commit: `2513c7044ccd246a0601ffe7b4e59666cdc91da7`; implementation tree: `dea0d735410120d957a02cee3aa60926e16014f2`.
- Implementation diff revision: `sha256:29b832f41757a59d49a779add2860fd5e89593206255a55d7a948ad33ebce668`; implementation evidence revision: `sha256:f61725d19c5847a62be058cf3aceef07bfc2c6d779c11c61087c2c2b3bb26216`.
- Native implementation-attempt charge for candidate `2513c704...`: **396 additions + 28 deletions = 424 changed lines**, below 800.
- Evidence-only binding commit: `604c6c842bf568a324b4d9b0986a27a83991857c` (**3 additions + 3 deletions**); final tree through that binding: `af8d3b6e164cd5aba40e31f9686ccc1f9e4c3cf0`.
- Final attempt evidence through binding: `sha256:86882407a662d2c7f7b08b08245a52de4806619eb8bd5cca6c41d5f1c96db872`.
- Human-authored review total through `604c6c842...`: **399 additions + 31 deletions = 430 changed lines**, below 800.
- The 424-line native attempt charge and 430-line human review total are distinct scopes and MUST NOT be used interchangeably.
- Chain: `feat/phase1-1-filter-panels` targets immediate predecessor `feat/phase1-1-shell-coordination`; tracker remains `feat/phase1-1-operational-console-redesign` for issue #15.

### Unit 2 RED/GREEN Evidence

| Stage | Exact result |
|---|---|
| RED | `bun run test -- src/features/fleet/filtering.test.ts src/features/fleet/OperationalOverview.test.tsx src/features/fleet/FilterResults.test.tsx src/features/fleet/FilterRail.test.tsx src/features/shell/OperationalShell.test.tsx` → exit 1; 5 files failed, 5 tests failed, 6 passed. Missing selectors/components, accessible rail counts, overview/results composition, and result selection/restoration were observed. |
| GREEN | Same command → exit 0; 5 files passed, 15 tests passed. |
| Direct test typecheck | `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --moduleResolution bundler --module esnext --target esnext --types vitest/globals,node src/features/fleet/filtering.test.ts src/features/fleet/OperationalOverview.test.tsx src/features/fleet/FilterResults.test.tsx src/features/fleet/FilterRail.test.tsx src/features/shell/OperationalShell.test.tsx` → exit 0; no diagnostics. |

### Unit 2 Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command | Unit 2 GREEN command above → exit 0; 5 files, 15 tests. |
| Relevant Unit 1 regression | `bun run test -- src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx src/features/fleet/FilterRail.test.tsx src/features/fleet/filtering.test.ts src/features/fleet/OperationalOverview.test.tsx src/features/fleet/FilterResults.test.tsx src/features/map/FleetMap.test.ts src/features/fleet/VehicleDrawer.test.tsx src/preferences/i18n/catalog.test.ts` → exit 0; 9 files, 32 tests. |
| Full quality | `bun run check` → exit 0; ESLint and `tsc -b` clean, 13 Vitest files and 47 tests passed, Vite transformed 4,701 modules and built successfully. Existing >500 kB chunk advisory remained non-blocking. |
| Runtime harness | Managed Vite with `VITE_WEBMCP_LOCAL_BYPASS=true` at `127.0.0.1:4173`; Chromium 1440×900 → PASS. Overview and All=15 were present; Weather produced 3 cards; Weather OR Critical produced 5 unique cards in exact priority; two removable chips rendered; result selection opened inspection and close restored card focus; seven compact controls exposed described counts and tooltip; expanded rail was 232px, panel 388.797px; prohibited chrome and console errors were zero; no PNG was created. Server stopped and port 4173 was free. |
| Tablet correction harness | Managed Vite with the same bypass at `127.0.0.1:4173`; Chromium 900×900 → PASS. Weather produced 3 results; selecting `result-vehicle-004` opened the tablet inspection dialog; close restored Weather results and focus to that card. A storage-isolated deletion flow restored Weather context and focus to `context-panel-heading`; local storage was cleared before each flow and after deletion, reload restored fixture vehicle-004, screenshots and console errors were zero, processes stopped, and port 4173 was free. |
| Threat matrix | N/A per design; no routing, shell-command, subprocess, VCS automation, executable-classification, or process-integration application boundary changed. |
| Attempt settlement | Native Unit 2 attempt was already acquired by the orchestrator. Per explicit governance, this executor did not acquire, reset, or settle it. |
| Rollback boundary | Revert the Unit 2 files listed below. This removes selectors/results/overview/rail presentation, ContextPanel restoration, typed panel copy, tests, CSS, and the minimal OR map-consumption adapter without removing Unit 1 shell/store behavior or touching domain, repository, fixtures/geometry, WebMCP, inspection internals, final evidence, or Phase 2. |

### Exact Unit 2 Rollback Files (`9f1a7a5..604c6c8`)

- `openspec/changes/phase-1-1-operational-console-redesign/apply-progress.md`
- `openspec/changes/phase-1-1-operational-console-redesign/tasks.md`
- `src/features/fleet/FilterRail.test.tsx`
- `src/features/fleet/FilterRail.tsx`
- `src/features/fleet/FilterResults.test.tsx`
- `src/features/fleet/FilterResults.tsx`
- `src/features/fleet/OperationalOverview.test.tsx`
- `src/features/fleet/OperationalOverview.tsx`
- `src/features/fleet/VehicleResultCard.tsx`
- `src/features/fleet/filtering.test.ts`
- `src/features/fleet/filtering.ts`
- `src/features/map/FleetMap.tsx` (minimal multi-filter emphasis compatibility adapter only)
- `src/features/shell/ContextPanel.tsx`
- `src/features/shell/OperationalShell.test.tsx`
- `src/features/shell/OperationalShell.tsx`
- `src/preferences/i18n/catalog.ts` (typed Unit 2 panel/result copy only)
- `src/styles.css` (Unit 2 overview/results/chip/card rules only)

### Gatekeeper Correction Evidence

- Correction evidence revision: `sha256:5987e3494966661e1ceb682e0c7c72597ed52133e49e2bf6abe9b6c8d77f0738`.
- Cleanup: `managed tablet Vite/Chromium stopped; port 4173 free; localStorage reset before each flow and after deletion; fixture vehicle-004 restored after reload; screenshots created: 0`.
- Process: `correction changed only cumulative apply-progress; no production/test/task behavior changed; no acquire/reset/settle, push, PR, review, or merge ran`.
- Diagnosis: `gatekeeper findings reconciled: native implementation attempt charge is 424 lines, human review churn through evidence binding is 430 lines, immutable roles are explicit, tablet close/delete restoration passed, and rollback paths are exact`.

### Unit 2 Scope and Compatibility Guard

- `App -> OperationsApi -> ScenarioRepository` remains unchanged; all scenario mutation continues through `OperationsApi`.
- Exactly four WebMCP tools remain unchanged. No `src/platform/webmcp/**`, domain, repository, fixture geometry, inspection redesign, final screenshot, WebMCP, or Phase 2 file is in the Unit 2 diff.
- `FleetMap.tsx` only consumes the pure OR selector to preserve multi-filter marker/route emphasis compatibility. Unit 3 still owns route geometry, markers, layers, legend, focus/follow redesign, and its acceptance claims.
- The first managed harness run exposed an ambiguous Playwright locator shared by a map marker and result card. The harness was scoped to the result-card ID and passed without a production change.

## Work Unit 3A — Reviewed ORS Route Fixtures

- [x] 3A.1 Secret-safe atomic generator/verifier with radius, retry, canonical hash, no-op, malformed/surplus, and redaction coverage.
- [x] 3A.2 Reviewed 15-route ORS HGV manifest/GeoJSON plus key-safe generation and review documentation.
- [x] 3A.3 Offline catalog, route-progress-derived positions, exact snapped risk references, runtime/provider guards, and compatibility-only current map consumption.

### Unit 3A Candidate and Provenance

- Parent/amendment: `a4fbebb2e3fcab3ff0ecc3752a62c976ff9f6905`; child PR target remains Unit 2 `d834b2b598d0d1f50e690eecf1469556bef8d503`.
- Implementation commit/tree: `f7a69d356866eb5d0ec260451753590cc1e5e755` / `ed574a89a01993a8bceeda45d6481a474069005e`.
- Implementation diff revision: `sha256:d4d4dd238b30b4fb9d33e4ed92ebe31c8944978b690fc1e77e620dce9615a622`.
- Deterministic implementation evidence revision: `sha256:e74c91fa6d2abce36f29d5c4b4080f7953ffb3307255a648b920fa2e6cadf3d9`.
- Evidence binding commit/final tree: `37260336a08331e083c42ae1dd4987abb7c2fd93` / `68e625ebbb76ed26f25a9b59e5453fdbd2a07803`.
- Final review revision through the binding: `sha256:71b9ac3b6228692b4af84f21819b518fc7ca9681effcb77ad475cdba0cad587f`.
- Final evidence revision: `sha256:e74c91fa6d2abce36f29d5c4b4080f7953ffb3307255a648b920fa2e6cadf3d9`; binding changed documentation only, so the candidate evidence bytes remained authoritative.
- Native implementation scope (`a4fbebb..f7a69d3`): **373 additions + 20 deletions = 393 changed lines**, including the compact one-line reviewed GeoJSON and all source/tests/docs/OpenSpec changes; below 800.
- Human review scope through evidence binding (`a4fbebb..3726033`): **374 additions + 20 deletions = 394 changed lines**; below 800 and distinct from the native implementation charge.
- Generated fixture: 15 routes / 45,577 exact ORS coordinates; `generatedAt=2026-08-29T00:42:35.649Z`; manifest `sha256:8285a93bbdddacb5dd47452348a1f1c56d2b649f913248a81caaa33e05616cd3`; source `sha256:16e9952c577cfcc7de3e1cd8bfbc1ea068557c049d5674052b3b1e74fcacc439`.
- Route-014 preserved logical endpoints, passed exact `[547,350]`, and retained 2,002 returned coordinates; snaps were `546.8199476793687m` / `113.79408158125304m`; ORS summary was `228585.4m` / `12352.3s`.
- Failed evidence `sha256:8050c7d3b2336c93fe6bcbfb2e7bfb6e29520d97a8a7bed91267031a940a9d18` recorded route-014 HTTP 404 at the default 350m radius with zero fixture writes.
- Official ORS diagnostics established the origin snap radius, OpenSpec adopted the radius contract, and replacement generation preserved logical endpoints while passing exact `[547,350]`.
- Passing evidence `sha256:e74c91fa6d2abce36f29d5c4b4080f7953ffb3307255a648b920fa2e6cadf3d9` explicitly remediates that failed evidence revision.
- Old unpublished Unit 3 (`230a57a` / `c582707`) is abandoned, absent from this branch, and receives no delivery or task credit.

### Unit 3A Evidence

| Evidence | Exact result |
|---|---|
| RED / GREEN | Generator RED: exit 1, 1 suite failed, 0 tests (missing module). GREEN: 1 file, 15 tests passed. Direct generator/scenario test typechecks exited 0. |
| Real generation | `bun --no-env-file run routes:generate` exited 0 once: 15 routes, 45,577 coordinates, source revision above; key remained process-only/redacted. |
| Verify and focused tests | `bun --no-env-file run routes:verify` exited 0 with 15 routes/45,577 coordinates/runtime boundary clean. `bun run test -- scripts/generate-ors-routes.test.ts src/scenario` exited 0: 4 files, 27 tests. |
| Unit 1/2 regression | Nine shell/filter/map/inspection/catalog files exited 0: 9 files, 32 tests. |
| Full quality | `bun run check` exited 0: lint/typecheck clean, 15 files/66 tests passed, 4,711 modules built; existing chunk-size advisory only. |
| Offline runtime | With `ORS_API_KEY` unset: 15 markers, 34 current-map paths, 0 routing requests, 0 unexpected errors; one known asset 404; port 4173 freed. No Unit 3B visual acceptance claimed. |
| Settlement | `native_attempt=already-acquired`; `acquire=NOT_RUN`; `reset=NOT_RUN`; `settle=NOT_RUN`. |
| Rollback | Revert `37260336a08331e083c42ae1dd4987abb7c2fd93`, then `f7a69d356866eb5d0ec260451753590cc1e5e755`; remove exactly the files listed below. Units 1/2, 3B–5, WebMCP, Phase 2, tracker, and main remain intact. |

### Exact Unit 3A Rollback Files (`a4fbebb..3726033`)

- `docs/route-fixtures.md`
- `openspec/changes/phase-1-1-operational-console-redesign/apply-progress.md`
- `openspec/changes/phase-1-1-operational-console-redesign/tasks.md`
- `package.json`
- `scripts/generate-ors-routes.test.ts`
- `scripts/generate-ors-routes.ts`
- `scripts/routes/generator.ts`
- `src/domain/entities.ts`
- `src/scenario/fixtures/ors-route-manifest.json`
- `src/scenario/fixtures/ors-routes.geojson`
- `src/scenario/fixtures/routeCatalog.ts`
- `src/scenario/fixtures/spain-v1.test.ts`
- `src/scenario/fixtures/spain-v1.ts`
- `src/scenario/routeRuntime.test.ts`
- `src/scenario/routeRuntime.ts`

### Unit 3A Gatekeeper Correction

- Correction parent: `37260336a08331e083c42ae1dd4987abb7c2fd93`; only the already-reconciled design and this cumulative progress artifact change.
- Correction evidence revision: `sha256:25f0f80f204d2589517f4ca3c9962a554997ce22d3752e4a0bd0a1c344edfc8d`.
- Product, generator, tests, generated fixture, task checkboxes, Unit 3B+, WebMCP, and Phase 2 bytes remain unchanged.
- Settlement: `native_correction_attempt=already-acquired`; `acquire=NOT_RUN`; `reset=NOT_RUN`; `settle=NOT_RUN`.

## Work Unit 3B — Fixture-Only Visual Map

- [x] 3B.1 Fixture-only route/layer state, 15 separate truck and label controls, status pins, full unsimplified ORS corridors, selected/risk styling, markers, weather zone, and compact accessible legend.
- [x] 3B.2 Moderate route focus, `focusRoute` request consumption, useful Spain fit, resize invalidation, and manual-versus-programmatic follow coordination with desktop and 900×900 diagnostics.
- [x] 3B.3 One coherent Unit 3B commit boundary targeting Unit 3A; Unit 5 remains the only final screenshot and comparison boundary.

### Unit 3B Candidate and Immutable Evidence

- Immediate predecessor/base: `0fcf574be250f744661b52288cf1d88a26c4647b` on `feat/phase1-1-ors-route-fixtures`; child branch: `feat/phase1-1-visual-map`.
- Source/test/style diff revision before SDD bookkeeping: `sha256:04bf2f89963dde8a15e085d4f978cc2eb29b91e4c152dcfb8a56d0f8932f5b41`.
- Deterministic evidence revision: `sha256:53eee73fb2f83fbbdab066c7ed8ec79295f9e5b0464f011cc409e73b4c9dfa26`.
- Authored review size: **381 additions + 110 deletions = 491 changed lines**, below the hard 800-line Unit 3B limit.
- Accepted route geometry is consumed only through the existing scenario/catalog/runtime chain. No generator, manifest, GeoJSON, route catalog/runtime, provider, key, WebMCP, inspection/i18n, final evidence, or Phase 2 file changed.
- The existing typed `focusRoute(vehicleId)` Unit 4 hook is now consumed by `MapFocus`; no inspection component or copy changed.

### Unit 3B RED/GREEN and Work Unit Evidence

| Evidence | Exact result |
|---|---|
| RED | `env -u ORS_API_KEY bun run test -- src/features/map` → exit 1; 4 files failed, 10 tests failed. Missing `VehicleMarkerLayer`/`MapLegend`, route/state derivation, dependency guard, and programmatic/manual coordinator APIs were observed. |
| GREEN / focused | Same command → exit 0; 4 files, 12 tests passed. Marker/label activation, status pins, fallback identity, OR match/mute/selected states, z-order, exact route-coordinate identity, legend semantics, dependency allowlist, and coordinator transitions passed. |
| Test/type safety | `env -u ORS_API_KEY bun run typecheck` → exit 0; `tsc -b` emitted no diagnostics, including all Unit 3B test files. |
| Unit 1–3A regression | `env -u ORS_API_KEY bun run test -- src/app/state/useUiCoordinationStore.test.ts src/features/shell/OperationalShell.test.tsx src/features/fleet scripts/generate-ors-routes.test.ts src/scenario` → exit 0; 11 files, 54 tests passed. |
| Fixture verification | `env -u ORS_API_KEY bun --no-env-file run routes:verify` → exit 0; 15 ORS routes, 45,577 coordinates, source revision `16e9952c577cfcc7de3e1cd8bfbc1ea068557c049d5674052b3b1e74fcacc439`, runtime provider boundary clean. |
| Full quality | `env -u ORS_API_KEY bun run check` → exit 0; ESLint and `tsc -b` clean, 18 Vitest files and 75 tests passed, Vite transformed 4,713 modules and built successfully. Existing >500 kB chunk advisory remained non-blocking. |
| Runtime harness | Managed Vite with `VITE_WEBMCP_LOCAL_BYPASS=true`, key unset, at `127.0.0.1:4173`; temporary Playwright diagnostics only. Chromium 1440×900: map `987.203125×844`, 15 trucks, 15 separate labels, 15 full non-straight route paths (each rendered path >300 characters with `smoothFactor=0`), 19 risks, visible OSM attribution/legend, closure/weather/restriction/rest encodings, Weather 3 matched/12 muted, one selected blue route and selected high-severity weather path, result-card and keyboard-reachable label selection, programmatic focus/layout follow preservation, zoom-control cancellation, and restore action all passed. At 900×900, map `844×844`, 15 trucks and legend remained usable. Provider requests, console errors, page errors, and PNGs were all zero. |
| Guards | Protected generator/manifest/GeoJSON/catalog/runtime/docs/package diff was empty; secret/provider scan and PNG diff were empty; fixture verification remained byte-clean. The temporary runtime script was deleted. |
| Threat matrix | N/A per design; Unit 3B adds no executable classification, subprocess, VCS, provider, key, or network boundary. |
| Settlement | `native_attempt=already-acquired`; `acquire=NOT_RUN`; `reset=NOT_RUN`; `settle=NOT_RUN`. No push, PR, merge, review, main modification, or native-attempt lifecycle command ran. |
| Rollback boundary | Revert the one Unit 3B implementation commit. This removes only the map source/tests/style and 3B SDD updates listed below, restoring the Unit 3A visual adapter without removing accepted fixtures, Unit 1/2 behavior, or later units. |

### Exact Unit 3B Rollback Files

- `openspec/changes/phase-1-1-operational-console-redesign/apply-progress.md`
- `openspec/changes/phase-1-1-operational-console-redesign/tasks.md`
- `src/features/map/FleetMap.test.ts`
- `src/features/map/FleetMap.tsx`
- `src/features/map/MapEventCoordinator.test.ts`
- `src/features/map/MapEventCoordinator.ts`
- `src/features/map/MapLegend.test.tsx`
- `src/features/map/MapLegend.tsx`
- `src/features/map/VehicleMarkerLayer.test.tsx`
- `src/features/map/VehicleMarkerLayer.tsx`
- `src/features/map/layers.ts`
- `src/styles.css` (Unit 3B map-marker/risk/legend rules only)

### Unit 3B Gatekeeper Evidence Binding

- Immutable implementation identity: parent `0fcf574be250f744661b52288cf1d88a26c4647b`; implementation commit `408ff1effc055b0b48ac97f8e66efc80dd628446`; implementation tree `5e148cdc600cfc3da9eec37f06628b9b0d974bf4`.
- Cryptographic binding: implementation diff `sha256:e4ddc5e6978891b466323513927ad3006e60785bbae63ef5181084d090489efd`; implementation evidence `sha256:78ce5fa0f6991f9b85a837f52cc9b548fef0a49d557909cef4d9903fd3f0cad2`; **381 additions + 110 deletions = 491 changed lines**, below 800.
- Exact rollback is `git revert 408ff1effc055b0b48ac97f8e66efc80dd628446`. The exact `0fcf574..408ff1e` path set is the twelve-file list above; that list is bound to the implementation tree and diff revision on this section's preceding line.
- Deterministic correction evidence revision: `sha256:9b745e790d9b31ee4ff7f95000c10464aca493aee0db4a9c44c1d3ba038b8367`.

#### Managed Browser Diagnostics

- Commands: `env -u ORS_API_KEY VITE_WEBMCP_LOCAL_BYPASS=true bun run dev -- --host 127.0.0.1 --port 4173`; then `env -u ORS_API_KEY bun run /tmp/opencode/unit3b-correction-runtime.ts` using headless Chromium with `hasTouch: true`. The temporary harness was outside the repository and deleted after the passing run.
- Desktop initial OSM tile envelope was zoom 6, west/east `-16.875/11.25`, south/north `31.952162238024968/48.92249926375824`, span `28.125×16.970337025733272`, 20 tiles: useful Spain/Iberian context, not continental scale.
- One click on the keyboard-reachable `Unit 204` truck marker produced exactly one inspection and one selected route. Moderate completed focus was zoom 8, west/east `-2.8125/4.21875`, south/north `37.718590325588146/43.06888777416962`, span `7.03125×5.350297448581472`, 25 tiles. Closing and one click on its separate keyboard-reachable label independently produced the same single-selection/single-route result.
- Programmatic marker focus, label focus, and desktop rail/context invalidation preserved follow. The real desktop map width changed `987.203125 -> 819.203125 -> 987.203125` across expand/collapse without blank map state.
- A real two-contact CDP `touchStart -> touchMove -> touchEnd` pinch-style gesture in the touch-capable context cancelled follow; the existing `Follow Unit 204` action restored it.
- Computed tile-pane filter was exactly `saturate(0.28) contrast(0.86) brightness(1.08)` and visible attribution contained `OpenStreetMap`.
- At 900×900 the map began `844×844`. A real Weather rail/results transition changed rail overlay width `56 -> 232` while the context panel remained 336; subsequent route focus reloaded 5 cached tile elements (0 network requests required), left 5 current tiles, 15 markers, and the legend usable, with no blank/clipped state.
- Final diagnostics: 87 OSM tile requests across all desktop/touch/tablet flows; 0 console errors, 0 page errors, 0 screenshots/PNGs; temporary harness deleted; managed server stopped; port 4173 free.
- Correction scope: only this cumulative apply-progress artifact changed. Tasks remain 12/19; Unit 4 and Unit 5 remain pending. Production, tests, task checkboxes, Unit 3A protected files, product behavior, WebMCP, and Phase 2 are byte-identical.
- Settlement: `native_correction_attempt=already-acquired`; `acquire=NOT_RUN`; `reset=NOT_RUN`; `settle=NOT_RUN`. No push, PR, merge, review, or main modification ran.

## Remaining Tasks

- [ ] Unit 4 tasks 4.1–4.3: inspection redesign and localization.
- [ ] Unit 5 tasks 5.1–5.4: full regression, native WebMCP proof, screenshots, and release evidence.
