# Architecture Contract

## Current status

Phase 1 is implemented, independently verified, and archived. It includes the Bun/Vite/React application, deterministic scenario, typed domain operations, UI coordination, map workspace, persistence adapters, and WebMCP compatibility bridge.

## Current boundaries

```text
fixtures + validated overrides -> Zustand scenario repository -> OperationsApi -> React
                                                                  -> WebMCP tools
transient UI coordination -> selectors -> map, rail, and inspection presentation
```

React components and WebMCP handlers call the same typed `OperationsApi`; neither transport mutates Zustand internals. The repository preserves a simulation-adapter seam without implementing a simulation engine. Browser-specific storage, Leaflet behavior, and `document.modelContext.registerTool` live behind narrow adapters.

The WebMCP gate mounts the console only after capability detection and registration of exactly `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`. Its local bypass is restricted to `import.meta.env.DEV && VITE_WEBMCP_LOCAL_BYPASS === "true"`; production builds cannot bypass the gate. Failure exposes only an accessible explanation and Retry, not diagnostics or secrets.

The local seam and production gate are verified, but real OpenAI Challenge-browser validation remains an external pre-release requirement. Fresh checks in Playwright Chromium 151.0.7922.34 and system Chromium 151.0.7922.169 found `document.modelContext` unavailable without any mock, seam, init script, or bypass; real Challenge-browser success is not claimed.

## Deferred capabilities

Fleet Edit Mode, vehicle creation, route assignment, `create_vehicle`, and `assign_route` are intentional Phase 2 direction. Phase 1 provides no UI, operation, or WebMCP tool for them.
