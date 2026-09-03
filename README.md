# SupplyMesh

SupplyMesh is a deterministic, map-first fleet operations console built with React 19, Leaflet, Three.js, and WebMCP. It lets a browser agent inspect structured operational state, compare safe actions, and execute only the exact actions a human has authorized, while every change remains visible on the same live map.

The submission focuses on a verified Spanish road network: 15 checked-in OpenRouteService routes, 45,577 route coordinates, deterministic risks, and no runtime dependency on external routing or weather APIs.

## Core flows

### Unit 211: safe recovery with human authority

Unit 211 is held before departure because its 3.80 m vehicle height plus a mandatory 0.20 m buffer exceeds a mapped 3.90 m clearance.

1. The agent reads the authoritative context and compares the current route with a verified alternative.
2. The agent stages the alternative and requests review.
3. Only the dispatcher can approve or reject the plan in the visible UI.
4. After approval, `recovery_plan_execute` appears dynamically for the agent.
5. The agent executes exactly the approved plan, verifies 15 independent checks, and retrieves an immutable receipt.

The route changes from `route-011` to `alternative-route-011-clearance-v1`. Execution is idempotent, revision-bound, and cannot accept agent-supplied safety facts.

### Unit 212: return delivery slack to the driver

SupplyMesh also demonstrates a driver-first rest opportunity planner. It never reduces or fragments mandatory rest. Instead, it looks for additional rest that fits inside existing delivery slack.

The deterministic Unit 212 scenario compares three on-route opportunities:

| Option | Extra rest | Contractual delay | Remaining margin | Result |
| --- | ---: | ---: | ---: | --- |
| Corridor rest point A | 40 min | 0 min | 7 min | Feasible |
| Corridor rest point B | 55 min | 10 min | 0 min | Recommended |
| Corridor rest point C | 70 min | 27 min | — | Rejected |

The agent receives only the read-only `rest_opportunities_compare` tool. A human schedules or clears the stop from the UI. The route geometry remains unchanged because the demo candidates lie on the verified route; the ETA, scheduled stop, persistence, and seven-check verification update visibly.

Additional rest is not claimed as a statutory break.

### Fleet editing

Humans can:

- place a vehicle by clicking the map;
- edit plate, label, vehicle dimensions, cargo, refrigeration, and priority;
- assign or release a verified route;
- delete a vehicle with confirmation.

The same domain operations are available to agents through typed WebMCP tools. Route ownership is synchronized through `Route.vehicleId`, persisted in browser `localStorage`, and reflected immediately by the highlighted map corridor. SupplyMesh never invents straight-line routes.

## WebMCP surface

SupplyMesh starts with **12 tools** in the IDLE state:

### Stable operational tools

1. `scenario_current`
2. `fleet_status`
3. `vehicle_get`
4. `vehicle_rename`
5. `fleet_vehicle_create`
6. `fleet_vehicle_update`
7. `fleet_vehicle_assign_route`
8. `fleet_vehicle_delete`
9. `rest_opportunities_compare`

### Initial recovery tools

10. `recovery_operations_context`
11. `recovery_options_compare`
12. `recovery_plan_stage`

Recovery capabilities are retired and introduced as the workflow advances. Depending on state, the surface exposes request-review, status, reset, execute, verify, or receipt retrieval. There is no WebMCP approval tool and no tool that reduces rest, changes the accepted delay tolerance, or overrides safety evidence.

All inputs use explicit JSON Schema contracts with `additionalProperties: false`, runtime validation, structured result envelopes, isolated `AbortSignal`s, and clean tool retirement on unload.

## Map and visual operations

### Zoom-driven 2D and 3D vehicles

- Below zoom 14, vehicles use compact 2D operational markers.
- At zoom 14 or above, visible vehicles render in one shared transparent Three.js canvas.
- The volumetric model includes cab, trailer, chassis, windows, lights, eight wheels, hubs, status colour, contact shadow, selection ring, and smoothed route bearing.
- Selection, close-range rendering, and camera following are separate concepts.
- Panning can cancel follow without removing 3D mode.
- Returning to 2D preserves the advanced route position.
- Systems without WebGL keep the 2D fallback.

### Physical and weather hazards

Close range includes:

- the authoritative red clearance bridge for Unit 211 at `[-3.897481, 40.149232]`;
- a road-closure barricade;
- a landslide/debris representation;
- localized heavy rain, snow, storm/wind, and calima.

Weather uses geographic risk bounds rather than fixed-pixel circles:

- overview: compact marker and subtle risk geometry;
- mid zoom: restrained geographic texture;
- close range: recognizable localized effects.

Effects remain visible but static under `prefers-reduced-motion`.

## Human-readable operations

- Every stationary vehicle exposes an explicit reason such as mandatory rest, no route assigned, road blocked, or pre-dispatch safety hold.
- Help is functional, bilingual, keyboard accessible, and includes a copyable demo prompt.
- Account chrome and unsupported country selectors are intentionally absent.
- The product supports Spain only; France and Germany were removed rather than shipping fictional road geometry.

## Capability gate

### Development

When `import.meta.env.DEV` is true and native WebMCP is unavailable, SupplyMesh opens in a clearly labelled simulation mode for browser and UI development. It does not claim native tool registration.

### Production

Production requires `document.modelContext`. A bypass-like build variable does not disable the gate. The native verification launches Chromium with `--enable-features=WebMCP` and exercises the registered tools directly.

## Verification

| Gate | Verified result |
| --- | --- |
| ESLint | 0 errors |
| TypeScript | `tsc -b` passes |
| Vitest | 38 files / 384 tests pass |
| Playwright | 31 end-to-end tests pass |
| Native WebMCP | 12 initial tools, strict schemas, signal isolation, cleanup `12→0`, zero browser errors |
| ORS route verifier | 15 routes / 45,577 coordinates |
| Clearance verifier | 1 alternative / 743 coordinates |

The build currently reports a non-blocking large-chunk warning. Three.js is dynamically imported only when close-range mode is activated.

## Commands

```sh
bun install --frozen-lockfile

# Local development
bun run dev

# Lint, typecheck, unit tests, and production build
bun run check

# Browser journeys and visual evidence
bun run test:e2e

# With the production preview running on 127.0.0.1:4173
bun run webmcp:verify-native

# Checked-in route evidence
bun run routes:verify
bun run routes:clearance:verify
```

## Important boundaries

- Spain / Iberian deterministic corridor only.
- Synthetic fleet, incident, rest-opportunity, and weather data.
- Verified offline road geometries; no runtime ORS call.
- No live traffic, live weather, accounts, authentication, backend, driver scoring, or driver surveillance.
- Rest candidates are a deterministic demo catalog, not live truck-stop discovery.
- Operational changes persist locally in browser storage.
- Human approval remains mandatory for the Unit 211 recovery plan.

## License

MIT
