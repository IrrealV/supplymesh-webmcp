# Apply Progress: Phase 1.1 Operational Console Redesign

## State

- Mode: Standard; `strict_tdd: false` in `openspec/config.yaml`.
- Delivery: `auto-chain`, `feature-branch-chain`.
- Current boundary: Unit 2 `feat(console): add OR result panels` on `feat/phase1-1-filter-panels`, targeting predecessor `feat/phase1-1-shell-coordination` at `9f1a7a5`.
- Completed tasks: 1.1–2.3 (6/16). Units 3–5 remain pending.
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

## Remaining Tasks

- [ ] Unit 3 tasks 3.1–3.3: deterministic route geometry and map behavior.
- [ ] Unit 4 tasks 4.1–4.3: inspection redesign and localization.
- [ ] Unit 5 tasks 5.1–5.4: full regression, native WebMCP proof, screenshots, and release evidence.
