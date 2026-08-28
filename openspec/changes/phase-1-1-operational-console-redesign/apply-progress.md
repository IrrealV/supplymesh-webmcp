# Apply Progress: Phase 1.1 Operational Console Redesign

## State

- Mode: Standard; `strict_tdd: false` in `openspec/config.yaml`.
- Delivery: `auto-chain`, `feature-branch-chain`.
- Current boundary: Unit 1 `feat(console): coordinate shell` on `feat/phase1-1-shell-coordination`, targeting tracker `feat/phase1-1-operational-console-redesign`.
- Completed tasks: 1.1–1.3 (3/16). Units 2–5 remain pending.
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

## Remaining Tasks

- [ ] Unit 2 tasks 2.1–2.3: OR predicates, derived counts/results, overview/results components.
- [ ] Unit 3 tasks 3.1–3.3: deterministic route geometry and map behavior.
- [ ] Unit 4 tasks 4.1–4.3: inspection redesign and localization.
- [ ] Unit 5 tasks 5.1–5.4: full regression, native WebMCP proof, screenshots, and release evidence.
