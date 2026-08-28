## Exploration: Phase 1 Operational Console

### Current State
The project contains only SDD initialization artifacts: no Git repository, application code, package manifest, tests, or established frontend conventions. OpenSpec requires hybrid persistence and branding-independent architecture. WebMCP documentation currently exposes `document.modelContext.registerTool(...)`; this should be feature-detected and isolated because browser availability remains environment-dependent.

### Affected Areas
- `openspec/changes/phase-1-operational-console/exploration.md` — records the discovery and recommended Phase 1 boundary.
- `docs/product-spec.md` — future authoritative product scope and explicit Phase 2 deferrals.
- `docs/ui-spec.md` — future shell, map-priority, responsive, drawer, rail, and i18n behavior contract.
- `docs/architecture.md` — future application/domain API, Zustand adapter, persistence, and WebMCP gate contract.
- `src/features/fleet/` — future fleet selection, filtering, identity editing, deletion, and drawer UI.
- `src/features/map/` — future React Leaflet layers, controlled routes, risks, focus/highlight, and follow interaction bridge.
- `src/domain/operations/` — future shared commands and queries used by both React and WebMCP.
- `src/scenario/` — future deterministic region, vehicle, route, and GeoJSON risk fixtures.
- `src/platform/webmcp/` — future capability gate and thin tool-registration adapter.

### Approaches
1. **Ports-and-operations with a Zustand adapter** — Define typed domain entities and application commands/queries first; implement them against a narrow scenario repository backed by Zustand. React components consume selectors and invoke operations, while WebMCP tool handlers invoke those exact operations.
   - Pros: Enforces UI/tool parity, preserves a clean simulation-engine seam, makes deterministic tests straightforward, and prevents components from mutating store internals.
   - Cons: Adds small up-front structure before rendering the map.
   - Effort: Medium.

2. **UI-led Zustand store with later WebMCP wrappers** — Put commands and view state together in a feature store, then have WebMCP call store actions.
   - Pros: Fastest initial visual prototype with fewer files.
   - Cons: Couples transport/UI concerns to state, makes operation parity accidental, and risks direct `setState` use and a costly future simulation migration.
   - Effort: Low initially, High in rework.

3. **Capability-isolated WebMCP gate** — Keep a browser adapter responsible only for feature detection, registration, cleanup, and translating tool inputs/results to application operations. In production, a failed capability check or registration failure shows only an accessible blocking retry screen. A compile-time development-only bypass must require an explicitly dev-only build condition and be rejected in production builds.
   - Pros: Uses the currently documented `document.modelContext` seam without inventing APIs; contains experimental-platform volatility; preserves the final compatibility gate.
   - Cons: Local development needs a deliberately guarded bypass until a supported browser environment is available.
   - Effort: Medium.

### Recommendation
Use Approach 1 plus Approach 3. Model an `OperatingRegion` fixture that owns bounds, locale defaults, vehicles, routes, and GeoJSON risks; seed one deterministic Spain scenario without country product constants. Separate domain state from ephemeral UI state: selection, active rail filter, drawer visibility, and follow mode belong to UI coordination, while vehicles/routes/risks and identity mutations belong to scenario operations. Use React Leaflet layer components over immutable fixture data; compute highlighted/de-emphasized layer presentation from selected vehicle and filter state rather than mutating Leaflet layers imperatively. Use a small typed message catalog and localStorage locale preference instead of a heavyweight i18n framework. Sequence delivery as foundation/docs → scenario/domain operations → map and rail → drawer/follow/edit/delete → i18n/tablet/accessibility → WebMCP gate/tools → quality verification; this keeps the 800-line review budget suitable for chained slices.

### Risks
- WebMCP is still browser- and permission-policy-dependent. The documented API is `document.modelContext.registerTool`, but final challenge-browser validation is required before locking tool names or exact result shapes.
- Leaflet viewport events can inadvertently re-enable or preserve follow mode; define a single interaction coordinator that cancels follow on user pan/zoom and on selection replacement.
- Persisting editable labels and locale locally requires versioned, validated storage and a deterministic reset/fallback policy so fixtures remain reproducible.
- Route/risk GeoJSON must remain controlled and plausible; real routing, traffic, and weather providers are explicitly out of scope.

### Ready for Proposal
Yes. The requirements already decide the product shape and closed stack. The proposal should resolve only: the minimal initial WebMCP tool set and tool input/result conventions after challenge-environment validation; the production build mechanism that proves the dev bypass is unavailable; and the persistence reset/versioning behavior for local scenario edits. It should not reopen explicit product, UI, or scope decisions.
