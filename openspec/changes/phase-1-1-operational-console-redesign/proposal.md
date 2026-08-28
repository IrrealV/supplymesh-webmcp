# Proposal: Phase 1.1 Operational Console Redesign

## Intent and Problem

Repair Phase 1 as an operational product, not a cosmetic reskin. Composition and workflows fail approved operational hierarchy and clarity.

## Outcomes

- Deliver a professional three-column logistics console with dark SupplyMesh topbar/rail, balanced Spain map, and default, filtered-results, and selected-inspection right-panel modes.
- Provide an OR multi-filter rail with derived counts and deduplicated, priority-sorted contextual results.
- Show visible truck markers/labels, plausible deterministic multi-point road-corridor routes, clear risks, useful Spain viewport, one-click focus, and follow cancelled by manual navigation or replacement selection.
- Provide hierarchical localized inspection with humanized values while preserving view/follow, rename, and confirmed deletion.
- Preserve English/Spanish roundtrip, accessibility, reduced motion, and desktop/tablet behavior through real semantic components, never static images or canvas tricks.

## Scope

### In Scope
- Shell/UI-state, filtering, map/layer, fixture-geometry, inspection, i18n, accessibility, and responsive redesign.
- Deterministic offline scenario and acceptance evidence.

### Out of Scope
- Simulation, movement, random fleets, country selection, vehicle creation, Fleet Edit Mode, drag/drop, batch actions, dynamic production routing, live routing/weather/traffic providers, backend/database/auth, driver UI, chat, agent behavior/rerouting, new WebMCP tools, and every other Phase 2 capability.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `operational-shell-i18n`: three-panel composition, rail, locale, accessibility, and tablet behavior.
- `interactive-fleet-map`: OR emphasis, layers, focus, viewport, and follow transitions.
- `deterministic-fleet-scenario`: authored multi-point corridors and plausibly aligned risks.
- `vehicle-operations`: localized inspection hierarchy and humanized presentation.

## Approach and Constraints

Use a targeted presentation/UI-state redesign. Preserve React UI -> application/domain operations -> Zustand `ScenarioRepository`, with scenario and transient UI state separate. WebMCP uses the same operations with exactly `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`; names, schemas, responses, production gate, cleanup, and dev-only bypass remain unchanged.

Reference images govern composition/hierarchy beneath the written contract; they are neither pixel-perfect targets nor reusable assets. Missing `PRODUCT.md`/`DESIGN.md` is non-blocking because the approved brief is confirmed shape authority.

## Affected Areas

| Area | Impact |
|---|---|
| `src/features`, `src/styles.css`, UI store | Modified console behavior/presentation |
| `src/scenario/fixtures` | Modified deterministic geometry |
| `src/preferences/i18n` | Modified localized copy |
| `src/platform/webmcp` | Preservation regression surface |

## Acceptance and Governance

- Pass lint, typecheck, Vitest, Playwright, build, accessibility/responsive/motion, and native WebMCP validation.
- Capture desktop default/filters/inspection and tablet default/filters/inspection under `docs/evidence/phase1-1/`; critically compare all six against supplied references.
- Auto-chain work under 800 lines from issue #15 and baseline `d0856b8` on `feat/phase1-1-operational-console-redesign`; publish branch and PR for human visual review, never auto-merge.

## Risks and Rollback

Panel density may obscure map context; filter/selection/follow may conflict; tiles may fail. Mitigate with explicit modes, deterministic transitions, tests, and fixture-owned overlays. Roll back slices to baseline while retaining domain, repository, and WebMCP contracts.
