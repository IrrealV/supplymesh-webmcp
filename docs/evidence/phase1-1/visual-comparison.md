# Phase 1.1 visual evidence verdict

**Verdict: PASS.** All six images are genuine application output at the required viewports. The correction preserves every fixture coordinate and all 15 truck/label pairs while removing tested label intersections and compacting aggregate risk context.

## Evidence conditions

- Chromium rendered the application, accepted ORS fixtures, and live token-free OpenStreetMap tiles after cleared storage, reduced-motion emulation, font readiness, and visible-tile completion.
- Desktop images are 1440×900; tablet images are 900×900. No canvas, mockup, background substitute, hidden marker, or image-composited UI was used.
- Comparison authority is the supplied logistics-console references and Phase 1.1 written brief; composition and hierarchy govern rather than pixel matching.

## State comparison

| State | Verdict | Critical comparison |
|---|---|---|
| Desktop overview | PASS | The 56px topbar, compact rail, Spain map, and overview panel retain the reference hierarchy. Fifteen trucks and fifteen opaque labels remain visible; deterministic screen-space placement keeps labels inside the map and clear of labels, trucks, and compact risks. REST+time, `3.9m`, `26t`, closure, and `SNOW` tokens preserve risk meaning without verbose text blocks. |
| Desktop Weather affected | PASS | Expanded rail and three-card result panel are proportionate. Only severe snow receives matched emphasis; unrelated risks remain compact muted context. All secondary fleet labels stay readable and collision-free without competing with matched trucks. |
| Desktop selected route/risk | PASS | Unit 204, the plausible Barcelona→Valencia blue corridor, selected REST risk, severe-snow context, and inspection hierarchy remain prominent. Selected risk text expands while aggregate risks stay compact; route geometry is unchanged. |
| Desktop two filters | PASS | Weather + Critical chips, five deduplicated priority results, and severity badges are explicit. Vehicle labels remain collision-free and risk emphasis follows the active Weather risk category rather than every matched vehicle. |
| Tablet results | PASS | The contained results dialog, expanded rail, dimmed map, three Weather results, attribution, and close action remain usable with no horizontal overflow. The intentionally narrow map strip is contextual rather than a primary interaction surface. |
| Tablet detail | PASS | The 560×720 inspection remains viewport-contained and readable. Identity, summary, and risks lead; keyboard/browser scrolling reaches tabs and Actions, verified by Playwright. |

## Cross-state findings

- **Composition/proportions:** desktop and tablet structures match the map-dominant logistics-console brief.
- **Trucks/labels:** all 15 pairs remain accessible and visible; stable placement prevents label-label, label-truck, and label-risk intersections in required desktop states. Wide offsets can separate a label from its truck, but ordering is deterministic and identity remains explicit.
- **Routes/risks:** selected road geometry is plausible and unchanged. Compact aggregate tokens plus expanded selected risks provide clear severity and context.
- **Spain viewport:** Spain remains centered with useful Iberian, southern-France, and North-Africa context.
- **Panels/filters/density:** cards, chips, result ordering, drawer hierarchy, and muted context support rapid scanning without overflow.
- **Forbidden decoration:** no gradients, glassmorphism, giant metrics, sparkles, bottom bar, agent/chat chrome, canvas substitution, or Phase 2 controls appear.

## Limitations

Tablet results intentionally prioritize the modal over the map, and tablet detail requires scrolling for tabs/actions. Overview labels may use wider offsets at dense points, but remain deterministic, contained, readable, and fully present.
