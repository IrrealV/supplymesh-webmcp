```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1dbaa7ccd8c5f9794bcc7b6074572532e8220248abbc48903dec6373f172a2da
verdict: pass
blockers: 0
critical_findings: 0
requirements: 16/16
scenarios: 58/58
test_command: env -u ORS_API_KEY bun run test
test_exit_code: 0
test_output_hash: sha256:10a413d4118ff24c7094ac078ce170b088eadfae9bade520bf0f578697af9b71
build_command: env -u ORS_API_KEY VITE_WEBMCP_LOCAL_BYPASS=true bun run build
build_exit_code: 0
build_output_hash: sha256:2299dc1c1b47437d79602b174c3771b0f39f02620cec6add9baa5b5f3c190efb
```

## Verification Report

**Change**: `phase-1-1-operational-console-redesign`  
**Version**: N/A  
**Mode**: Standard (`strict_tdd: false`)  
**Persistence**: Hybrid  
**Candidate commit**: `1d8577b09a26db6d2a59c48308b3cb9d4aeaccb1`  
**Candidate tree**: `943cfe008228fe76ea6473367c3f8302272ec655`  
**Baseline / merge base**: `d0856b8e31610cf4d5ceb7da997f151b73cba9f5`

### Completeness

| Metric | Value |
|---|---:|
| Requirements | 16/16 compliant |
| Scenarios | 58/58 compliant |
| Tasks total | 19 |
| Tasks complete | 19 |
| Tasks incomplete | 0 |
| Change state | Active, unarchived, unmerged |

### Build, Tests, and Runtime Evidence

| Check | Exact child command | Exit | Runtime result |
|---|---|---:|---|
| Lint | `env -u ORS_API_KEY bun run lint` | 0 | ESLint clean |
| Typecheck | `env -u ORS_API_KEY bun run typecheck` | 0 | `tsc -b` clean |
| Vitest | `env -u ORS_API_KEY bun run test` | 0 | 20 files, 82 tests passed |
| Route verification | `env -u ORS_API_KEY bun --no-env-file run routes:verify` | 0 | 15 routes, 45,577 coordinates, provider boundary clean |
| Operational Playwright | `env -u ORS_API_KEY PLAYWRIGHT_HTML_OPEN=never bun run test:e2e -- e2e/operational-console.spec.ts` | 0 | 7/7 passed |
| Production-gate Playwright | `env -u ORS_API_KEY PLAYWRIGHT_HTML_OPEN=never bun run test:e2e -- e2e/production-gate.spec.ts` | 0 | 1/1 passed |
| Native WebMCP | `env -u ORS_API_KEY bun run webmcp:verify-native` | 0 | Chromium 151.0.7922.169; native WebMCP PASS |
| Production build | `env -u ORS_API_KEY VITE_WEBMCP_LOCAL_BYPASS=true bun run build` | 0 | 4,715 modules transformed |
| Static guards | Inline Bun/Git candidate, fixture, secret, generated-output, Phase 2, screenshot, merge, and cleanup assertions | 0 | All guards passed |

The strict test command output is 436 bytes and hashes to `sha256:10a413d4118ff24c7094ac078ce170b088eadfae9bade520bf0f578697af9b71`. The complete lint/typecheck/Vitest/routes/operational/production/native runtime aggregate output is 2,296 bytes and hashes to `sha256:9daeb229dc3e129b06ebabe25411f7c4c454be85ecf578f54079ffc2a7754a27`. The build output is 732 bytes and hashes to `sha256:2299dc1c1b47437d79602b174c3771b0f39f02620cec6add9baa5b5f3c190efb`. Static guard output is 1,415 bytes and hashes to `sha256:dcd0372df2f0341e82cecbfddc503466ed0ee11746b3ea17d7ac10c67bbdba96`.

**Coverage**: No instrumented line/branch coverage command is configured. Behavioral scenario coverage is 58/58 through passing Vitest, Playwright, native Chromium, and independent visual inspection.

### Spec Compliance Matrix

| Requirement | Scenario | Passing evidence | Result |
|---|---|---|---|
| Map-Dominant Shell | Render operational desktop | `e2e/operational-console.spec.ts > should complete the desktop filters, map, inspection, locale, and restoration flows` | ✅ COMPLIANT |
| Map-Dominant Shell | Exclude unsupported chrome | `e2e/operational-console.spec.ts > should suppress nonessential motion and exclude prohibited or Phase 2 chrome` | ✅ COMPLIANT |
| Map-Dominant Shell | Respect reduced motion | Operational Playwright reduced-motion test; `OperationalShell.test.tsx > should define the desktop grid, operational tokens, focus, and reduced-motion fallback` | ✅ COMPLIANT |
| Map-Dominant Shell | Navigate shell semantics | Operational Playwright desktop/skip-link flow; `OperationalShell.test.tsx > should move keyboard focus from the skip link to the map workspace` | ✅ COMPLIANT |
| Localized Catalog | Change locale | Operational Playwright desktop locale/reload flow; `catalog.test.ts` | ✅ COMPLIANT |
| Localized Catalog | Switch back to English | Operational Playwright English restore/reload flow | ✅ COMPLIANT |
| Localized Catalog | Use the menu by keyboard | `OperationalShell.test.tsx > should switch the visible language immediately` uses Enter/ArrowDown/Enter | ✅ COMPLIANT |
| Filter Rail and Deferred Drawer | Toggle multiple filters | Operational Playwright two-filter flow; `filtering.test.ts > should union independent filters, deduplicate matches, and preserve exact priority` | ✅ COMPLIANT |
| Filter Rail and Deferred Drawer | Activate an overview card or reset filters | `OperationalOverview.test.tsx`; `FilterResults.test.tsx > should remove chips independently and restore All when the final chip is removed` | ✅ COMPLIANT |
| Filter Rail and Deferred Drawer | Select a result card | Operational Playwright result selection; `FilterResults.test.tsx > should distinguish OR context, render deduped cards, and select with one activation` | ✅ COMPLIANT |
| Filter Rail and Deferred Drawer | Restore contextual mode | Operational Playwright close/delete restoration; `OperationalShell.test.tsx` restoration tests | ✅ COMPLIANT |
| Filter Rail and Deferred Drawer | Render overview before selection | `OperationalShell.test.tsx > should render approved landmarks and overview chrome before selection` | ✅ COMPLIANT |
| Compatibility and Acceptance Boundary | Preserve the WebMCP contract | Native Chromium; operational Playwright four-tool parity; `registerOperationalTools.test.ts` | ✅ COMPLIANT |
| Compatibility and Acceptance Boundary | Preserve gate and lifecycle | Production-gate Playwright; native cleanup 4→0; `WebMcpGate.test.tsx` | ✅ COMPLIANT |
| Compatibility and Acceptance Boundary | Produce visual evidence | Operational Playwright six-state capture plus independent full-resolution inspection below | ✅ COMPLIANT |
| Compatibility and Acceptance Boundary | Exclude Phase 2 | Operational/production Playwright and static Phase 2 symbol/tool guards | ✅ COMPLIANT |
| Primary Operational Map | Apply OR fleet filters | Operational Playwright emphasis checks; `FleetMap.test.ts > should distinguish OR matches, muted context, selection, and selected z-order` | ✅ COMPLIANT |
| Primary Operational Map | Clear fleet filters | Operational Playwright and `FilterResults.test.tsx` final-chip reset | ✅ COMPLIANT |
| Primary Operational Map | Render base, markers, and risks | Operational Playwright 15 trucks/labels/routes, 19 risk symbols, attribution, and legend; map unit tests | ✅ COMPLIANT |
| Selection Focus and Emphasis | Select from any operational affordance | Operational Playwright result selection; `VehicleMarkerLayer.test.tsx` truck/label controls | ✅ COMPLIANT |
| Selection Focus and Emphasis | Replace selected vehicle | `useUiCoordinationStore.test.ts`; `OperationalShell.test.tsx > should coordinate replacement selection and close without mutating scenario data` | ✅ COMPLIANT |
| Selection Focus and Emphasis | Close inspection | Operational Playwright restoration and `OperationalShell.test.tsx` | ✅ COMPLIANT |
| Cancellable Follow | Cancel on drag or wheel | Operational Playwright real wheel event; `MapEventCoordinator.test.ts` | ✅ COMPLIANT |
| Cancellable Follow | Cancel on controls or pinch | `MapEventCoordinator.test.ts > should cancel follow for zoom-control/pinch navigation` | ✅ COMPLIANT |
| Cancellable Follow | Preserve programmatic follow | `MapEventCoordinator.test.ts > should preserve follow through overlapping programmatic focus and layout changes` | ✅ COMPLIANT |
| Cancellable Follow | Cancel on replacement selection | `MapEventCoordinator.test.ts` replacement-selection case; coordination-store replacement test | ✅ COMPLIANT |
| Spain Viewport and Selected Route Context | Preserve a usable viewport | Operational Playwright desktop/tablet containment and map redraw flows; map tests | ✅ COMPLIANT |
| Spain Viewport and Selected Route Context | Highlight selected route risk | Operational Playwright selected corridor/risk assertions | ✅ COMPLIANT |
| Spain Viewport and Selected Route Context | Expose layer meaning | Operational Playwright five legend items; `MapLegend.test.tsx` | ✅ COMPLIANT |
| Operational Inspection | Inspect a complete vehicle | Operational Playwright inspection hierarchy; `VehicleInspection.test.tsx > should render hierarchical operational context without raw keys or ISO values` | ✅ COMPLIANT |
| Operational Inspection | Render absent optional data | `VehicleInspection.test.tsx > should use localized fallbacks for absent optional values` | ✅ COMPLIANT |
| Operational Inspection | Humanize localized values | Operational Playwright locale flow; `formatters.test.ts`; Spanish inspection test | ✅ COMPLIANT |
| Operational Inspection | View and follow route | Operational Playwright real view/wheel/follow flow; `VehicleInspection.test.tsx` | ✅ COMPLIANT |
| Safe Label Edit Storage | Rename a vehicle | Operational Playwright rename/reload; inspection and override-storage tests | ✅ COMPLIANT |
| Safe Label Edit Storage | Reject invalid label | Operational and native invalid-label checks; inspection test | ✅ COMPLIANT |
| Safe Label Edit Storage | Recover invalid edits | `overrideStorage.test.ts` corrupt, obsolete, and overlength recovery cases | ✅ COMPLIANT |
| Confirmed Scenario Deletion | Cancel deletion | Operational Playwright and `VehicleInspection.test.tsx` | ✅ COMPLIANT |
| Confirmed Scenario Deletion | Confirm deletion | Operational Playwright; `overrideStorage.test.ts > deletes a vehicle and its route atomically` | ✅ COMPLIANT |
| Confirmed Scenario Deletion | Restore context after deletion | Operational Playwright focused results-heading assertion; shell restoration test | ✅ COMPLIANT |
| Region and Fleet Identity | Load reproducible fleet | `spain-v1.test.ts > is repeatable, offline, and contains exactly fifteen unique plausible vehicles` | ✅ COMPLIANT |
| Region and Fleet Identity | Resolve an absent label | `spain-v1.test.ts` and `FleetMap.test.ts` fallback-label tests | ✅ COMPLIANT |
| Controlled Operational Data | Inspect fleet coverage | `spain-v1.test.ts > covers operational fields, all statuses, routes, and controlled risks` | ✅ COMPLIANT |
| Controlled Operational Data | Query vehicle context | `spain-v1.test.ts`; shared API parity tests | ✅ COMPLIANT |
| Controlled Operational Data | Render deterministic corridors | Route verifier, `spain-v1.test.ts`, and `FleetMap.test.ts` exact-coordinate identity | ✅ COMPLIANT |
| Controlled Operational Data | Derive a position from route progress | `routeRuntime.test.ts`; `spain-v1.test.ts` endpoint derivation | ✅ COMPLIANT |
| Static Risk Set | Display risk fixtures | `spain-v1.test.ts` risk coverage; operational Playwright 19 risk symbols | ✅ COMPLIANT |
| Static Risk Set | Remain offline deterministic | Key-unset route verification and repeatable offline scenario test | ✅ COMPLIANT |
| Static Risk Set | Align risk to corridor | `spain-v1.test.ts` symmetric snap checks and independent exact-index guard | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Generate an authenticated HGV route | `generate-ors-routes.test.ts > should pass route-014 radiuses unchanged while omitting defaults and preserving logical coordinates` | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Reject unusable generation input or output | Generator missing-key, malformed, and surplus-response tests | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Review generated route fixtures | Key-unset route verifier and provenance checks | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Pass canonical endpoint radiuses to ORS | Generator exact passthrough test | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Reject invalid radius input | Generator parameterized invalid-radius tests | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Hash geometry-affecting radius input | Generator canonical source-revision sensitivity test | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Generate route-014 with its measured snap bound | Generator route-014 success test and checked-in `[547,350]` guard | ✅ COMPLIANT |
| Reproducible HGV Route Generation | Prohibit pre-snapped route substitution | Generator logical/returned endpoint separation test and exact geometry verification | ✅ COMPLIANT |
| Route Fixture Verification and Documentation | Verify runtime and fixture invariants | Key-unset verifier, scenario/runtime/map tests, and fixture/domain guard | ✅ COMPLIANT |
| Route Fixture Verification and Documentation | Verify generation boundary and evidence | Generator tests, `docs/route-fixtures.md` inspection, checked-in-fixture-only map/visual tests | ✅ COMPLIANT |

**Compliance summary**: 58/58 scenarios and 16/16 requirements are compliant.

### Correctness and Architecture Boundary

| Contract | Status | Independent evidence |
|---|---|---|
| React → `OperationsApi` → `ScenarioRepository` | ✅ Implemented | `App` creates only `OperationsApi`; `VehicleInspection` calls `scenarioCurrent`, `vehicleRename`, and `vehicleDelete`; repository mutation remains inside `createOperationsApi` and `createZustandScenarioRepository`. |
| Transient UI state is separate | ✅ Implemented | `useUiCoordinationStore` contains filters, context, selection, follow, rail, and focus only; scenario entities/overrides remain in the repository. |
| No arbitrary React repository mutation | ✅ Implemented | Production React features import `OperationsApi`, not `ScenarioRepository`; CodeGraph found repository writes only behind domain operations. |
| ORS generation is process-key-only | ✅ Implemented | Package script uses `--no-env-file`; entry reads only `process.env.ORS_API_KEY`; missing-key tests stop before HTTP/write; no tracked env file or secret-like value was found. |
| Canonical hash and no-op | ✅ Implemented | Tests pass for radius/input/geometry sensitivity, volatile exclusions, `-0`, and byte/timestamp-preserving unchanged output. |
| Versioned route provenance | ✅ Implemented | 15 `driving-hgv` routes, 45,577 coordinates, fixture schema v1, source revision `16e995...acc439`; fixture SHA-256 `977629...b0e`. |
| Route-014 radius contract | ✅ Implemented | Manifest alone carries `[547,350]`; all other routes omit radiuses; logical/returned endpoints remain separate. |
| `routeId` / `routeProgress` and snapped risks | ✅ Implemented | 15 bounded progress values resolve against 15 routes; exact snap indices/coordinates pass tests and guard execution. |
| Offline runtime | ✅ Implemented | Route verifier rejects runtime `ORS_API_KEY`, script imports, and `fetch`; browser runtime uses checked-in fixtures and token-free OSM tiles only. |
| Exact WebMCP surface | ✅ Implemented | Native Chromium registered exactly four unchanged tools before render, validated four schemas and JSON text envelopes, proved query/edit/UI parity and structured invalid-label, restored rename, cleaned 4→0, and reported zero errors. |
| Phase 2 exclusion | ✅ Implemented | No prohibited controls/symbols, no runtime routing/provider path, and no additional WebMCP tool. |

### ORS Contract Evidence

- `routes:generate` is `bun run --no-env-file scripts/generate-ors-routes.ts generate`; generation requires `process.env.ORS_API_KEY` before request or write.
- ORS requests are sequential authenticated POSTs to `/v2/directions/driving-hgv/geojson`, preserve `[longitude, latitude]`, omit alternatives, and forward only configured radiuses.
- Canonical source material includes materialized radius input and exact returned coordinates; unchanged source revision is a byte/timestamp no-op.
- Checked-in output: 15 routes, 45,577 exact coordinates, 998,978 bytes, file SHA-256 `977629e48cb9266eb167b095085f6768bc7f94ffec44f9650210cca979ad6b0e`.
- Runtime and static guards ran with `ORS_API_KEY` unset. No tracked `.env`, secret-like value, generated build/test output, runtime ORS client, or provider fetch path was found.

### Native Chromium WebMCP

`scripts/validate-native-webmcp.ts` launches `/usr/bin/chromium` with exactly `args: ["--enable-features=WebMCP"]`, headless mode, and no init script, seam, polyfill, request interception, route interception, or bypass. Runtime result:

```json
{"browser":"151.0.7922.169","cleanup":"4→0","errors":0,"registrationBeforeRender":true,"schemas":4,"tools":["fleet_status","scenario_current","vehicle_get","vehicle_rename"]}
```

### Independent Visual Inspection

All six tracked PNGs were opened and inspected independently at their native useful resolution before consulting `visual-comparison.md`. Their IHDR dimensions and full-byte SHA-256 values were then verified independently.

| State | Dimensions | SHA-256 | Independent verdict |
|---|---:|---|---|
| Desktop operational overview | 1440×900 | `ed658a06b9b58634e686e370c9b387ba881280688814f72bc38d8157c071de5a` | PASS: professional map-dominant hierarchy, 15 readable labels, compact risks, overview context |
| Desktop Weather affected | 1440×900 | `aaf209887f4342486522ae216397820d18a7c57fb5171e5bb6e37b2af85c6c3e` | PASS: expanded rail, three results, matched weather emphasis, readable secondary context |
| Desktop selected route/risk | 1440×900 | `137a926f1ece889b81c15837e45c9ef06639e76e92801c5db01fa6450517e707` | PASS: plausible Barcelona→Valencia corridor, selected route/risk, inspection hierarchy |
| Desktop two active filters | 1440×900 | `6432b98154f1af7a28f31d4421226ecc28e39113dc2681688d738229c6cadfd3` | PASS: two chips, five deduplicated ordered results, severity and map context remain legible |
| Tablet filter results | 900×900 | `74b4779ac682cdd23233b403c2092468605f17ceb604d5f5d6624895134231dd` | PASS: contained results dialog, dimmed contextual map, usable rail and attribution |
| Tablet vehicle detail | 900×900 | `3ce0b2a0194c0f79ced7906b97fe9ecd7d98dfb650120d4611a5af6cb5a7ac8d` | PASS: contained 560×720 inspection, readable identity/summary/risks, scroll-tested tabs/actions |

Across all states, labels and compact risks are readable without observed collisions; the selected route follows plausible road geometry; context panels and selected inspection match the written brief; exactly four desktop and two tablet states are present; and no gradients, glassmorphism, giant decorative metrics, sparkles, canvas substitution, bottom bar, agent/chat chrome, or Phase 2 control appears.

**Visual verdict**: PASS. Non-blocking limitations are the intentionally narrow contextual map behind tablet results, required scrolling to reach lower tablet-detail actions, and wide deterministic label offsets in the densest desktop overview.

### Design Coherence

| Decision | Followed? | Notes |
|---|---|---|
| Preserve application/repository boundary | ✅ Yes | Operations API remains the only React mutation path. |
| UI-only coordination store | ✅ Yes | Scenario data is absent from transient UI state. |
| Checked-in ORS HGV fixtures only at runtime | ✅ Yes | Generation and runtime boundaries are separated and tested. |
| `routeId` + `routeProgress` position model | ✅ Yes | Position and endpoint behavior pass runtime tests. |
| Desktop and tablet layout contracts | ✅ Yes | Four desktop and two tablet states pass visual/runtime checks. |
| Exact WebMCP compatibility | ✅ Yes | Four tools, schemas, envelope, gate, lifecycle, and bypass behavior pass. |
| Feature-branch chain and scope boundary | ✅ Yes | Branch remains `test/phase1-1-release-evidence`; no merge commit, main change, archive, or Phase 2 work. |

### Evidence, Cleanup, and Settlement

- Candidate identity remained `1d8577b09a26db6d2a59c48308b3cb9d4aeaccb1` / tree `943cfe008228fe76ea6473367c3f8302272ec655` throughout execution.
- Screenshot-writing operational Playwright ran in a disposable detached exact-HEAD worktree because live OSM tile rendering changes PNG bytes between captures. The worktree was removed; the six canonical tracked PNG bytes and generated fixture bytes in the candidate were never modified.
- Primary worktree was clean before report persistence; port 4173 was free; managed dev/preview processes and native Chromium were stopped.
- Receipt-driven review remained off. No receipt, merge, archive, push, PR, or Phase 2 action ran.
- Settlement strings: `native_attempt=already-acquired`; `acquire=NOT_RUN`; `reset=NOT_RUN`; `settle=NOT_RUN`.

### Canonical Verification-Evidence Preimage

The following single-line UTF-8 JSON is the exact canonical evidence preimage whose SHA-256 is the envelope `evidence_revision`:

```json
{"buildOutputHash":"sha256:2299dc1c1b47437d79602b174c3771b0f39f02620cec6add9baa5b5f3c190efb","candidateCommit":"1d8577b09a26db6d2a59c48308b3cb9d4aeaccb1","candidateTree":"943cfe008228fe76ea6473367c3f8302272ec655","fixtureHash":"sha256:977629e48cb9266eb167b095085f6768bc7f94ffec44f9650210cca979ad6b0e","fixtureSourceRevision":"sha256:16e9952c577cfcc7de3e1cd8bfbc1ea068557c049d5674052b3b1e74fcacc439","guardOutputHash":"sha256:dcd0372df2f0341e82cecbfddc503466ed0ee11746b3ea17d7ac10c67bbdba96","native":{"browser":"151.0.7922.169","cleanup":"4→0","errors":0,"registrationBeforeRender":true,"schemas":4,"tools":["fleet_status","scenario_current","vehicle_get","vehicle_rename"]},"requirements":16,"runtimeAggregateOutputHash":"sha256:9daeb229dc3e129b06ebabe25411f7c4c454be85ecf578f54079ffc2a7754a27","scenarios":58,"schema":"supplymesh.final-verification-evidence/v1","screenshots":[{"file":"desktop-overview.png","hash":"ed658a06b9b58634e686e370c9b387ba881280688814f72bc38d8157c071de5a","height":900,"width":1440},{"file":"desktop-weather-filter.png","hash":"aaf209887f4342486522ae216397820d18a7c57fb5171e5bb6e37b2af85c6c3e","height":900,"width":1440},{"file":"desktop-selected-route-risk.png","hash":"137a926f1ece889b81c15837e45c9ef06639e76e92801c5db01fa6450517e707","height":900,"width":1440},{"file":"desktop-two-filters.png","hash":"6432b98154f1af7a28f31d4421226ecc28e39113dc2681688d738229c6cadfd3","height":900,"width":1440},{"file":"tablet-results.png","hash":"74b4779ac682cdd23233b403c2092468605f17ceb604d5f5d6624895134231dd","height":900,"width":900},{"file":"tablet-detail.png","hash":"3ce0b2a0194c0f79ced7906b97fe9ecd7d98dfb650120d4611a5af6cb5a7ac8d","height":900,"width":900}],"tasks":19,"testOutputHash":"sha256:10a413d4118ff24c7094ac078ce170b088eadfae9bade520bf0f578697af9b71","visualVerdict":"PASS"}
```

### Issues Found

**CRITICAL**: None.  
**WARNING**: The production bundle remains 1,521.58 kB (497.20 kB gzip) and Vite emits its existing >500 kB chunk advisory. This does not violate a specified acceptance threshold.  
**SUGGESTION**: Canonical JSON/hash behavior is well covered by examples; property-based invariants could strengthen future generator changes if the project later adopts `fast-check`.

### Verdict

**PASS**

All 19 tasks are complete; all 16 requirements and 58 scenarios have passing implementation/runtime evidence; architecture, ORS, WebMCP, visual, scope, secret, generated-output, and cleanup guards pass. The change remains active, unarchived, and unmerged.
