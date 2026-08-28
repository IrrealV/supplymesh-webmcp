# Interactive Fleet Map Specification

## Purpose

Define map-based fleet filtering, selection, emphasis, and follow behavior.

## Requirements

### Requirement: Primary Operational Map

The Leaflet/OpenStreetMap workspace MUST render visible vehicle labels, controlled routes, and risk overlays as the console’s primary workspace. A rail filter SHALL highlight matching vehicles and MAY de-emphasize others; clearing it MUST restore context. A moving driver MUST NOT require visual or touch interaction.

#### Scenario: Apply a fleet filter
- GIVEN the map has all operational layers
- WHEN the user activates a rail category
- THEN matching vehicles are highlighted and secondary context may be de-emphasized

#### Scenario: Clear a fleet filter
- GIVEN a category filter is active
- WHEN it is cleared
- THEN all map context is restored

#### Scenario: Operate without driver interaction
- GIVEN a vehicle is driving
- WHEN operational status is reviewed
- THEN the console requires no driver-facing visual or touch action

### Requirement: Selection Focus and Emphasis

Selecting a vehicle marker MUST select that vehicle, open or replace the drawer, smoothly focus its map position, and highlight its vehicle, label, route, and relevant risk while de-emphasizing secondary layers. Closing the drawer MUST clear selection and focus state without deleting scenario data.

#### Scenario: Replace selected vehicle
- GIVEN one vehicle is selected
- WHEN another marker is selected
- THEN the drawer and focused layers represent only the latter vehicle

#### Scenario: Close inspection
- GIVEN a selected vehicle and open drawer
- WHEN the drawer closes
- THEN selection and focus clear while the vehicle and route remain in the scenario

### Requirement: Cancellable Follow

Selection MUST initially enable follow. Manual user pan, zoom, or selection of a different vehicle MUST cancel follow. A discreet `Follow <label>` action SHALL restore follow. Programmatic focus MUST NOT cancel follow.

#### Scenario: Cancel on user navigation
- GIVEN follow is enabled
- WHEN the user pans or zooms the map
- THEN follow is disabled

#### Scenario: Preserve programmatic follow
- GIVEN selection initiates programmatic focus
- WHEN the viewport moves for that focus
- THEN follow remains enabled until a user interaction or replacement selection
