# SupplyMesh

SupplyMesh is a provisional name for a deterministic, map-first fleet operations console for the OpenAI WebMCP Challenge. Phase 1 is implemented, independently verified, and archived. Phase 1.1 is an active chained redesign and is not merged to `main`.

Final verification verdict: **PASS WITH WARNINGS** — 18/18 requirements, 37/37 scenarios, and 17/17 tasks, with zero blockers or CRITICAL findings. The local WebMCP seam, production capability gate, 32 Vitest tests, 4 Playwright tests, lint, typecheck, and builds passed.

Phase 1.1 release evidence on `test/phase1-1-release-evidence` is **BLOCKED**: functional regression passed, but required overview/filter screenshots contain acceptance-critical map-label collisions, and native Chromium reports a missing `/favicon.ico` resource. The active SDD change remains 15/19 tasks complete; no merge or release is claimed. See [the visual evidence verdict](docs/evidence/phase1-1/visual-comparison.md).

## Run locally

```sh
bun install
bun run dev
```

## Quality commands

```sh
bun run lint
bun run typecheck
bun run test
bun run build
bun run check
```

## Development environment

Copy `.env.example` to `.env.local` only for local development. Set `VITE_WEBMCP_LOCAL_BYPASS=true` when the local browser does not provide WebMCP and you need to exercise the console UI. The application accepts this bypass only when `import.meta.env.DEV` is true; a production build always requires the WebMCP capability gate. No secrets belong in this repository.

## Product boundary

The console uses deterministic offline fixtures, React, and a minimal WebMCP bridge backed by the same application operations. Phase 1 exposes exactly four WebMCP tools: `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`.

Fleet Edit Mode, vehicle creation, route assignment, `create_vehicle`, and `assign_route` remain unavailable Phase 2 work. [Genuine native WebMCP validation](docs/webmcp-native-validation.md) succeeded in system Chromium 151.0.7922.169 with the official `--enable-features=WebMCP` flag and no polyfill, mock, local seam, route interception, init script, or bypass. This validates the native integration under the feature flag; it does not claim that ordinary Chromium enables WebMCP by default.

See [the product contract](docs/product-spec.md), [UI contract](docs/ui-spec.md), and [architecture](docs/architecture.md). Licensed under [MIT](LICENSE).
