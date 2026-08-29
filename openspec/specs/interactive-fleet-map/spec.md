# Interactive Fleet Map Specification

## Purpose

Define map-based fleet filtering, selection, emphasis, and follow behavior.

## Requirements

### Requirement: Primary Operational Map

The Leaflet/OpenStreetMap workspace MUST remain the primary map workspace and use a desaturated, token-free OSM-derived base with visible attribution. It MUST render separate visible truck markers and readable labels, status pins, controlled routes, risk overlays, and an accessible legend. Severe weather MUST use a translucent polygon, border, icon, and label; closure a red dashed segment and symbol; low-clearance and weight restrictions distinct markers with limits. OR filters SHALL emphasize matching vehicles and de-emphasize, not remove, secondary context; clearing filters MUST restore it. A moving driver MUST NOT require visual or touch interaction.
(Previously: Required labels, controlled routes, risk overlays, filter emphasis, and no driver interaction.)

#### Scenario: Apply OR fleet filters
- GIVEN all operational layers are visible
- WHEN one or more rail categories are active
- THEN every matching marker, label, and contextual card is emphasized without duplicate results

#### Scenario: Clear fleet filters
- GIVEN category filters are active
- WHEN they are cleared
- THEN all map context returns to normal emphasis

#### Scenario: Render base, markers, and risks
- GIVEN a vehicle is in the viewport
- WHEN its map layer renders
- THEN the attributed token-free base, separate truck marker and label, and all required risk encodings are visible

### Requirement: Selection Focus and Emphasis

Selecting a marker, its label, or its result card MUST select that vehicle, open or replace inspection, moderately focus its map position, and emphasize its vehicle, label, blue selected route, and relevant risk while de-emphasizing secondary layers. Affected route segments MUST retain severity distinction. Closing inspection MUST clear selection and focus state without deleting scenario data.
(Previously: Required marker selection, smooth focus, focused layers, replacement, and safe close.)

#### Scenario: Select from any operational affordance
- GIVEN a displayed vehicle marker, label, or result card
- WHEN the user activates one
- THEN the same vehicle opens inspection and receives focused map emphasis

#### Scenario: Replace selected vehicle
- GIVEN one vehicle is selected
- WHEN another vehicle is selected
- THEN inspection and focused layers represent only the latter vehicle

#### Scenario: Close inspection
- GIVEN a selected vehicle and open inspection
- WHEN it closes
- THEN selection and focus clear while scenario vehicle and route data remain

### Requirement: Cancellable Follow

Selection MUST initially enable follow. User drag, wheel, map button, pinch, or selection of another vehicle MUST cancel follow. A discreet `Follow <label>` action SHALL restore it. Programmatic selection focus and layout invalidation MUST NOT cancel follow.
(Previously: Required manual pan/zoom or replacement selection to cancel follow while programmatic focus preserves it.)

#### Scenario: Cancel on drag or wheel
- GIVEN follow is enabled
- WHEN the user drags or wheels the map
- THEN follow is disabled

#### Scenario: Cancel on controls or pinch
- GIVEN follow is enabled
- WHEN the user uses map controls or pinches
- THEN follow is disabled

#### Scenario: Preserve programmatic follow
- GIVEN selection initiates programmatic focus
- WHEN the viewport moves programmatically
- THEN follow remains enabled

#### Scenario: Cancel on replacement selection
- GIVEN follow is enabled for one vehicle
- WHEN another vehicle is selected
- THEN the prior follow is cancelled and only the replacement may begin follow

## ADDED Requirements

### Requirement: Spain Viewport and Selected Route Context

The map MUST initialize to a useful Spain viewport and recalculate its visible area after rail, panel, drawer, or dialog layout changes. Selected blue route and severity-distinct affected segments SHALL remain distinguishable at moderate focus. The legend MUST identify route, restriction, closure, weather zone, and risk-marker semantics.

#### Scenario: Preserve a usable viewport
- GIVEN desktop or tablet layout changes
- WHEN a panel changes the map size
- THEN the map redraws without clipped or blank geography

#### Scenario: Highlight selected route risk
- GIVEN a vehicle with route risks is selected
- WHEN focus completes
- THEN its blue corridor and severity-distinct risk segments or markers are distinguishable from secondary overlays

#### Scenario: Expose layer meaning
- GIVEN map overlays are available
- WHEN a keyboard or assistive-technology user reaches the legend
- THEN each required layer type has a readable meaning
