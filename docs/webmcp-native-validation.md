# Native WebMCP Validation

Genuine native WebMCP validation passed on 2026-08-28. It exercised the application through Chromium's native API, not the development bypass or a test substitute.

## Environment

| Item | Evidence |
| --- | --- |
| Browser | `/usr/bin/chromium` 151.0.7922.169, headless |
| Native feature | Launched with the official `--enable-features=WebMCP` flag |
| Origin | Loopback application origin reported as a secure context |
| Test integrity | No polyfill, `page.addInitScript`, mock, local seam, route interception, or `VITE_WEBMCP_LOCAL_BYPASS` |
| Native surface | `document.modelContext` had constructor `ModelContext` and exposed `registerTool`, `getTools`, and `executeTool` |

## Results

- `getTools` returned exactly `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`.
- Native queries returned the deterministic Spain scenario and a 15-vehicle fleet status.
- Native rename changed `vehicle-002`; subsequent native queries and the rendered UI showed the new label, and the original label was then restored.
- A 65-character label returned the structured `invalid-label` result without an escaping exception.
- A real `beforeunload` aborted the registration `AbortSignal`, changed the native tool count from 4 to 0, and emitted a `toolchange` event.
- Every started process was terminated, and port 4173 was free after validation.

## Scope

This validation proves SupplyMesh's native WebMCP registration, execution, state-parity, safe-failure, and cleanup paths when Chromium is launched with the official native feature flag. It does not claim that WebMCP is enabled by default in ordinary Chromium. The development-only bypass boundary and all Phase 2 exclusions remain unchanged.
