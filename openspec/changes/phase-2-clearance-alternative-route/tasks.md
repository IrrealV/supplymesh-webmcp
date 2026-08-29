# Tasks: Phase 2 Clearance Alternative Route

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | PR 1: 291 planning; PR 2: ~354 manual; GeoJSON excluded |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 tracker→main; PR 2 implementation→tracker |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Apply Guard

Keep each PR’s manual source, test, docs, and manifest diff below 400 lines; if it reaches 400 or forecasts above 400, STOP before commit/push and return blocked. Report GeoJSON bytes/formatting separately; no `size:exception` is granted or needed.

### PR Boundaries

PR 1: `feat/phase2-clearance-alternative-route` → `main`, only the existing 291-line OpenSpec planning commit, left unmerged. PR 2: `feat/phase2-clearance-alternative-route-implementation` → tracker, implementation/tests/docs plus generated GeoJSON; it may merge into tracker after checks. The tracker PR then reflects the candidate and remains unmerged to `main`.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Review the existing OpenSpec plan | PR 1: tracker → `main` | `git diff --check -- openspec/changes/phase-2-clearance-alternative-route` | N/A — planning artifacts only | Revert only the 291-line planning commit. |
| 2 | Implement one inert clearance fixture | PR 2: implementation → tracker | `bun run test -- scripts/generate-clearance-alternative-route.test.ts src/scenario/fixtures/clearanceAlternativeCatalog.test.ts` | `ORS_API_KEY=<secret> bun --no-env-file run routes:clearance:generate`, then keyless `bun --no-env-file run routes:clearance:verify` | Delete six new script/fixture/catalog files; revert exports, scripts, docs; recheck hashes. |

## Phase 1: RED Contract Tests

- [x] 1.1 Create `scripts/generate-clearance-alternative-route.test.ts` RED cases for fixed route/vehicle/risk/endpoints, one candidate/feature, and Turf’s closed 250 m, 64-edge (65-coordinate) polygon from snap 537 `[-3.897481,40.149232]`.
- [x] 1.2 Add RED cases for unchanged retry body/candidate on 429/5xx, four-attempt exhaustion, missing key/provider/malformed output, and failure preserving accepted fixture bytes.
- [x] 1.3 Add RED admission cases for source drift before HTTP; fewer than three coordinates, touch/intersection, non-positive clearance, endpoint drift, invalid summaries, canonical payload tampering/revision mismatch, and verified-revision byte/mtime no-op.
- [x] 1.4 Create `src/scenario/fixtures/clearanceAlternativeCatalog.test.ts` RED cases for deep immutability, offline/keyless loading, secret/log absence, protected hashes, and exclusion scans of `src/app/**`, `src/features/**`, `src/domain/operations/**`, `src/platform/webmcp/**`, and `spain-v1.ts`.

## Phase 2: Generation and Admission

- [x] 2.1 Export only unchanged shared ORS request/retry and atomic-write primitives plus `canonicalSha256` from `scripts/routes/generator.ts`; retain current callers and protected fixture bytes.
- [x] 2.2 Add `clearance-alternative-route-v1.manifest.json` and `scripts/generate-clearance-alternative-route.ts`; guard revision `16e9952c577cfcc7de3e1cd8bfbc1ea068557c049d5674052b3b1e74fcacc439`, 1,120 coordinates, endpoints/summary/snap, derive the exact polygon, and fail closed before atomic write.
- [x] 2.3 Implement one `driving-hgv` POST without radiuses/`alternative_routes`; admit only a disjoint, positively clear, canonical feature within 350 m and 2× bounds, with no key persistence or logging.

## Phase 3: Offline Evidence

- [x] 3.1 Generate and verify `clearance-alternative-route-v1.geojson` with one feature and required relation/provenance; keep its generated data identity separate from the manual-line budget.
- [x] 3.2 Add `clearanceAlternativeCatalog.ts` importing the fixture and deeply freezing only relation, geometry, summary, and provenance; make every Phase 1 RED case GREEN.
- [x] 3.3 Add `routes:clearance:generate` and `routes:clearance:verify` in `package.json`; document process-only-key regeneration, keyless verification, no hand edits, and no runtime consumption in `docs/route-fixtures.md`.

## Phase 4: Verification and Delivery Boundary

- [x] 4.1 Run focused tests; `bun --no-env-file run routes:clearance:verify`, `bun --no-env-file run routes:verify`, `bun run check`, guards, and `bunx tsc --noEmit` on both tests without `any`/ignores.
- [x] 4.2 Keep all changes in this one reversible batch for issue #26; rollback exactly the Unit 1 boundary and do not alter Phase 2 UI, WebMCP, runtime routing, or other artifacts.
