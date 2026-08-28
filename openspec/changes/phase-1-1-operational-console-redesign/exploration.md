## Exploration: phase-1-1-operational-console-redesign

### Current State
Phase 1 is clean at baseline `d0856b8`. The console is a React/Vite application gated by WebMCP, with `App -> OperationsApi -> Zustand ScenarioRepository` for domain data and a separate Zustand UI coordination store for selection, one active filter, rail expansion, drawer visibility, and follow. The four tools (`scenario_current`, `fleet_status`, `vehicle_get`, `vehicle_rename`) already delegate to that same API.

The desktop is a 48px light topbar, 52px expandable left rail, Leaflet/OSM map, and a fixed 360px inspection drawer only after selection. Tablet converts the inspection drawer to a 560px dialog. There is no contextual right-panel mode before selection, no multi-filter model, and routes are single origin-to-destination straight lines. The deterministic fixture has 15 Spanish vehicles, 15 routes, 19 risk layers, and a Spain bounds viewport; risks and all markers render, but the OSM base map is not desaturated and route/risk geometry does not yet read as operational road routing.

Runtime evidence on the current dev app: at 1440x900 it rendered 15 markers, 34 overlay paths, 28 base tiles, a 52px rail, and no drawer. Activating Critical expanded the rail to 224px and muted 12 markers. One marker click opened the 360px inspection drawer and manual map interaction exposed Follow. At 900x900 the selected inspection rendered as a centered 560x720 dialog. English-to-Español changed `lang` and persisted through reload. Current checks passed: ESLint, TypeScript, and 32/32 Vitest tests.

Impeccable context is incomplete: neither `PRODUCT.md` nor `DESIGN.md` exists, and the repository does not vend the requested Impeccable loader. The user-approved authoritative brief is sufficient as a confirmed shape brief for this scoped redesign, but the missing product/design context remains a non-blocking documentation gap.

### Affected Areas
- `src/styles.css` — replace the Phase 1 light, fixed-grid presentation with the approved dark operational composition, responsive panel behavior, focus states, and reduced-motion rules.
- `src/features/shell/OperationalShell.tsx`, `Topbar.tsx` — compose the contextual right-panel modes without widening application responsibilities.
- `src/app/state/useUiCoordinationStore.ts` — evolve exclusive `activeFilter` into UI-only multi-filter and panel-mode coordination; retain selection and follow as transient state.
- `src/features/fleet/FilterRail.tsx`, `filtering.ts` — provide OR semantics, expanded multi-filter affordances, counts, and clear/reset behavior.
- `src/features/map/FleetMap.tsx`, `layers.ts`, `MapEventCoordinator.ts` — improve marker hierarchy, selected/filter emphasis, route/risk rendering, Spain base-map treatment, focus, and manual-follow cancellation.
- `src/features/fleet/VehicleDrawer.tsx`, `DeleteVehicleDialog.tsx` — reorganize selected-vehicle inspection hierarchy and preserve existing rename, deletion, fallback, and follow actions.
- `src/scenario/fixtures/spain-v1.ts`, `geometry.ts` — replace straight-line corridors with deterministic, authored multi-vertex road-like geometry and place risks plausibly on those corridors; no runtime routing, weather, traffic, API, or secret is required.
- `src/preferences/i18n/{catalog,en,es}.ts`, `localeStorage.ts` — add all redesign copy to both catalogs and retain locale roundtrip isolation.
- `src/features/**/*.test.*`, `src/preferences/i18n/catalog.test.ts`, `e2e/*.spec.ts` — extend behavioral, accessibility, responsive, and visual verification coverage; current tests do not cover multi-filter OR combinations, all panel modes, reduced motion, desaturation, or six final screenshot states.
- `src/platform/webmcp/{WebMcpGate,registerOperationalTools,webMcpTypes}.ts` — preservation-only regression surface: tool names, schemas, gate semantics, and API delegation must remain unchanged.

### Approaches
1. **Targeted presentation and UI-coordination redesign** — Preserve domain entities, repository, operations, and four WebMCP tools. Add panel/filter presentation state, selectors, fixture geometry, and component/CSS redesign around them.
   - Pros: Preserves verified transport/domain boundaries; keeps Phase 2 capabilities out; smallest WebMCP risk; reviewable in focused units.
   - Cons: Requires careful component decomposition to avoid accumulating panel logic in `OperationalShell`.
   - Effort: High.

2. **Replace the console feature layer wholesale** — Rebuild shell, map, filtering, and drawer components while retaining only the API and fixtures.
   - Pros: Maximum visual freedom.
   - Cons: Duplicates already-valid behavior, increases accessibility and follow/WebMCP regression risk, and exceeds the review budget without material product benefit.
   - Effort: High.

### Recommendation
Use the targeted redesign. Introduce a UI-only `activeFilters` set or record with OR matching, explicit panel mode, and derived selectors; React continues to call `OperationsApi` for rename/delete and never accesses scenario store internals. Keep the fixture contract but author each route as a bounded polyline through credible Spanish corridor waypoints, with static route/risk data checked into source. Keep Leaflet and the Spain viewport, apply a CSS tile treatment and stronger overlay/marker hierarchy rather than a runtime map service.

Implement as auto-chained work units under the 800-line review budget: (1) design tokens, shell, and panel-mode state; (2) filter OR selectors, rail, contextual filter panel, and unit tests; (3) deterministic routes, risks, map layers, focus/follow, and map tests; (4) selected inspection hierarchy, i18n, tablet/accessibility/reduced-motion; (5) WebMCP parity regression plus Playwright workflows and six named screenshots: desktop default, desktop expanded filters, desktop selected inspection, tablet default, tablet filters, and tablet selected inspection. Split further if an authored fixture/visual-test diff exceeds the budget.

### Risks
- A rich right panel can obscure the map or overload tablet layouts; define explicit default, filters, and selected-inspection modes with deterministic transitions and keyboard focus behavior.
- OR filtering, selection, and follow must remain composable: selection takes visual priority, manual pan/zoom cancels follow, and programmatic focus must not.
- CSS-only map desaturation still depends on OSM tile availability; authored routes and risks remain deterministic, but offline base-map behavior is not currently guaranteed.
- Adding English copy without matching Spanish copy or inaccessible icon controls would regress the typed-catalog and accessibility contracts.
- The four WebMCP schemas, names, output envelope, production gate, and shared `OperationsApi` delegation are strict preservation boundaries.

### Ready for Proposal
Yes. The approved brief is sufficient to propose a scoped Phase 1.1 redesign. The proposal should explicitly record the three right-panel modes, OR multi-filter semantics, deterministic authored route geometry, six visual acceptance screenshots, and the non-goals: no Phase 2 tools, entities, simulation, live providers, backend, rerouting, or driver-facing behavior.
