# Proposal: Phase 1 Operational Console

## Intent

Deliver a deterministic map-first fleet console where UI and a minimal WebMCP bridge share application operations.

## Scope

### In Scope
- Create the public `supplymesh-webmcp` repository with MIT, Bun scripts, no secrets, and `docs/product-spec.md`, `docs/ui-spec.md`, and `docs/architecture.md`.
- Build the responsive shell, typed i18n catalog, separate locale preference, deterministic Spain-region fixtures, and validated versioned label edits with fixture fallback.
- Deliver React Leaflet layers, fleet filters, inspection drawer, label edit/delete, selection, and follow.
- Provide a Zustand-backed domain API and feature-detected `document.modelContext.registerTool` platform adapter.

### Out of Scope
- Real providers, multi-region scenarios, authentication, simulation engine, and Phase 2 WebMCP expansion.

## Capabilities

### New Capabilities
- `operational-shell-i18n`: Accessible responsive shell, typed catalog, separate locale preference.
- `deterministic-fleet-scenario`: Branding-neutral operating-region, vehicle, route, and GeoJSON-risk fixtures.
- `interactive-fleet-map`: React Leaflet layers, filters, focus/highlight, cancellable follow.
- `vehicle-operations`: Inspect, label edit, delete, follow, and versioned validated edit storage.
- `operations-domain-api`: Shared typed queries/commands with a Zustand adapter; separate UI state.
- `webmcp-compatibility-bridge`: Platform gate/retry and minimal read/query plus label-edit tools using domain operations.

### Modified Capabilities
None; `openspec/specs/` is empty.

## Approach

Use ports-and-operations: React selectors and WebMCP handlers invoke the same typed API. Isolate browser seams; compile a development bypass only in development and prove production excludes it.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `docs/` | New | Product, UI, architecture contracts. |
| `src/scenario/`, `src/domain/operations/` | New | Fixtures, persistence, operations. |
| `src/features/fleet/`, `src/features/map/` | New | Console and map layers. |
| `src/platform/webmcp/` | New | Gate and tool adapter. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Browser WebMCP support varies | High | Feature-detect, block/retry in production, validate challenge browser. |
| Invalid stored edits | Medium | Schema/version key, validation, deterministic fixture fallback. |

## Rollback Plan

Revert chained work units; clear only the versioned edit key to restore fixtures. Remove the adapter without changing the domain API.

## Dependencies

- Bun, React/TypeScript, Zustand, React Leaflet, Leaflet, and a challenge browser exposing the documented seam.

## Success Criteria

- [ ] UI and minimal tools give equivalent query/label-edit outcomes through shared operations.
- [ ] Production cannot enable the development bypass; unsupported WebMCP shows an accessible retry gate.
- [ ] Corrupt/obsolete edits restore fixtures; locale remains independently persisted.
- [ ] Repository is public under MIT, has no secrets, Bun scripts, and coherent commits within the 800-line auto-chain budget.
- [ ] Lint, typecheck, test, and production build complete cleanly.
