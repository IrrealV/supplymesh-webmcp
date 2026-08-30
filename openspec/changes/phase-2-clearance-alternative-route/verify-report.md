```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:afdd8628ec16a6b792668aafdb054eb8ff57a3e95787593a160d493bc0254d5f
verdict: pass
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 8/8
test_command: bun run test -- scripts/generate-clearance-alternative-route.test.ts src/scenario/fixtures/clearanceAlternativeCatalog.test.ts
test_exit_code: 0
test_output_hash: sha256:56091dda59c0ede264c4ee5dd1c13299046a30977e84d49e4db9faadc1bd9577
build_command: bunx tsc --noEmit --target ES2023 --module ESNext --moduleResolution Bundler --lib ES2023,DOM,DOM.Iterable --types node,vite/client,vitest/globals --skipLibCheck --allowImportingTsExtensions --esModuleInterop --allowSyntheticDefaultImports scripts/generate-clearance-alternative-route.test.ts src/scenario/fixtures/clearanceAlternativeCatalog.test.ts
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: `phase-2-clearance-alternative-route` · **Mode**: Standard (`strict_tdd: false`) · **Persistence**: Hybrid  
**Candidate/result tree**: commit `d7799805329cb89a8a217aaaa1ed8073ba293159`, tree `8dcef4104c460a0f3459f8c36cbd577571a89b97`, baseline `4c2bc64120cef43f344c769a3cc52cf2675ef56c`  
**Remediation**: failed evidence `sha256:19595960ddc5496112f984726d2dbf74171df3b374c0d8c4af56a3cb947e34fb` remediated by commit `d7799805329cb89a8a217aaaa1ed8073ba293159` / evidence `sha256:f2e3e9d1b0cb4ff933f9a3fc18fd9acdfe2e94965574ba5e1b69aa71cef0cbf1`.  
**Native attempt**: ordinal 5/generation 5, objective `sha256:fce13da4b505be1ba99210baf3bc662d19562851d79de13598e7f40cdb8d3c3b`, revision `sha256:d1f761cc5c9640a359d41bc097c0bb0fd7cf057c1a10c39705f56be42bfa0842`; already acquired, not acquired/reset/settled here.

### Completeness
| Metric | Result |
|---|---|
| Requirements | 4/4 implemented |
| Scenarios | 8/8 runtime-compliant |
| Tasks | 12/12 independently verified |
| Coverage | Not configured; no threshold or coverage command |

### Executed Evidence
| Check | Exit | Exact result / output hash |
|---|---:|---|
| Focused tests: `bun run test -- scripts/generate-clearance-alternative-route.test.ts src/scenario/fixtures/clearanceAlternativeCatalog.test.ts` | 0 | 2 files, 17 tests; `sha256:56091dda59c0ede264c4ee5dd1c13299046a30977e84d49e4db9faadc1bd9577` |
| Direct test typecheck: envelope `build_command` | 0 | No diagnostics; empty output `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Alternative verify: `bun --no-env-file run routes:clearance:verify` | 0 | 1 feature, 743 coordinates, 80,298.9 m, 5,282.5 s, 5,724.858608 m clearance; `sha256:b83e7cbaaed91bf3d2a9e7c1b7b0ec71f69ce1f215fb1039da3314eb90c610be` |
| Main routes: `bun --no-env-file run routes:verify` | 0 | 15 routes, 45,577 coordinates, runtime boundary clean; `sha256:a7ea77144ce5a2cec7464f959d0660bdce7d2277a5e51a123690d1464c4bc1de` |
| Full gate: `bun run check` | 0 | lint, project typecheck, 22 files/109 tests, build; `sha256:a455cf38be5cd7c0e60ef1419585f261cfa2cbb22a5f21154715c9129ec8ba8c` |
| Diff: `git diff --check 4c2bc64120cef43f344c769a3cc52cf2675ef56c..d7799805329cb89a8a217aaaa1ed8073ba293159` | 0 | Empty output; `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Key/cleanup | 0 | `ORS_API_KEY` absent; only `.env.example` tracked; no workspace `*.tmp-*`; only the expected prior report was untracked before admitted replacement |

### Spec Compliance Matrix
| Requirement / scenario | Passing runtime evidence | Result |
|---|---|---|
| Deterministic generation / Generate fixed alternative | Exact-body/retry/one-feature focused test plus checked fixture verify | ✅ COMPLIANT |
| Deterministic generation / Reject changed identities | Source-drift-before-HTTP test plus fixed vehicle/risk/route/snap/endpoints guards | ✅ COMPLIANT |
| Fixture plausibility / Admit disjoint result | Focused success and keyless verifier recomputed provenance, geometry, summaries and clearance | ✅ COMPLIANT |
| Fixture plausibility / Reject invalid geometry | Parameterized count/contact/endpoint/summary rejection tests | ✅ COMPLIANT |
| Fail-closed / Preserve accepted fixture | Missing-key/provider/retry/malformed/validation and atomic-rename preservation tests | ✅ COMPLIANT |
| Fail-closed / Protected fixtures | Runtime hash test and main-route verifier | ✅ COMPLIANT |
| Offline consumption / Load in-scope relation | Deep-freeze/offline/keyless catalog test | ✅ COMPLIANT |
| Offline consumption / Review boundary | Consumer exclusion scan and documentation test evidence | ✅ COMPLIANT |

### Correctness and Design Coherence
| Contract | Independent evidence | Status |
|---|---|---|
| Exact relation | Unit 211/FM-211, `vehicle-011`, `route-011`, high 3.9 m risk, snap 537 `[-3.897481,40.149232]`, one `alternative-route-011-clearance-v1` | ✅ |
| Route comparison | Current 99,706.6 m/5,292.1 s/1,120; alternative 80,298.9 m/5,282.5 s/743; ratios 0.805352/0.998186; snaps 4.539/95.220 m | ✅ |
| Avoidance | Closed 250 m/64-edge/65-coordinate polygon; intersects/touches=false; route/polygon margins 5,726.080/5,724.859 m; positive two-way minimum 5,724.859 m | ✅ |
| ORS boundary | One `driving-hgv` body; no radiuses/alternatives; 429/5xx bounded retries; canonical revision/no-op; fail-closed admission; shared atomic rename | ✅ |
| Protected/runtime boundary | Main SHA-256 `65172c...7ba3f`/`977629...b0e`; catalog is frozen/offline and excluded from App/UI/features/OperationsApi/WebMCP/scenario composition | ✅ |
| Scope/review budget | No comparison/staging/apply/movement/tools/runtime routing/other alternatives; 297 manual candidate lines + this 83-line report = 380; generated GeoJSON 1 line/19,882 bytes, SHA-256 `93e115...20ea` | ✅ |

### Issues Found
**CRITICAL**: None.  
**WARNING**: None.  
**SUGGESTION**: Canonical/no-op and geometry invariants are good future property-based-test candidates, but `fast-check` is not installed and no dependency or scope expansion was authorized.

### Canonical Verification-Evidence Preimage
The exact no-trailing-newline UTF-8 preimage below hashes to the envelope `evidence_revision`:
```json
{"alternativeFixtureHash":"sha256:93e115fe3b95a4dc6acb1d478031cf2d7dc7451a2d4c438819cd748774d320ea","alternativeVerifyOutputHash":"sha256:b83e7cbaaed91bf3d2a9e7c1b7b0ec71f69ce1f215fb1039da3314eb90c610be","baselineCommit":"4c2bc64120cef43f344c769a3cc52cf2675ef56c","buildOutputHash":"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","candidateCommit":"d7799805329cb89a8a217aaaa1ed8073ba293159","candidateTree":"8dcef4104c460a0f3459f8c36cbd577571a89b97","diffCheckOutputHash":"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","failedEvidenceRevision":"sha256:19595960ddc5496112f984726d2dbf74171df3b374c0d8c4af56a3cb947e34fb","focusedTestOutputHash":"sha256:56091dda59c0ede264c4ee5dd1c13299046a30977e84d49e4db9faadc1bd9577","fullCheckOutputHash":"sha256:a455cf38be5cd7c0e60ef1419585f261cfa2cbb22a5f21154715c9129ec8ba8c","geometryOutputHash":"sha256:2a071618c8380f441f4c64dc27d220cb74c2fcf131ed55212a256fce16f73b88","remediationEvidenceRevision":"sha256:f2e3e9d1b0cb4ff933f9a3fc18fd9acdfe2e94965574ba5e1b69aa71cef0cbf1","requirements":4,"routesVerifyOutputHash":"sha256:a7ea77144ce5a2cec7464f959d0660bdce7d2277a5e51a123690d1464c4bc1de","runtimeAttempt":{"generation":5,"objectiveId":"sha256:fce13da4b505be1ba99210baf3bc662d19562851d79de13598e7f40cdb8d3c3b","ordinal":5,"revision":"sha256:d1f761cc5c9640a359d41bc097c0bb0fd7cf057c1a10c39705f56be42bfa0842"},"scenarios":8,"schema":"supplymesh.final-verification-evidence/v1","tasks":12,"testOutputHash":"sha256:56091dda59c0ede264c4ee5dd1c13299046a30977e84d49e4db9faadc1bd9577","verdict":"PASS"}
```

### Native Settlement Handoff
- `diagnosis`: `PASS: 4/4 requirements, 8/8 scenarios and 12/12 tasks pass independent runtime and direct-type verification after focused remediation.`
- `harness_disposition`: `reused`
- `cleanup_evidence`: `No ORS key or temporary files/processes remained; generated/protected fixture bytes stayed unchanged; only the admitted report replaced its prior failed bytes.`
- `process_evidence`: `Standard mode; candidate d779980/8dcef41; direct typecheck, focused 17 tests, both route verifiers, full 109 tests/build, hashes, secret/exclusion/diff and cleanup guards pass; verifier did not acquire, reset, settle, fix, commit, push, PR, merge, archive, or expand Phase 2.`

### Verdict
**PASS** — All 4 requirements, 8 scenarios and 12 tasks have passing independent evidence; the former direct-type blocker is remediated.
