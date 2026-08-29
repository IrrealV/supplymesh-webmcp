# Apply Progress: Phase 2 Clearance Alternative Route

**Status**: 12/12 tasks complete · Standard mode with explicit RED→GREEN contract tests · feature-branch-chain implementation slice targeting `feat/phase2-clearance-alternative-route`

## Immutable Metadata

| Field | Value |
|---|---|
| Base / tracker | `4c2bc64120cef43f344c769a3cc52cf2675ef56c` / PR #27 (unmerged) |
| Relation | `vehicle-011` · `route-011` · `restriction-height-3.9` · `alternative-route-011-clearance-v1` |
| Polygon | Turf geodesic circle · 250 m · 64 edges · 65 closed coordinates · snap 537 `[-3.897481,40.149232]` |
| Provider | openrouteservice `driving-hgv`; one logical candidate and one feature |
| Generated | `2026-08-29T14:31:47.453Z` · manifest `799fa77b21d28766073a9140e8f90a0a4f0491df7660e2d9073c782e22f29eee` |
| Source revision | `688161cb725d59117a55243b78e41b8191e5b0d718f7eff0c51fe783e680fdd0` |
| Protected revisions | current source `16e9952c577cfcc7de3e1cd8bfbc1ea068557c049d5674052b3b1e74fcacc439`; manifest `65172c3ae47fe52d97c41b9a811c9088fb464c3124a54367c17ecfd674b7ba3f`; routes `977629e48cb9266eb167b095085f6768bc7f94ffec44f9650210cca979ad6b0e` |
| Initial implementation | parent `4c2bc64120cef43f344c769a3cc52cf2675ef56c`; commit `4f99f4c98077b6fbcadc77f1cd46a5394efe997a`; tree `eef7310274635a4d3fefc39861af0190474363db`; evidence `sha256:fe448372f029d802c9c9ca9f9a89f6d4031c6e32fe8a832ef8869f84183845f7` |
| Correction attempt | native ordinal 2 / generation 2 / objective `sha256:f282113c1b3e11ba744cb419326ab33d76974559acf6c369f542cdb5c818f687`; begin tree `eef7310274635a4d3fefc39861af0190474363db` |
| Review charge | Initial 264 manual lines + generated 1 line / 19,882 bytes; correction 51 manual lines; implementation child 297 manual lines |

## Actual Route Comparison

| Route | Distance | Duration | Coordinates | Endpoint snaps |
|---|---:|---:|---:|---|
| Current | 99,706.6 m | 5,292.1 s | 1,120 | original endpoints |
| Alternative | 80,298.9 m (0.805352×) | 5,282.5 s (0.998186×) | 743 | 4.539 m / 95.220 m |

Avoidance proof: `booleanIntersects=false`; route-vertex margin 5,726.080 m; polygon-vertex margin 5,724.859 m; recorded two-way minimum 5,724.859 m.

## RED→GREEN and Work Unit Evidence

| Evidence | Exact result |
|---|---|
| RED | Focused command failed as intended: 2 suites unresolved, 0 tests, exit 1 before implementation files existed. |
| Correction RED→GREEN | Injected rename failure first resolved instead of rejecting; after the narrow rename dependency seam, 1 test passed and proved accepted bytes plus temporary-file cleanup. |
| GREEN / focused | Keyless focused command: 2 files passed, 17 tests passed, exit 0; strengthened consumer-concept exclusions passed. |
| Direct test typecheck | `bunx tsc --noEmit … <both tests>`: exit 0, no diagnostics. |
| Runtime harness | Authorized generation: 1 feature, 743 coordinates, 80,298.9 m, 5,282.5 s, 5,724.859 m clearance; keyless verify repeated those values. |
| Broader verification | Main routes: 15 / 45,577 coordinates; `bun run check`: lint/typecheck, 22 files / 109 tests, build PASS. |
| Rollback boundary | Full rollback is newest-first: revert the correction commit, then `4f99f4c98077b6fbcadc77f1cd46a5394efe997a`. This file cannot contain its own correction commit/tree/evidence identity; post-commit Engram and Result Contract bind them explicitly. |

Generated GeoJSON remains one line / 19,882 bytes with SHA-256 `93e115fe3b95a4dc6acb1d478031cf2d7dc7451a2d4c438819cd748774d320ea` and is excluded from the manual review-line budget. Direct guards reject alternative apply/assign, movement/position mutation, comparison UI, staged approval, WebMCP route tools, runtime provider/key use, and additional fixture/catalog imports across every protected consumer root.
