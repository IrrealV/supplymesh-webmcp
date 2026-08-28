# Operations Domain API Specification

## Purpose

Define shared, branding-neutral fleet application semantics and delivery boundaries.

## Requirements

### Requirement: Shared Typed Operations

React and WebMCP MUST invoke the exact same typed application operations over the same Zustand-backed domain state. Components MUST NOT mutate business state through store internals. The API MUST provide semantics for scenario current, fleet status, vehicle get, vehicle rename/label update, and domain deletion, whether or not each is exposed as a Phase 1 tool.

#### Scenario: Compare query callers
- GIVEN React and a WebMCP handler query a vehicle
- WHEN both invoke the application API
- THEN they receive equivalent domain results from the same state

#### Scenario: Rename through either caller
- GIVEN a valid label-update command
- WHEN React or a tool handler invokes it
- THEN the same validation and resulting identity are applied

### Requirement: State Boundaries and Evolution

The system MUST separate scenario domain state from transient UI coordination state, including selection, active filter, drawer visibility, and follow. It SHALL preserve an adapter seam for a future simulation engine. Architecture and domain names MUST NOT depend on the provisional product brand.

#### Scenario: Clear transient selection
- GIVEN a selected vehicle
- WHEN UI coordination clears selection
- THEN scenario vehicles, routes, and risks are unchanged

#### Scenario: Inspect public names
- GIVEN domain modules and operations
- WHEN their names are reviewed
- THEN no name requires the provisional brand

### Requirement: Phase Boundary and Deliverability

The Phase 1 contract MUST document future Fleet Edit Mode plus `create_vehicle` and `assign_route` parity, but MUST NOT implement them. It MUST NOT specify movement, simulation, random fleets, country selection, real providers, backend/DB/auth, driver app, drag/drop, batch actions, rerouting, chat, or Phase 2. Delivery SHALL be a public MIT repository with Bun run instructions, no secrets, and verifiable clean lint, typecheck, test, and production build.

#### Scenario: Verify delivery boundary
- GIVEN the implementation documentation
- WHEN acceptance is reviewed
- THEN Bun commands, MIT/public status, secret absence, and quality commands are documented

#### Scenario: Review deferred capability
- GIVEN Phase 1 application behavior
- WHEN create or route-assignment actions are sought
- THEN they are documented as future work and unavailable
