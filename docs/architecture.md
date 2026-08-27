# Architecture Contract

## Current status

This work unit provides the Bun/Vite/React foundation only. Domain operations, scenario fixtures, UI coordination, maps, and the WebMCP adapter are deferred to later work units.

## Planned boundaries

```text
fixtures + validated overrides -> Zustand scenario repository -> OperationsApi -> React
                                                                  -> WebMCP tools
transient UI coordination -> selectors -> map, rail, and inspection presentation
```

React components and WebMCP handlers will call the same typed `OperationsApi`; neither transport may mutate Zustand internals. The repository preserves a simulation-adapter seam without implementing a simulation engine. Browser-specific storage, Leaflet behavior, and `document.modelContext.registerTool` live behind narrow adapters.

The WebMCP gate will mount the console only after capability detection and minimal tool registration. Its development bypass is restricted to `import.meta.env.DEV && VITE_WEBMCP_DEVELOPMENT_BYPASS === "true"`; production remains gated. Failure exposes only an accessible explanation and Retry, not diagnostics or secrets.

## Deferred capabilities

Fleet Edit Mode, `create_vehicle`, and `assign_route` are intentional Phase 2 direction. This foundation provides no UI, operation, or WebMCP tool for them.
