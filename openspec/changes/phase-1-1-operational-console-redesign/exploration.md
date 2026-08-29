## Exploration: phase-1-1-operational-console-redesign

### Current State
The active replacement branch is `feat/phase1-1-ors-route-fixtures`, beginning at the contract-valid Unit 2 commit `d834b2b`; the unpublished old Unit 3 branch is abandoned. The console remains a React/Vite application gated by WebMCP, with `App -> OperationsApi -> Zustand ScenarioRepository` for domain data and a separate Zustand UI coordination store. Unit 2 already supplies OR multi-filter selection and three right-panel modes: overview, filter results, and selected-vehicle inspection. The four tools (`scenario_current`, `fleet_status`, `vehicle_get`, `vehicle_rename`) already delegate to the same API.

The deterministic fixture still gives each vehicle an independent `position` and constructs every route as a two-point origin-to-destination line. `FleetMap` uses that independent position for markers and focus, while risks are manually placed. This violates the superseding route-geometry decision. The fixture therefore needs generated, versioned road geometries; vehicle `routeId` plus normalized, bounded `routeProgress`; derived marker/focus coordinates; and risk geometry snapped to those generated routes.

There is no concrete blocker to openrouteservice generation: Bun can make the bounded generation request and the project already consumes GeoJSON. The external dependency is limited to an explicit regeneration command. Runtime loads checked-in fixtures only, makes no routing request, contains no key, and has no dynamic route alternative or Phase 2 routing behavior.

Impeccable context is incomplete: neither `PRODUCT.md` nor `DESIGN.md` exists, and the repository does not vend the requested Impeccable loader. The user-approved authoritative brief is sufficient as a confirmed shape brief for this scoped redesign, but the missing product/design context remains a non-blocking documentation gap.

### Affected Areas
- `src/styles.css` — replace the Phase 1 light, fixed-grid presentation with the approved dark operational composition, responsive panel behavior, focus states, and reduced-motion rules.
- `src/features/shell/OperationalShell.tsx`, `Topbar.tsx` — compose the contextual right-panel modes without widening application responsibilities.
- `src/domain/entities.ts` — replace independent stored vehicle positions with `routeId` and a normalized, bounded `routeProgress`; define generated-route and provenance schema types.
- `src/scenario/fixtures/spain-v1.ts`, `geometry.ts`, `src/scenario/state/createZustandScenarioRepository.ts` — load versioned generated routes, validate route references/progress, derive vehicle positions from route geometry, and retain deterministic override behavior.
- `src/scenario/fixtures/ors-route-requests-v1.ts`, `src/scenario/fixtures/generated/ors-routes-v1.geojson`, `src/scenario/fixtures/generated/ors-routes-v1.provenance.json` — future checked-in request manifest, generated GeoJSON, and provenance. The exact file names are implementation choices, but the generated data and provenance must be versioned together.
- `scripts/regenerate-ors-routes.ts`, `package.json` — future reproducible Bun/TypeScript generation command. It must fail safely before any request when `ORS_API_KEY` is absent; make authenticated POST requests only during regeneration; normalize output deterministically; and never write a key.
- `src/scenario/routePosition.ts` and `src/features/map/FleetMap.tsx` — calculate marker and focus coordinates from referenced route geometry and progress, then render generated routes and route-snapped risk segments.
- `src/features/map/layers.ts`, `MapEventCoordinator.ts` — retain selected/filter emphasis and cancellable follow while consuming derived positions instead of fixture points.
- `src/features/fleet/VehicleDrawer.tsx`, `DeleteVehicleDialog.tsx` — reorganize selected-vehicle inspection hierarchy and preserve existing rename, deletion, fallback, and follow actions.
- `src/preferences/i18n/{catalog,en,es}.ts`, `localeStorage.ts` — add all redesign copy to both catalogs and retain locale roundtrip isolation.
- `src/scenario/**/*.test.ts`, `src/features/**/*.test.*`, `src/preferences/i18n/catalog.test.ts`, `e2e/*.spec.ts`, and future generator tests — prove fixture schema/version/provenance, no long two-point routes, deterministic runtime loading without network, progress-derived positions, snapped risks, missing-key failure, no runtime routing path, plus existing accessibility and six visual states.
- `README.md`, `docs/{product-spec,ui-spec,architecture}.md` — later document the regeneration-only ORS dependency, required key handling, provenance, and runtime determinism. They are affected in a later authorized work unit, not by this exploration amendment.
- `src/platform/webmcp/{WebMcpGate,registerOperationalTools,webMcpTypes}.ts` — preservation-only regression surface: tool names, schemas, gate semantics, and API delegation must remain unchanged.

### Approaches
1. **Generated ORS HGV fixtures with runtime-only loading** — Use `POST /v2/directions/driving-hgv/geojson` during an explicit Bun regeneration command, sending `[longitude, latitude]` coordinates and `Authorization: <ORS_API_KEY>`. Normalize and check in GeoJSON plus distance/duration/provenance, then load it locally at runtime.
   - Pros: Real road-constrained HGV geometry, reproducible checked-in runtime data, no browser key or runtime routing dependency, and route-snapped risks/derived positions are mechanically verifiable.
   - Cons: Regeneration requires an authorized external service and a maintained secret outside the repository; OSM/ORS data can change when deliberately regenerated.
   - Effort: High.

2. **Manually authored or generated-in-app polylines** — Draw, smooth, interpolate, or fabricate route coordinates from origin/destination fixtures.
   - Pros: No generation credential or service dependency.
   - Cons: Explicitly prohibited by the authoritative decision; cannot establish real HGV routing provenance or reliable route snapping.
   - Effort: Rejected.

3. **Runtime ORS routing** — Request directions from the browser or normal application path.
   - Pros: Fresh routes.
   - Cons: Explicitly prohibited: leaks a key or proxy requirement, makes rendering nondeterministic, adds runtime network failure, and implies Phase 2 routing behavior.
   - Effort: Rejected.

### Recommendation
Use generated ORS `driving-hgv` fixtures. The generator reads `ORS_API_KEY` only at execution time, first rejects an absent key without a request, calls the official GeoJSON endpoint with an `Authorization` header, validates one LineString result per manifest route, records meters/seconds and non-secret provenance, and serializes deterministically. It must not generate, smooth, interpolate, or invent geometry.

Runtime determinism and regeneration reproducibility are separate contracts: the runtime never calls ORS and always loads one checked-in fixture version; regeneration is an explicit external operation whose request manifest, profile, response summary, and provenance expose why a reviewed fixture changed. Preserve the existing React -> OperationsApi -> repository boundary and four tools. Derived position helpers belong in domain/scenario presentation support, not React state or direct scenario-store mutation.

Continue auto-chaining from contract-valid Unit 2: (3a) route manifest, generated-fixture schema/provenance, progress invariants, and safe generator failure tests; (3b) reviewed ORS-generated GeoJSON, deterministic loader, position derivation, and risk snapping; (4) map/follow/drawer integration, i18n, tablet/accessibility/reduced-motion; (5) WebMCP parity regression, no-runtime-network test, documentation, and six final screenshots: desktop default, desktop expanded filters, desktop selected inspection, tablet default, tablet filters, and tablet selected inspection. Keep generated GeoJSON reviewable as a separately identified fixture payload and split authored code further if it approaches the 800-line budget.

### Risks
- A rich right panel can obscure the map or overload tablet layouts; define explicit default, filters, and selected-inspection modes with deterministic transitions and keyboard focus behavior.
- OR filtering, selection, and follow must remain composable: selection takes visual priority, manual pan/zoom cancels follow, and programmatic focus must not.
- ORS availability, quotas, HGV coverage, and OSM data evolution affect regeneration only. A failed or unavailable generator must leave checked-in runtime fixtures untouched; the app must never fall back to a fabricated or runtime-fetched route.
- Incorrect coordinate order, missing/extra route IDs, progress outside its bounds, two-point long routes, or risks not located on a route can silently make the map misleading; schema and geometry tests must reject them.
- CSS-only map desaturation still depends on OSM tile availability; generated routes and risks are deterministic, but offline base-map behavior is not currently guaranteed.
- Adding English copy without matching Spanish copy or inaccessible icon controls would regress the typed-catalog and accessibility contracts.
- The four WebMCP schemas, names, output envelope, production gate, and shared `OperationsApi` delegation are strict preservation boundaries.

### Ready for Proposal
Yes. The proposal should supersede manual route geometry with the ORS generation-time contract, distinguish it from deterministic runtime loading, require `routeProgress`-derived vehicle positions and snapped risks, preserve the three right-panel modes and four WebMCP tools, and retain the non-goals: no runtime routing, bundled secrets, dynamic alternatives, Phase 2 routing, simulation, backend, rerouting, or driver-facing behavior.
