# WebMCP Compatibility Bridge Specification

## Purpose

Gate console availability on WebMCP compatibility while proving minimal shared-operation parity.

## Requirements

### Requirement: Production Capability Gate

Production boot MUST detect current `document.modelContext` support and register required minimal tools before rendering the console. Unsupported support or failed registration MUST block manual console access and show only an accessible WebMCP-required explanation and Retry action; it MUST NOT offer Continue manually, Skip, or Disable AI.

#### Scenario: Register before console render
- GIVEN a supported environment
- WHEN required tool registration succeeds
- THEN the operational console becomes available

#### Scenario: Block an unsupported environment
- GIVEN `document.modelContext` is unavailable or registration fails
- WHEN boot completes
- THEN only the accessible requirement explanation and Retry are rendered

### Requirement: Minimal Shared Tool Parity

The bridge MUST expose only a minimal read/query and label-edit tool set that invokes shared application operations. It MUST NOT claim complete tool taxonomy or complex agent behavior in Phase 1.

#### Scenario: Query through a tool
- GIVEN registered tools and a valid fleet query
- WHEN the tool is invoked
- THEN it returns the shared-operation result

#### Scenario: Edit through a tool
- GIVEN a valid vehicle label command
- WHEN the label-edit tool is invoked
- THEN the shared rename outcome is visible to the console

### Requirement: Safe Bypass and Lifecycle

A clearly named local-development bypass MAY operate only in a development build and MUST be impossible to enable in the equivalent production build. Registrations MUST clean up with cancellation/unload lifecycle semantics; errors MUST NOT expose secrets or implementation diagnostics. Final challenge-browser validation SHALL remain a documented external prerequisite.

#### Scenario: Reject production bypass
- GIVEN a production build with a bypass-like variable set
- WHEN the console boots without supported WebMCP
- THEN the compatibility gate remains blocking

#### Scenario: Unload registered tools
- GIVEN tools were successfully registered
- WHEN the page lifecycle unloads or cancels
- THEN registration cleanup runs without diagnostic leakage
