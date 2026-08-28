```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2024339d2cc92e2f20f01e1f64e835b5e5a704cd55efac06896e38ab2019f631
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 18/18
scenarios: 37/37
test_command: NO_COLOR=1 bun run test && NO_COLOR=1 bunx playwright test e2e/operational-console.spec.ts e2e/production-gate.spec.ts --reporter=list
test_exit_code: 0
test_output_hash: sha256:419e635fed2c1e3f999d3503890ae88664889c0a2cb8963ca535707e60298828
build_command: NO_COLOR=1 bun run lint && NO_COLOR=1 bun run typecheck && NO_COLOR=1 bun run build && NO_COLOR=1 VITE_WEBMCP_LOCAL_BYPASS=true bun run build
build_exit_code: 0
build_output_hash: sha256:76c83b2e95af11abd8488847bb6ebf0f909289619ebe7a0566aa3fe3edad29bd
```

## Verification Report

**Change**: `phase-1-operational-console`  
**Version**: N/A  
**Mode**: Standard (`strict_tdd: false`)  
**Artifact mode**: Hybrid (OpenSpec + Engram)

### Candidate Identity and Lineage

| Evidence | Value |
|---|---|
| Base commit | `01ac41af862b3c50d6c085c273007b4d517e7994` (`01ac41a`) |
| Requested product candidate tree | `0f52bdc6f32251248247c0e07b61b46b5eba3a2d` |
| Independently reconstructed pre-command tree | `0f52bdc6f32251248247c0e07b61b46b5eba3a2d` |
| Independently reconstructed post-command tree | `0f52bdc6f32251248247c0e07b61b46b5eba3a2d` |
| Prior failed evidence | `sha256:db89c609d5a8472e439b6368c5c0c444540de3d4a70c7a4943cc201e1e0b4c95` |
| Settled correction evidence | `sha256:ac8eb88de65f01ecbdd540e4457427f2b3a1b4ac22dd6361ce88add0e7dfeb17` |
| Corrected product diff | 50 additions + 20 deletions = 70 changed lines across 11 files |
| Tooling exclusion | Untracked `.codegraph/` excluded from the product candidate |

### Completeness

| Metric | Value |
|---|---:|
| Spec files | 6 |
| Requirements | 18 |
| Scenarios | 37 |
| Tasks total | 17 |
| Tasks complete | 17 |
| Tasks incomplete | 0 |

Native status reported `verify: ready`, `archive: blocked`, `apply: all_done`, and no blocked reasons. The orchestrator had already acquired the runtime verification attempt; this verifier did not acquire, reset, or settle it.

### Build, Static Checks, and Tests

| Evidence | Result |
|---|---|
| Lint | ✅ `eslint .` passed |
| Typecheck | ✅ `tsc -b` passed |
| Standard production build | ✅ Vite 8.2.2 built 4,697 modules |
| Bypass-like production build | ✅ Vite 8.2.2 built 4,697 modules |
| Vitest | ✅ 9 files, 32 tests passed |
| Operational Playwright | ✅ 3 Chromium tests passed |
| Production-gate Playwright | ✅ 1 Chromium test passed |
| Coverage | ➖ Not configured; project threshold is `0` and no coverage command exists |

The bounded test output is 29 lines / 1,729 bytes and hashes to `sha256:419e635fed2c1e3f999d3503890ae88664889c0a2cb8963ca535707e60298828`. The bounded build output is 24 lines / 752 bytes and hashes to `sha256:76c83b2e95af11abd8488847bb6ebf0f909289619ebe7a0566aa3fe3edad29bd`.

Supplemental executed evidence passed with `sha256:734fa930fd0ef975145ed2676e49aec31de92add443c5a72206549bcc0fa14cd`: six spec files, 18 requirements, 37 scenarios, 17 completed tasks, zero pending tasks, exact base/candidate identity, clean `git diff --check`, clean tracked-secret scan, branding-neutral domain/scenario names, MIT/public repository metadata, documented Bun commands and deferred capabilities, and port 4173 cleanup.

### Former CRITICAL Failures — Independent Re-Proof

| Former failure | Independent runtime evidence | Result |
|---|---|---|
| Unsupported WebMCP gate ignored persisted locale | `e2e/operational-console.spec.ts > should block the console when the WebMCP capability is unavailable` loaded `locale:v1=es` and passed exact Spanish explanation, Spanish Retry, `lang=es`, and console-blocking assertions in the 3-test Playwright run | ✅ Resolved |
| Persisted labels bypassed the normalized 1–64 character invariant | `src/scenario/persistence/overrideStorage.test.ts > falls back from a persisted label longer than 64 characters` passed in both the full 32-test run and an independent verbose focused run | ✅ Resolved |

The focused regression command `NO_COLOR=1 bunx vitest run src/scenario/persistence/overrideStorage.test.ts src/platform/webmcp/WebMcpGate.test.tsx src/preferences/i18n/catalog.test.ts --reporter=verbose` exited 0 with 11/11 tests passing. Its bounded output hashes to `sha256:b179170393684ef5deb74ba29b5b3dca59b32a7ab76a997c5d08cea7a2621b14`.

### Spec Compliance Matrix

| # | Requirement | Scenario | Passing runtime evidence | Result |
|---:|---|---|---|---|
| 1 | Map-Dominant Shell | Render approved shell | `OperationalShell.test.tsx > should render only approved topbar chrome without a drawer before selection`; desktop Playwright workflow | ✅ COMPLIANT |
| 2 | Map-Dominant Shell | Exclude unsupported chrome | Same unit test; desktop Playwright prohibited-chrome assertions | ✅ COMPLIANT |
| 3 | Localized Catalog | Change locale | `catalog.test.ts > should persist a selected locale...`; desktop Playwright Español/reload assertions | ✅ COMPLIANT |
| 4 | Localized Catalog | Missing optional copy | `VehicleDrawer.test.tsx > should use localized fallbacks for absent optional values`; catalog completeness test | ✅ COMPLIANT |
| 5 | Filter Rail and Deferred Drawer | Toggle a rail category | `FilterRail.test.tsx > should expand and toggle the active filter...`; desktop Playwright critical-filter toggle | ✅ COMPLIANT |
| 6 | Filter Rail and Deferred Drawer | Inspect before selection | `OperationalShell.test.tsx > should render only approved topbar chrome...`; desktop Playwright no-drawer assertion | ✅ COMPLIANT |
| 7 | Production Capability Gate | Register before console render | `WebMcpGate.test.tsx > should mount the console only after all tools register...`; supported-seam Playwright workflow | ✅ COMPLIANT |
| 8 | Production Capability Gate | Block an unsupported environment | `WebMcpGate.test.tsx > should block unsupported access...`; persisted-Spanish unsupported-gate Playwright test | ✅ COMPLIANT |
| 9 | Minimal Shared Tool Parity | Query through a tool | `registerOperationalTools.test.ts > should preserve shared UI query and rename outcomes through tools` | ✅ COMPLIANT |
| 10 | Minimal Shared Tool Parity | Edit through a tool | Same tool-parity test, including published renamed scenario | ✅ COMPLIANT |
| 11 | Safe Bypass and Lifecycle | Reject production bypass | `production-gate.spec.ts > should block a production build even when a bypass-like variable is set` against the bypass-like production build | ✅ COMPLIANT |
| 12 | Safe Bypass and Lifecycle | Unload registered tools | `WebMcpGate.test.tsx > should abort the active registration controller on unload`; failed-attempt retry test | ✅ COMPLIANT |
| 13 | Region and Fleet Identity | Load reproducible fleet | `spain-v1.test.ts > is repeatable, offline, and contains exactly fifteen unique plausible vehicles` | ✅ COMPLIANT |
| 14 | Region and Fleet Identity | Resolve an absent label | `spain-v1.test.ts > uses fleet number when an editable label is absent`; `FleetMap.test.ts` fallback assertion | ✅ COMPLIANT |
| 15 | Controlled Operational Data | Inspect fleet coverage | `spain-v1.test.ts > covers operational fields, all statuses, routes, and controlled risks` | ✅ COMPLIANT |
| 16 | Controlled Operational Data | Query vehicle context | Same fixture test; `VehicleDrawer.test.tsx > should show complete inspection fields...` | ✅ COMPLIANT |
| 17 | Static Risk Set | Display risk fixtures | Fixture test exact 3.9 m, 26 t, closure line, high-severity snow polygon, and deadline assertions | ✅ COMPLIANT |
| 18 | Static Risk Set | Remain offline deterministic | Repeatable/offline fixture test; no network-backed fixture path | ✅ COMPLIANT |
| 19 | Shared Typed Operations | Compare query callers | `overrideStorage.test.ts > keeps query results identical for independent callers...`; tool parity test | ✅ COMPLIANT |
| 20 | Shared Typed Operations | Rename through either caller | Tool parity test and `VehicleDrawer.test.tsx > should validate, save, and immediately publish...` | ✅ COMPLIANT |
| 21 | State Boundaries and Evolution | Clear transient selection | `OperationalShell.test.tsx > should coordinate replacement selection and close without mutating scenario data` | ✅ COMPLIANT |
| 22 | State Boundaries and Evolution | Inspect public names | Executed branding-neutral source guard passed for `src/domain` and `src/scenario`; lint/typecheck passed | ✅ COMPLIANT |
| 23 | Phase Boundary and Deliverability | Verify delivery boundary | Executed delivery guard passed Bun-command, MIT/public metadata, secret-scan, and documentation assertions; all quality commands passed | ✅ COMPLIANT |
| 24 | Phase Boundary and Deliverability | Review deferred capability | Exact-four-tools runtime test excludes `create_vehicle`/`assign_route`; executed documentation guard confirms both remain future/unavailable | ✅ COMPLIANT |
| 25 | Operational Inspection | Inspect a complete vehicle | `VehicleDrawer.test.tsx > should show complete inspection fields and compare vehicle height...`; desktop/tablet Playwright inspection | ✅ COMPLIANT |
| 26 | Operational Inspection | Render absent optional data | `VehicleDrawer.test.tsx > should use localized fallbacks for absent optional values` | ✅ COMPLIANT |
| 27 | Safe Label Edit Storage | Rename a vehicle | Drawer rename unit test and desktop Playwright immediate marker/reload flow | ✅ COMPLIANT |
| 28 | Safe Label Edit Storage | Recover invalid edits | Corrupt/obsolete and over-64 persisted-label fallback tests, both preserving `locale:v1` | ✅ COMPLIANT |
| 29 | Confirmed Scenario Deletion | Cancel deletion | `VehicleDrawer.test.tsx > should name the vehicle, leave it unchanged on cancel...`; desktop Playwright cancel flow | ✅ COMPLIANT |
| 30 | Confirmed Scenario Deletion | Confirm deletion | Same unit test and desktop Playwright confirm flow; vehicle, route, and drawer assertions passed | ✅ COMPLIANT |
| 31 | Primary Operational Map | Apply a fleet filter | `FleetMap.test.ts > should highlight filtered and selected context...`; desktop Playwright critical-filter activation | ✅ COMPLIANT |
| 32 | Primary Operational Map | Clear a fleet filter | Desktop Playwright second critical-filter click and `aria-pressed=false`; layer derivation restores all emphasis with no filter | ✅ COMPLIANT |
| 33 | Primary Operational Map | Operate without driver interaction | Operational workflow passes entirely from console controls; product boundary and source inspection confirm no driver-facing interaction | ✅ COMPLIANT |
| 34 | Selection Focus and Emphasis | Replace selected vehicle | `OperationalShell.test.tsx > should coordinate replacement selection...`; selected-layer derivation test | ✅ COMPLIANT |
| 35 | Selection Focus and Emphasis | Close inspection | Same coordination test; tablet Playwright close removes the dialog without domain mutation | ✅ COMPLIANT |
| 36 | Cancellable Follow | Cancel on user navigation | `FleetMap.test.ts > should preserve follow during programmatic focus and cancel it for manual navigation`; desktop pointerdown Playwright assertion | ✅ COMPLIANT |
| 37 | Cancellable Follow | Preserve programmatic follow | Same `MapEventCoordinator` runtime test verifies programmatic viewport movement does not cancel follow | ✅ COMPLIANT |

**Compliance summary**: 37/37 scenarios compliant; 18/18 requirements have passing implementation and runtime evidence.

### Correctness by Requirement

| Requirement | Status | Static evidence |
|---|---|---|
| Map-Dominant Shell | ✅ Implemented | `OperationalShell`, `Topbar`, responsive CSS, deferred drawer |
| Localized Catalog | ✅ Implemented | Typed `Catalog`, complete `en`/`es`, independent `locale:v1`, gate copy included |
| Filter Rail and Deferred Drawer | ✅ Implemented | Seven exact categories, deterministic counts, compact/expanded state |
| Production Capability Gate | ✅ Implemented | Ready-only child mount; unsupported/failed states expose cataloged explanation + Retry |
| Minimal Shared Tool Parity | ✅ Implemented | Four exact tools delegate to one injected `OperationsApi` |
| Safe Bypass and Lifecycle | ✅ Implemented | `import.meta.env.DEV && explicitFlag === "true"`; shared abort controller and unload cleanup |
| Region and Fleet Identity | ✅ Implemented | Fixed 15-vehicle Spain-region fixture with separate stable/display identities |
| Controlled Operational Data | ✅ Implemented | Routes, load, dimensions, timing, status, and risk fields present |
| Static Risk Set | ✅ Implemented | Exact controlled height, weight, closure, snow, and deadline fixtures |
| Shared Typed Operations | ✅ Implemented | Branding-neutral typed API over Zustand-backed repository |
| State Boundaries and Evolution | ✅ Implemented | Scenario repository is separate from transient UI coordination store |
| Phase Boundary and Deliverability | ✅ Implemented | Future capabilities absent; public MIT/Bun/no-secret/quality checks verified |
| Operational Inspection | ✅ Implemented | Full localized drawer/Dialog with risk comparison and fallbacks |
| Safe Label Edit Storage | ✅ Implemented | Shared normalized 1–64 invariant, validated versioned storage, whole-document fallback |
| Confirmed Scenario Deletion | ✅ Implemented | Named Radix confirmation, cancel no-op, persisted atomic vehicle/route removal |
| Primary Operational Map | ✅ Implemented | Leaflet/OSM labels, routes, risks, filtering, and context emphasis |
| Selection Focus and Emphasis | ✅ Implemented | Selection replacement, map focus, conditional drawer, UI-only close |
| Cancellable Follow | ✅ Implemented | Programmatic focus tagging, manual cancellation, explicit restore action |

### Coherence with Design

| Decision | Followed? | Notes |
|---|---|---|
| Single Bun/Vite React package | ✅ Yes | One package and one application root |
| Injected shared operations | ✅ Yes | UI and WebMCP use the same `OperationsApi` |
| Split domain and transient UI state | ✅ Yes | Zustand repository and UI coordination store remain separate |
| Stable UI primitives and map stack | ✅ Yes | Radix, Phosphor, Tailwind/Vite, React Leaflet, and OSM are used |
| Browser adapters and external validation | ✅ Yes | Storage, map events, and WebMCP seams are isolated; external challenge-browser validation remains explicit |
| Ready-only WebMCP gate | ✅ Yes | Console children mount only after all four registrations complete |
| Development-only bypass | ✅ Runtime design; ⚠️ docs drift | Production rejection passed, but public docs and `.env.example` name `VITE_WEBMCP_DEVELOPMENT_BYPASS` while code/tests use `VITE_WEBMCP_LOCAL_BYPASS` |

### Issues Found

**CRITICAL**: None.  
**WARNING**:
1. Public documentation is stale and internally inconsistent with the implemented candidate. `README.md`, `.env.example`, and `docs/architecture.md` name `VITE_WEBMCP_DEVELOPMENT_BYPASS`, but `App.tsx` consumes `VITE_WEBMCP_LOCAL_BYPASS`; the docs also still describe later work units as unimplemented. This does not break any required production behavior or tested scenario, but it weakens operator guidance and proposal-level documentation coherence.
2. Real OpenAI challenge-browser validation of `document.modelContext.registerTool` remains an explicit external release prerequisite. This verification used the documented local seam and does not claim challenge-browser success.

**SUGGESTION**: Refresh public status and bypass documentation in a separately authorized work unit before release; no implementation correction is required for this verification verdict.

### Native Settlement Handoff

- **diagnosis**: `PASS_WITH_WARNINGS: 18/18 requirements and 37/37 scenarios passed runtime-backed verification; both former CRITICAL failures independently pass; only documentation drift and the explicit external challenge-browser prerequisite remain.`
- **cleanup_evidence**: `Managed Vite dev/preview processes terminated; port 4173 is free; ignored build/test artifacts are excluded; product candidate tree remained 0f52bdc6f32251248247c0e07b61b46b5eba3a2d.`
- **process_evidence**: `Standard mode; orchestrator supplied the active runtime attempt; verifier did not acquire, reset, settle, remediate, delegate, commit, push, archive, or claim real challenge-browser validation; exact report bytes were admitted before hybrid persistence.`

### Verdict

**PASS WITH WARNINGS**

The corrected candidate independently satisfies all 18 requirements and all 37 scenarios with passing runtime evidence, including both former CRITICAL regressions. The remaining findings are non-blocking documentation/release-prerequisite risks.
