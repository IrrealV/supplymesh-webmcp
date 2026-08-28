# Design: Phase 1.1 Operational Console Redesign

## Technical Approach

Redesign presentation/transient coordination; preserve `App -> OperationsApi -> ScenarioRepository`. Scene: a logistics operator uses a desktop/tablet in a bright control room, so navy chrome anchors a light desaturated Spain map and bounded panel. Use 1px dividers, tabular data, semantic colors; no gradients, glass, glow, decorative AI, or new dependency.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Targeted redesign vs rewrite | Composition complexity vs contract risk | Preserve domain, API, WebMCP, and UI stack. |
| UI store vs scenario mutation | Explicit transitions | Store UI only; mutate through `OperationsApi`. |
| Authored vs runtime routes | Fixture maintenance vs determinism | Check in waypoints; validate with Turf. |
| Existing stack vs new package | Local code vs dependency growth | Stack meets requirements. |

## Visual, Layout, and Interaction Contract

Desktop (`>=1024px`) is `56px` topbar over `64px|232px rail + minmax(0,1fr) map + clamp(336px,27vw,400px) panel`; map stays largest. Topbar has only SupplyMesh, Radix Language (English/Español, no flags), Help, Account (36px); title includes SupplyMesh, never a timestamp. Activation expands the rail; Collapse preserves filters. Modes are Overview, OR Results, selection-priority Inspection. Body is fixed; rail/panel scroll with sticky heading/actions.

Tablet (`768–1023px`) uses `56px + 56px/map`; expanded rail and overview/results are non-modal edge drawers; Inspection is a trapped `min(560px,calc(100vw - 32px))` dialog. Radix restores focus; desktop close/delete restores its invoker. Order: skip-link, header/nav, filter aside, map/legend, context aside. Focus is 2px blue/2px offset. Opacity/transform transitions last 180ms; reduced motion removes them and map flight.

Tokens: chrome `#0B1726/#122338`, panel `#F3F6F7`, ink `#172534`, route `#2563A6`, resting `#4D7C64`, warning `#A66A18`, critical `#B43B3B`, weather `#607B96`. OSM keeps attribution and uses `saturate(.28) contrast(.86) brightness(1.08)`.

## State and Data Flow

`UiCoordinationState` contains immutable `activeFilters: ReadonlySet<FleetFilter>`, `panelContext: {mode:"overview"|"results";returnFocusId:string}`, discriminated `selection`/`follow`, `railState:"compact"|"expanded"`, and `mapFocusTarget:{kind:"none"}|{kind:"vehicle"|"route";vehicleId:string;requestId:number}`. Actions toggle/clear filters, set rail, select/close, cancel/restore follow, focus route, and acknowledge focus; selectors derive mode/matches. Selection preserves context; close/delete restores it.

Predicates map statuses directly; weather matches `severe-snow`, driving/rest `rest-deadline`, and road issues height/weight/closure. Counts reuse predicates. Results union IDs, deduplicate, then sort critical, needs-attention, any risk, driving, resting, fleet number. Overview cards set one filter; All clears all. Cards show identity fallback, route, localized status/ETA/delay, matching reasons, highest severity.

Map starts at `[[35.4,-9.7],[44.3,3.6]]`; states are `idle|programmatic-focus|programmatic-layout`. Selection/route focuses once at zoom 7–8 and enables follow; `invalidateSize` and programmatic moves preserve it. Drag, wheel, zoom-control, pinch, or keyboard cancel before movement; replacement starts new follow.

## Components and File Changes

| Files | Action | Responsibility |
|---|---|---|
| `src/app/state/useUiCoordinationStore.ts` | Modify | UI coordination. |
| `src/features/shell/{OperationalShell,Topbar,ContextPanel}.tsx`, `src/styles.css`, `index.html` | Modify/Create | Grid, modes, semantics, tokens. |
| `src/features/fleet/{FilterRail,filtering,OperationalOverview,FilterResults,VehicleResultCard,VehicleInspection,formatters}.ts*` | Modify/Create/Rename | Filtering, cards, inspection. |
| `src/features/map/{FleetMap,layers,MapEventCoordinator,VehicleMarkerLayer,MapLegend}.ts*` | Modify/Create | Viewport, layers, legend. |
| `src/scenario/geometry.ts`, `src/scenario/fixtures/{spain-v1,spain-route-waypoints}.ts` | Modify/Create | Corridors/guards. |
| `src/preferences/i18n/{catalog,en,es}.ts`, tests, `e2e/*` | Modify | Copy/acceptance. |

`ContextPanel` switches modes; Overview owns cards; Results owns chips/list. Inspection sections: Identity, Route/status, Cargo/specification, Timing, Risks. Locale-aware `Intl` formatters humanize values/fallbacks. Save is disabled when unchanged/invalid, reports localized `status`/`alert`, then refreshes through `OperationsApi`; View on route, Follow, and secondary confirmed Delete remain visible.

`VehicleMarkerLayer` creates separate Leaflet truck/label DOM markers with Phosphor SVG, keyboard semantics, status pin, and one-click selection. Selected/matched/normal/muted opacity is `1/1/.78/.28`; z-index is `1000/500/100/0`. Selected corridor is 4px blue, secondary routes 2px slate, affected segments amber/red, closure red dashed, and weather translucent with border/icon/label. Risks associate through symmetric vehicle `riskIds`/`affectedVehicleIds` and route waypoint subsequences. Validation rejects unknown/asymmetric links, out-of-Spain coordinates, endpoint mismatch, and two-point routes over 75km.

## Compatibility and Testing

Preserve `createOperationalTools`, `WebMcpGate`, `webMcpTypes`, and API contracts: `scenario_current`, `fleet_status`, `vehicle_get`, `vehicle_rename`; queries accept only `{}`; get requires only `vehicleId:string(minLength:1)`; rename only `vehicleId,label:string(minLength:1)`; all deny extras. Preserve one `JSON.stringify(DomainResult)` text item, shared outcomes, registration-before-render, AbortController cleanup, production gate, and development-only `VITE_WEBMCP_LOCAL_BYPASS`.

Trace all 47 scenarios: 16 shell/i18n via store/component/a11y/locale E2E; 13 map via predicates/layers/coordinator and pointer/touch E2E; 8 fixture via corridor/association guards; 10 inspection via formatter/component/persistence. Native Chromium `--enable-features=WebMCP` runs without seam/bypass, restores renamed data, aborts registration, stops processes, and proves port cleanup.

Playwright captures four `1440x900` desktop states (overview; expanded Weather affected; selected route/risk; two filters) and two `900x900` tablet states (results; detail), after fonts/tiles settle, with animations disabled. Store PNGs/notes in `docs/evidence/phase1-1/`. Rubric: proportions, state, map legibility, overflow/focus/localization, forbidden decoration; any critical miss blocks review.

## Delivery, Threat Matrix, and Rollback

Work units/commits: shell+store; filters+panels; fixtures+map; inspection+i18n; regressions+evidence. Each stays below 800 authored lines, passes tests, and is revertible; record commands, coverage, screenshots, native receipt, cleanup. Publish issue #15’s branch for review; never auto-merge.

Threat Matrix: N/A — no application-routing, command-shell, subprocess, VCS/PR automation, executable classification, or process-integration boundary changes.

No migration: retain `scenario-overrides:v1`/`locale:v1`; transient state resets. Roll back commits to `d0856b8`. Exclude Phase 2 simulation/movement/random-fleet/country-selection/vehicle-creation/Fleet-Edit-Mode/drag-drop/batch-actions/dynamic-or-live-routing-weather-traffic/backend-database-auth/driver-UI/chat/agent-behavior/rerouting/tools.

## Open Questions

None.
