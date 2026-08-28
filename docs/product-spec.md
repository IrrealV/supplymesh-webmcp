# Product Contract

## Current status

Phase 1 is implemented, independently verified, and archived. Final verification verdict: **PASS WITH WARNINGS** — 18/18 requirements, 37/37 scenarios, and 17/17 tasks, with zero blockers or CRITICAL findings.

The delivered product includes the deterministic fleet scenario, map workspace, inspection and vehicle operations, English and Español UI, persisted validated overrides, and four WebMCP tools: `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`.

## Product principles

1. The console is map-first on desktop and usable on tablets; smartphones are not a target.
2. One deterministic, offline Spain-region scenario supplies controlled routes, vehicles, and risks.
3. No random fleet generation, live routing, weather, traffic, or provider data is allowed.
4. Stable internal identity remains distinct from fleet number, label, and plate.
5. The provisional SupplyMesh name must not leak into domain or architecture names.
6. The product supports dispatch operations, never driver surveillance or driver-facing interaction.
7. React and WebMCP must invoke the same typed operations over the same domain state.
8. Scenario state and transient UI coordination state must stay separate.
9. English is the default; visible strings come from typed English and Español catalogs.
10. Locale preference and scenario edits persist independently with versioned validation and fixture fallback.
11. Production blocks manual console access until the minimal WebMCP capability gate registers successfully.
12. `VITE_WEBMCP_LOCAL_BYPASS` is development-only and must be ignored unless `import.meta.env.DEV` is true; production always enforces the capability gate.
13. The repository remains public, MIT-licensed, Bun-operated, and free of secrets.
14. Fleet Edit Mode, `create_vehicle`, and `assign_route` remain future Phase 2 direction, not current features.

## Explicit exclusions

Phase 1 does not include authentication, a backend or database, simulation or movement, country selection, real providers, a driver app, drag and drop, batch actions, rerouting, chat, or expanded agent tooling.

## Delivery expectations

The local WebMCP seam, production gate, 32 Vitest tests, 4 Playwright tests, lint, typecheck, and builds passed. [Genuine native WebMCP validation](webmcp-native-validation.md) also passed in system Chromium 151.0.7922.169 with the official `--enable-features=WebMCP` flag and no polyfill, mock, local seam, route interception, init script, or bypass. This is evidence for the native feature-flag path, not a claim that ordinary Chromium enables WebMCP by default.
