# Archive Report: Phase 2 Clearance Alternative Route

## Closure

- **Change:** `phase-2-clearance-alternative-route`
- **Archived:** 2026-08-30
- **Persistence:** Hybrid (OpenSpec + Engram)
- **Final verdict:** PASS
- **Requirements/scenarios:** 4/4 change requirements; 8/8 scenarios
- **Tasks:** 12/12 complete; zero unchecked implementation tasks
- **Blockers/CRITICAL findings:** 0/0
- **Approved issue:** #29
- **Baseline:** `68b4ed1c10ec6d53430c9172196febdcaf14c447`
- **Merged implementation:** PR #27 at `4cbd849`; PR #28 at `68b4ed1`; issue #26 closed

The four `deterministic-fleet-scenario` delta requirements were merged into the existing root spec by exact requirement name. All five Phase 1.1 requirements and unrelated root content were preserved. No other root spec changed.

## Final Evidence

- Unit 211 / FM-211 remains `vehicle-011` on `route-011`; current checked-in route evidence is 99,706.6 m, 5,292.1 s, and 1,120 coordinates.
- The alternative evidence is one `driving-hgv` feature: 80,298.9 m, 5,282.5 s, 743 coordinates, and 5,724.858608 m positive clearance.
- Final verification is PASS: 4/4 requirements, 8/8 scenarios, 12/12 tasks; focused tests, typecheck, route verifiers, full check, and build passed.
- Later merged evidence commit `5eddd9a` records the verdict **VALID BUT WEAK FOR DEMO**. This is a limitation of demo strength, not an archive blocker.
- Active evidence remains in `main` via `clearance-alternative-route-v1.geojson`, the Unit 211 catalog relation, comparison PNG/report, and the archived `verify-report.md`.

## Spec Synchronization

| Domain | Action | Result |
|---|---|---|
| `deterministic-fleet-scenario` | Updated | 9 final requirements: existing 5 preserved plus 4 added; all 8 new scenarios present |

Only this root spec was modified. No runtime, routes, GeoJSON, generator, domain, UI, WebMCP, tests, dependencies, or evidence files were changed.

## Archived Contents

- `exploration.md`
- `proposal.md`
- `specs/deterministic-fleet-scenario/spec.md`
- `design.md`
- `tasks.md` — 12/12 complete
- `apply-progress.md`
- `verify-report.md` — PASS
- `archive-report.md`

The active change path is absent. The closeout branch is `chore/phase2-clearance-alternative-archive`; its single small closeout PR remains unmerged. No next Phase 2 batch was started.

## Mechanical Readback

The full active change was snapshotted before `git mv` and compared recursively after the move.

Exact `diff -r` output:

```text
(no output)
```

## Engram Traceability

Observations read for this archive:

- `#20314` — exploration
- `#20315` — proposal
- `#20316` — spec
- `#20322` — design
- `#20332` — tasks
- `#20347` — apply-progress
- `#20360` — verify-report

Archive report persisted as `#20407` (`obs-73f3c6b4563587f6`). RDD was off and `reviewGate` was structurally absent; no review observations were read. Archive proceeded under ordinary policy.

## Limitations

The alternative is valid but weak for demo presentation per `5eddd9a`; no further batch or runtime integration is included. The closeout PR is intentionally unmerged.
