# SupplyMesh

SupplyMesh is a deterministic, map-first fleet operations console built with React 19, Leaflet, and the W3C/OpenAI WebMCP standard. It combines client-side authoritative fleet coordination, recovery planning, 3D close-range inspection, and native browser tool execution.

---

## Core Capabilities

### 1. Authoritative Recovery Workflow
- **Pre-Dispatch Context**: Detects vertical clearance violations (e.g. Unit 211 / FM-211 clearance incident: 3.90 m restriction vs 4.00 m required clearance).
- **Alternative Route Comparison**: Deterministic geometric and temporal evaluation between the current blocked corridor and the clearance alternative.
- **Exclusively Human Approval**: Plan approval is strictly reserved for human operators. Automated agents can inspect context, compare alternatives, and stage candidate plans (`recovery_plan_stage`). Only after explicit human approval does `recovery_plan_execute` appear on the tool surface so the agent can execute exactly the authorized plan. Agent-asserted execution facts or unapproved plan executions are rejected.
- **Audited Execution & Receipt Lineage**: Cryptographic digest checks, singleton route-vehicle bindings, and CAS revision verification emit an immutable receipt upon successful recovery.

### 2. Fleet Edit & Operational Tools
- **WebMCP Tool Surface (8 Stable Operational Tools + Dynamic Recovery Surface)**:
  - **Operational Tools (8 stable)**: `scenario_current`, `fleet_status`, `vehicle_get`, `vehicle_rename`, `fleet_vehicle_create`, `fleet_vehicle_update`, `fleet_vehicle_assign_route`, `fleet_vehicle_delete`.
  - **Recovery Tools (dynamic lifecycle, 3 in IDLE = 11 initial tools)**: `recovery_operations_context`, `recovery_options_compare`, `recovery_plan_stage`. After human approval of a staged plan, `recovery_plan_execute` is dynamically exposed for the agent to execute strictly the authorized plan.
- **Strict Domain Validation**: Full runtime validation for `cargo` (`description`, `refrigeration` enum, `priority` enum) and `dimensions` (`vehicleType`, finite positive `lengthMeters`, `heightMeters`, `weightTonnes`), with `additionalProperties: false`.
- **Deterministic Time & Geometry**: Avoids `Date.now()`; derives timing from the scenario clock (`2026-08-28T09:00:00.000Z`). Destination position defaults to the route's terminal coordinate.
- **Route Ownership Persistence**: Reassigning or unassigning a route synchronizes `Route.vehicleId` across the scenario and persists in browser `localStorage`. Selecting any newly created or reassigned vehicle immediately highlights its active corridor.

### 3. Close Range Operational Mode
- **Zoom-Driven 2D/3D Transition**: At overview zoom levels (`zoom < 14`), vehicles render as high-contrast 2D pins. At close range (`zoom >= 14`), vehicles transition into 3D volumetric truck models with accurate heading bearing along the route tangent.
- **Follow Camera Decoupling**: Selection focuses and tracks the vehicle, but user map interaction (drag, pan, zoom) gracefully pauses camera follow without dropping 3D rendering.
- **Physical Hazards in 3D**:
  - **Authoritative Red Bridge Hazard**: Rendered at coordinate `[-3.897481, 40.149232]` on `route-011`, displaying clearance comparison (`4.00 m required · 3.90 m available`).
  - **Road Closure**: Striped barricade visual on blocked segments (AP-68).
  - **Landslide**: Lightweight rock/debris scatter in mountain corridors.

### 4. Localized Weather Hazards
- Procedural weather visual effects localized and centered within geographical risk zones (never covering the whole viewport, and hidden at `zoom < 8`), rather than strictly hard-clipped to the polygon geometry:
  - **Heavy Rain**: Galicia corridor.
  - **Severe Snow**: León mountain pass.
  - **Severe Wind & Storm**: Valle del Ebro corridor.
  - **Calima / Dust Haze**: Andalusian corridor.
- Deterministic synthetic demo data with zero live external meteorological dependencies.
- Full `prefers-reduced-motion` compliance.

### 5. DEV Mode vs. Production Capability Gate
- **DEV Mode (`import.meta.env.DEV`)**: When running in development without a WebMCP-enabled browser, SupplyMesh enters simulation mode with a warning banner, registering tools to `window.__recoveryTools` for local evaluation in any standard browser.
- **Production Gate (`import.meta.env.PROD`)**: Production builds strictly enforce the WebMCP capability gate (`document.modelContext`). Unauthenticated or non-WebMCP environments are blocked.

---

## Verification & Test Metrics

SupplyMesh enforces strict verification gates across all tiers:

| Suite | Scope | Status |
| :--- | :--- | :--- |
| **ESLint** | Source & test linting | **0 errors, 0 warnings** |
| **TypeScript** | Strict compiler typecheck (`tsc -b`) | **0 errors** |
| **Vitest** | Unit & domain capabilities | **35 / 35 test files passed (366 / 366 tests)** |
| **Playwright** | End-to-end user workflows | **19 / 19 passed** |
| **WebMCP Native** | Real browser tool execution | **11 registered tools, clean 11→0 unload, signal isolation verified** |
| **Route Verifier** | Offline ORS routes | **15 routes verified (45,577 coordinates, revision `16e9952c...`)** |
| **Clearance Verifier**| Authoritative alternative route | **1 alternative verified (743 coordinates, revision `688161cb...`)** |

---

## Commands

```sh
# Install dependencies
bun install

# Start development server
bun run dev

# Run quality checks (lint + typecheck + vitest + build)
bun run check

# Run end-to-end browser tests
bun run test:e2e

# Run genuine native WebMCP verification (requires preview server on port 4173)
bun run webmcp:verify-native

# Verify offline route catalogs
bun run routes:verify
bun run routes:clearance:verify

# Build production bundle
bun run build
```

---

## Limitations & Boundaries

- **Operating Region**: Focused strictly on the Iberian corridor (`spain-v1`). Fictional straight-line regional routes (France/Germany) have been eliminated to uphold operational data truth until real ORS road networks are computed.
- **Authoritative Recovery**: Automated agents can explore context, compare alternatives, and stage plans. Approval is exclusively human; once approved, `recovery_plan_execute` is dynamically exposed for the agent to execute strictly the authorized plan.
- **Persistence**: Operational state changes are persisted locally in browser `localStorage`.
- **WebMCP Native Support**: Requires a browser supporting the WebMCP specification (e.g. Chromium with `--enable-features=WebMCP`), or the DEV simulation mode during local development.

---

## License

MIT
