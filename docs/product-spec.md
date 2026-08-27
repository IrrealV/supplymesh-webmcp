# Product Contract

## Current status

This foundation establishes the public MIT repository and browser toolchain. Fleet data, maps, UI controls, and WebMCP tools are intentionally not implemented yet.

## Product principles

1. The console is map-first on desktop and usable on tablets; smartphones are not a target.
2. One deterministic, offline Spain-region scenario supplies controlled routes, vehicles, and risks.
3. No random fleet generation, live routing, weather, traffic, or provider data is allowed.
4. Stable internal identity remains distinct from fleet number, label, and plate.
5. The provisional SupplyMesh name must not leak into domain or architecture names.
6. The product supports dispatch operations, never driver surveillance or driver-facing interaction.
7. React and WebMCP must invoke the same typed operations over the same domain state.
8. Scenario state and transient UI coordination state must stay separate.
9. English is the default; every visible string will come from typed English and Español catalogs.
10. Locale preference and scenario edits persist independently with versioned validation and fixture fallback.
11. Production blocks manual console access until the minimal WebMCP capability gate registers successfully.
12. A clearly named development-only bypass must be impossible to enable in a production build.
13. The repository remains public, MIT-licensed, Bun-operated, and free of secrets.
14. Fleet Edit Mode, `create_vehicle`, and `assign_route` remain future Phase 2 direction, not current features.

## Explicit exclusions

Phase 1 does not include authentication, a backend or database, simulation or movement, country selection, real providers, a driver app, drag and drop, batch actions, rerouting, chat, or expanded agent tooling.

## Delivery expectations

Use Bun commands from the README and keep lint, typecheck, tests, and production build green. Final WebMCP compatibility validation requires the challenge browser.
