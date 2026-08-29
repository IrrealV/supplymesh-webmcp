# Operational Shell and I18n Specification

## Purpose

Define the map-first console frame, responsive boundary, and localized visible copy.

## Requirements

### Requirement: Map-Dominant Shell

The console MUST provide a professional map-dominant shell: dark topbar and rail, narrow left rail, largest central map, bounded desktop right panel, and no smartphone requirement. It MUST use semantic interactive components, landmarks, named controls, visible focus, and reduced-motion-safe transitions. The topbar SHALL contain only SupplyMesh branding, a language menu, Help, and Account. The document title MUST include SupplyMesh and MUST NOT show a fake Last updated value or timestamp. It MUST NOT render a bottom bar, LIVE, WebMCP, agent, simulation, stage-plan, or decorative-AI chrome, including gradients, glassmorphism, giant cards, sparkles, excessive rounding, decorative metrics, chat, or driver-surveillance framing.
(Previously: Required a map-dominant professional shell with limited topbar content and prohibited chrome.)

#### Scenario: Render operational desktop
- GIVEN the console is available on desktop
- WHEN the shell renders
- THEN SupplyMesh, language menu, Help, and Account are the only topbar content, and the title has no fake timestamp

#### Scenario: Exclude unsupported chrome
- GIVEN any supported viewport
- WHEN the shell renders
- THEN prohibited decoration and a bottom bar are absent

#### Scenario: Respect reduced motion
- GIVEN reduced motion is preferred
- WHEN shell state changes
- THEN nonessential animation is suppressed

#### Scenario: Navigate shell semantics
- GIVEN a keyboard or assistive-technology user
- WHEN shell controls and regions are reached
- THEN landmarks, names, focus order, and visible focus make each action operable

### Requirement: Localized Catalog

English MUST be the default locale. A keyboard-accessible language menu SHALL offer English and Español without flags, permit either-direction switching, persist locally independently of scenario edits, and set the document `html lang`. Every visible application string, status, time, date, unit, and fallback MUST resolve from the typed catalog.
(Previously: Required default English, persistent English/Español selection, and cataloged visible copy.)

#### Scenario: Change locale
- GIVEN the default English console
- WHEN the user selects Español
- THEN visible cataloged copy and `html lang` become Spanish and persist after reload

#### Scenario: Switch back to English
- GIVEN Español is active
- WHEN the user selects English
- THEN English copy and `html lang` are restored after reload

#### Scenario: Use the menu by keyboard
- GIVEN either locale
- WHEN the user operates the language menu by keyboard
- THEN it is reachable, named, and changes locale without raw keys or blanks

### Requirement: Filter Rail and Deferred Drawer

The compact rail MUST expose accessible icon, derived count, and tooltip categories: All vehicles, resting, needs attention, critical, Weather affected, driving/rest risk, and road/restriction issues. It SHALL expand by control or category selection and provide an explicit collapse control. Non-All categories MUST toggle independently with OR matching; results MUST deduplicate and use exact priority: critical, needs-attention, risk-affected, driving, resting, then stable fleet number. All vehicles clears filters; removable chips MUST not imply All vehicles. The default panel MUST show an Operational Overview with real derived compact cards for All vehicles, Resting, Needs attention, and Critical; each MUST activate its equivalent filter. It MUST list applicable severe weather, closure, low clearance, weight restriction, and driving/rest risk, with no fake timestamp or endless metrics. Filter results MUST distinguish one-filter from multiple-filter context in header and chips, and each card MUST show label-or-fleet fallback, origin→destination, localized status, ETA, delay when present, matching risk reasons including driving/rest when applicable, and severity. The panel MUST support overview, results, and inspection; selection overrides other modes, and closing/deleting restores prior context. Desktop uses the panel; tablet uses an accessible results drawer and inspection dialog with focus restoration; no inspection drawer is rendered before selection.
(Previously: Required one toggled rail category, explicit collapse, and no drawer before selection.)

#### Scenario: Toggle multiple filters
- GIVEN the compact rail
- WHEN the user selects two non-All categories
- THEN both remain active, the rail expands, and multiple-filter header/chips show each matching vehicle once in priority order

#### Scenario: Activate an overview card or reset filters
- GIVEN the Operational Overview or active filters
- WHEN a compact status card or All vehicles is selected
- THEN its equivalent filter activates, or filters clear with derived counts and context restored

#### Scenario: Select a result card
- GIVEN filtered results are visible for one or multiple filters
- WHEN the user activates a card showing identity, status, route, and risk summary
- THEN its contextual header/chips and compact fields are complete, and inspection replaces results

#### Scenario: Restore contextual mode
- GIVEN a selected inspection over filtered or default context
- WHEN it closes or its vehicle is deleted
- THEN the corresponding filtered-results or default mode is restored with usable focus

#### Scenario: Render overview before selection
- GIVEN no vehicle is selected
- WHEN the workspace renders
- THEN Operational Overview is visible and no inspection drawer is rendered

## ADDED Requirements

### Requirement: Compatibility and Acceptance Boundary

Console availability MUST preserve exactly four WebMCP tools: `scenario_current`, `fleet_status`, `vehicle_get`, and `vehicle_rename`. The first two SHALL accept only `{}` with `additionalProperties: false`; `vehicle_get` SHALL require only `vehicleId: string` with `minLength: 1`; `vehicle_rename` SHALL require only `vehicleId` and `label` strings with `minLength: 1`; all SHALL reject additional properties. Each MUST retain the single-item `JSON.stringify(DomainResult)` text response, shared typed-operation parity, production gate, lifecycle cleanup, and unchanged development-only `VITE_WEBMCP_LOCAL_BYPASS`. No Phase 2 feature or tool MAY be introduced. Acceptance MUST pass lint, typecheck, Vitest, Playwright, production build, and native WebMCP checks, plus critically compared real-browser evidence in `docs/evidence/phase1-1/`.

#### Scenario: Preserve the WebMCP contract
- GIVEN a supported native WebMCP environment
- WHEN tools register before console rendering
- THEN exactly the four named tools retain schemas, responses, and shared-operation outcomes

#### Scenario: Preserve gate and lifecycle
- GIVEN unsupported production WebMCP or an unloading page
- WHEN boot or cleanup occurs
- THEN the accessible gate blocks, bypass cannot enable production access, and registrations are cancelled safely

#### Scenario: Produce visual evidence
- GIVEN the accepted desktop and tablet workflows
- WHEN evidence is captured
- THEN it contains exactly: desktop operational overview; desktop expanded sidebar with Weather affected active; desktop selected vehicle with route/risk highlighted; desktop two simultaneous active filters; tablet filter results; tablet vehicle detail

#### Scenario: Exclude Phase 2
- GIVEN the redesigned console
- WHEN capabilities are reviewed
- THEN simulation, movement, random fleets, country selection, vehicle creation, Fleet Edit Mode, drag/drop, batch actions, dynamic or live routing/weather/traffic providers, backend/database/auth, driver UI, chat, agent behavior, and rerouting are absent
