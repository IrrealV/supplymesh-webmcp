# Design: Phase 1 Operational Console

## Technical Approach

Build one Bun/Vite React TypeScript app. React and WebMCP receive the same injected, branding-neutral API over deterministic fixtures and validated overrides.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Single root | Less isolation | One package; no Phase 1 package boundary exists. |
| Injected operations | More types | Zustand implements `ScenarioRepository`; one `OperationsApi` serves UI/tools and preserves a simulation seam. |
| Split state | Coordination | Persist domain overrides; isolate transient selection/filter/drawer/follow/rail. |
| UI primitives | Dependency constraints | Stable Tailwind/`@tailwindcss/vite`/`@import`; no PostCSS. Radix Tooltip/Dialog/AlertDialog/menu; Phosphor icons; no emoji. |
| Browser adapters | Extra seams | Isolate storage/Leaflet/current `document.modelContext.registerTool`; validate external `unknown`. |

## Data Flow

    fixtures + overrides -> Zustand repository -> OperationsApi -> React/WebMCP
    UI store -> selectors -> vehicle/route/risk layers

## Shell / Presentation Contract

Topbar is exactly: provisional product name; language control initially `EN`, offering English and Español without flags; Help; Account. No bottom chrome. Never render LIVE/WebMCP/agent/simulation/stage-plan decoration, gradients, glassmorphism, giant cards, sparkle icons, excessive rounding, decorative metrics, chat, or driver-surveillance framing.

Desktop (`>=1024px`) is rail/map/conditional-drawer; no drawer exists before selection. Tablet (`768–1023px`) stays map-dominant, starts compact, overlays expanded rail, and uses inspection `Dialog`. Smartphones are not optimized.

Rail categories are exactly all, resting, needs attention, critical, weather affected, driving/rest risk, and road/restriction issues. Compact rows show icon/count/localized-tooltip; expanded adds labels. Counts use unfiltered data. Selecting inactive expands/activates; selecting active clears but stays expanded; collapse compacts without clearing. Clear restores context.

English defaults; typed `en`/`es` catalogs cover all visible/fallback copy. `locale:v1` persists independently. No driver-facing interaction exists.

## Domain / Interaction Contracts

`spain-v1.ts` defines exactly 15 fixed plausible vehicles/positions; repeated loads are equal/network-free. Stable `internalId` differs from fleet-number/optional-label/plate; display is `label?.trim() || fleetNumber`. Each vehicle has controlled GeoJSON corridor/current-route/origin/destination, status, cargo/refrigeration/priority, type/dimensions/weight, drive/rest timing, ETA/delay, and risk. Statuses cover driving/resting/needs-attention/critical. Risks include exact 3.9 m height, 26 t weight, closure segment, discreet high-severity severe-snow polygon, and rest-deadline data. Random/live providers are forbidden.

`scenario-overrides:v1` validates `{version:1,labels,deletedVehicleIds}`; corrupt/obsolete data falls back without touching locale. Selectors highlight filtered/selected vehicle/label/route/risk. Selection opens/replaces inspection, smoothly focuses, and enables follow; close clears UI only. `MapEventCoordinator` tags programmatic focus until settled; pointer/wheel/keyboard navigation or replacement selection cancels follow; `Follow <label>` restores it. Keyboard-focusable `DivIcon` labels and OSM attribution remain visible.

Inspection shows identity/route/status/load/dimensions/timing/ETA/delay/risk-comparison with catalog fallbacks. Rename validates/writes before one update, refreshing drawer/marker immediately. Secondary delete `AlertDialog` names `label || fleetNumber` and vehicle-plus-current-route consequence. Cancel calls nothing. Confirm invokes `vehicleDelete`: resolve both IDs, validate/write override, then remove both in one Zustand update. Failure commits neither; success clears related UI.

Fleet Edit Mode and WebMCP `create_vehicle`/`assign_route` are future, unavailable Phase 2 capabilities; Phase 1 provides no UI/operation/tool for them. Delete remains domain/UI-only.

## WebMCP Contract

`DomainResult<T>` is `{ok:true;data:T}|{ok:false;error:{code:string;message:string}}`; each `{name,description,inputSchema,execute}` returns `{content:[{type:"text",text:JSON.stringify(result)}]}` without diagnostics.

| Tool | Exact input schema | `T` |
|---|---|---|
| `scenario_current` | `{type:"object",properties:{},additionalProperties:false}` | `OperatingRegion` |
| `fleet_status` | `{type:"object",properties:{},additionalProperties:false}` | `FleetStatus` |
| `vehicle_get` | `{type:"object",properties:{vehicleId:{type:"string",minLength:1}},required:["vehicleId"],additionalProperties:false}` | `Vehicle` |
| `vehicle_rename` | `{type:"object",properties:{vehicleId:{type:"string",minLength:1},label:{type:"string",minLength:1}},required:["vehicleId","label"],additionalProperties:false}` | updated `Vehicle` |

Gate state is `checking|registering|ready|unsupported|failed`; console mounts only when ready. One controller/attempt passes `{signal}` to every `document.modelContext.registerTool(tool, {signal})`; failure aborts all and shows only accessible explanation plus Retry. Retry aborts before re-registering; unload aborts the active controller. Bypass is exactly `import.meta.env.DEV && explicitFlag === "true"`; production stays gated.

## File Changes

All listed paths are planned **Create targets**; no application files exist.

| Paths | Purpose |
|---|---|
| `src/main.tsx`, `src/app/App.tsx`, `src/app/createApplication.ts`, `src/domain/entities.ts`, `src/domain/ports/ScenarioRepository.ts`, `src/domain/operations/createOperationsApi.ts`, `src/app/state/useUiCoordinationStore.ts` | Composition/API/state. |
| `src/scenario/fixtures/spain-v1.ts`, `src/scenario/geometry.ts`, `src/scenario/state/createZustandScenarioRepository.ts`, `src/scenario/persistence/overrideStorage.ts` | Fixtures/adapter/persistence. |
| `src/features/shell/OperationalShell.tsx`, `src/features/shell/Topbar.tsx`, `src/features/fleet/FilterRail.tsx`, `src/features/fleet/VehicleDrawer.tsx`, `src/features/fleet/DeleteVehicleDialog.tsx` | Shell/fleet components. |
| `src/features/map/FleetMap.tsx`, `src/features/map/layers/VehicleLayer.tsx`, `src/features/map/layers/RouteLayer.tsx`, `src/features/map/layers/RiskLayer.tsx`, `src/features/map/MapEventCoordinator.ts` | Map/layers/events. |
| `src/preferences/i18n/catalog.ts`, `src/preferences/i18n/en.ts`, `src/preferences/i18n/es.ts`, `src/preferences/i18n/localeStorage.ts`, `src/platform/webmcp/webMcpTypes.ts`, `src/platform/webmcp/registerOperationalTools.ts`, `src/platform/webmcp/WebMcpGate.tsx` | Catalogs/gate. |
| `src/scenario/fixtures/spain-v1.test.ts`, `src/scenario/state/createZustandScenarioRepository.test.ts`, `src/features/shell/OperationalShell.test.tsx`, `src/features/fleet/FilterRail.test.tsx`, `src/features/fleet/DeleteVehicleDialog.test.tsx`, `src/features/map/MapEventCoordinator.test.ts`, `src/platform/webmcp/registerOperationalTools.test.ts`, `src/platform/webmcp/WebMcpGate.test.tsx`, `e2e/operational-console.spec.ts`, `e2e/production-gate.spec.ts` | Tests. |
| `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `src/styles.css`, `README.md`, `LICENSE`, `.env.example`, `docs/product-spec.md`, `docs/ui-spec.md`, `docs/architecture.md` | Public-MIT/Bun/no-secrets toolchain/docs. |

## Testing Strategy

Vitest asserts fixture equality, 15 identities/positions, fallback, complete routes/statuses/fields, exact 3.9m/26t/closure/snow/deadline risks, catalogs, rail/shell/tablet, event origin, persistence, UI/API/tool parity, cancel/no-op and atomic deletion, schemas/lifecycle, and production bypass rejection. Playwright covers selection/drawer, filter/follow, rename/reload, locale, deletion, and blocking gate. Quality runs lint/typecheck/test/build.

## Threat Matrix

WebMCP triggered review; no listed execution boundary applies.

|Boundary|Minimum cases|Applicability|Response|RED tests|
|---|---|---|---|---|
|Documentation-like paths|requirements/CMake/MDX/README.sh|N/A: no classification/execution|—|—|
|Git repository selection|git-C/relative/absolute|N/A: no Git commands|—|—|
|Commit state|staged/commit-a/empty-index|N/A: no commit automation|—|—|
|Push state|tracking/first/refspec|N/A: no push automation|—|—|
|PR commands|head/env/composition|N/A: no PR composition|—|—|

## Migration / Rollout

No migration required. Rollback clears only `scenario-overrides:v1`; challenge-browser validation remains a release prerequisite.

## Open Questions

None blocking.
