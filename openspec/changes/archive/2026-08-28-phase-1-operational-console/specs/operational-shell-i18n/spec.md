# Operational Shell and I18n Specification

## Purpose

Define the map-first console frame, responsive boundary, and localized visible copy.

## Requirements

### Requirement: Map-Dominant Shell

The console MUST prioritize a desktop map workspace and remain usable on tablets; it NEED NOT optimize smartphones. The topbar SHALL contain only the provisional product name, an EN language menu, Help, and Account. It MUST NOT render a bottom bar or LIVE, WebMCP, agent, simulation, or stage-plan decoration. The visual language MUST remain professional and operational: no gradients, glassmorphism, giant cards, sparkle icons, excessive rounding, decorative metrics, chat, or driver-surveillance framing.

#### Scenario: Render approved shell
- GIVEN the console is available
- WHEN it renders on desktop
- THEN the map is the dominant workspace and only approved topbar content is visible

#### Scenario: Exclude unsupported chrome
- GIVEN any supported viewport
- WHEN the shell renders
- THEN prohibited decoration and a bottom bar are absent

### Requirement: Localized Catalog

English MUST be the default locale. The language menu SHALL offer English and Español without flags; selection MUST persist locally and independently of scenario edits. Every visible application string, including empty-state copy, MUST resolve from the typed catalog.

#### Scenario: Change locale
- GIVEN the default English console
- WHEN the user selects Español
- THEN cataloged visible copy changes to Spanish and remains selected after reload

#### Scenario: Missing optional copy
- GIVEN a view needs fallback copy
- WHEN it renders in either locale
- THEN it uses a meaningful cataloged string rather than a raw key or blank value

### Requirement: Filter Rail and Deferred Drawer

The left rail MUST initially be compact and expose icon, count, and tooltip categories: all, resting, needs attention, critical, weather affected, driving/rest risk, and road/restriction issues. Selecting a category SHALL expand and activate it; selecting the active category clears it; an explicit collapse control MUST exist. No right drawer SHALL be visually rendered until a vehicle is selected.

#### Scenario: Toggle a rail category
- GIVEN the compact rail has an active category
- WHEN the user selects that category again
- THEN the filter clears while the category remains available

#### Scenario: Inspect before selection
- GIVEN no vehicle is selected
- WHEN the map workspace renders
- THEN no drawer surface is visible
