# Tasks: Phase 1 Operational Console

## Review Workload Forecast

| Field | Value |
|---|---|
| Lines | 2,400–3,400; fixture/GeoJSON |
| Budget risk | High |
| Chained PRs | Yes |
| Split | 1 → 2 → 3 → 4 → 5 → 6 |
| Strategy | auto-chain |
| Chain | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Work Units

PRs target `main` and merge sequentially; successor reviews use merged `main`. No branches/PRs yet.

| Unit | Goal | Commit | PR | Test | Harness | Rollback |
|---|---|---|---|---|---|---|
| 1 | Toolchain/docs | `chore(foundation):init` | PR 1 | `bun run typecheck` | `bun run dev` boot | Root config/docs/MIT |
| 2 | Domain/fixtures/storage | `feat(domain):scenario` | PR 2 | `bun test src/scenario` | Offline fixture query | `src/domain/`, `src/scenario/` |
| 3 | Shell/map/rail | `feat(console):map` | PR 3 | `bun test src/features` | Desktop filter/select | Shell/map/rail |
| 4 | Drawer/i18n | `feat(inspection):drawer` | PR 4 | `bun test src/features/fleet` | Rename/reload/delete | Drawer/locale/overrides |
| 5 | WebMCP | `feat(webmcp):gate` | PR 5 | `bun test src/platform/webmcp` | Supported/blocked gate | `src/platform/webmcp/` |
| 6 | Acceptance/delivery | `test(acceptance):e2e` | PR 6 | `bun run check` | Playwright desktop/tablet | E2E/delivery metadata |

## Phase 1: Foundation

- [ ] 1.1 Initialize Git; add Bun/Vite React/TS/Tailwind, ESLint, Vitest/Playwright config, `package.json`, `bun.lock`, `.gitignore`, `.env.example`.
- [ ] 1.2 Add MIT `LICENSE`, `README.md`, `docs/{product-spec,ui-spec,architecture}.md`, scripts `lint/typecheck/test/build/check`; document boundaries, secrets, Bun/browser.

## Phase 2: Domain

- [ ] 2.1 RED: add `spain-v1.test.ts`: repeatability, 15 identities/positions, label fallback, required fields/statuses, offline data, exact 3.9m/26t/closure/snow/deadline risks.
- [ ] 2.2 GREEN: add `src/domain/{entities.ts,ports/ScenarioRepository.ts,operations/createOperationsApi.ts}` and `src/scenario/{fixtures/spain-v1.ts,geometry.ts,state/createZustandScenarioRepository.ts}`; shared query/rename/delete.
- [ ] 2.3 RED/GREEN: create `src/scenario/persistence/overrideStorage.ts`; test validation, fallback, locale isolation, rename, atomic vehicle-plus-route delete.

## Phase 3: Console/Map

- [ ] 3.1 Create `src/{main.tsx,app/{App.tsx,createApplication.ts},app/state/useUiCoordinationStore.ts,styles.css}`; isolate transient state; compose gate.
- [ ] 3.2 RED/GREEN: create `src/features/{shell/OperationalShell.tsx,shell/Topbar.tsx,fleet/FilterRail.tsx}`; test chrome, catalog completeness/fallback/locale, rail state, deferred drawer.
- [ ] 3.3 RED/GREEN: create `src/features/map/{FleetMap.tsx,layers/*,MapEventCoordinator.ts}`; test filter/clear, selection replacement/close, labels/OSM, manual/programmatic follow.

## Phase 4: Inspection

- [ ] 4.1 Create `src/preferences/i18n/{catalog,en,es,localeStorage}.ts` with complete English/Español copy and independent `locale:v1`.
- [ ] 4.2 RED/GREEN: create `src/features/fleet/VehicleDrawer.tsx` for complete inspection, localized fallback, shared rename, immediate marker refresh/reload.
- [ ] 4.3 RED/GREEN: create `src/features/fleet/DeleteVehicleDialog.tsx`; test named consequence, cancel no-op, atomic confirm/UI clear, and `Follow <label>`.

## Phase 5: WebMCP

- [ ] 5.1 RED: add `src/platform/webmcp/*.test.*`: exact four schemas/JSON envelope, UI/tool query/rename parity, diagnostics, cancellation, retry, unload.
- [ ] 5.2 GREEN: create `src/platform/webmcp/{webMcpTypes.ts,registerOperationalTools.ts,WebMcpGate.tsx}` with one controller, ready-only mount, accessible Retry gate.
- [ ] 5.3 Add `production-gate.spec.ts` RED/GREEN proving `import.meta.env.DEV && explicitFlag === "true"` only bypasses development; production remains blocked.

## Phase 6: Delivery

- [ ] 6.1 Add desktop/tablet `e2e/operational-console.spec.ts`: gate, drawer, filter/follow, rename/reload, locale, deletion, prohibited chrome.
- [ ] 6.2 Run `bun run lint && bun run typecheck && bun test && bun run build`; record fixture/GeoJSON size and clean `git status`.
- [ ] 6.3 Check tracked secrets; publish public MIT `supplymesh-webmcp` with `gh`, verify status, and push chain slices.
