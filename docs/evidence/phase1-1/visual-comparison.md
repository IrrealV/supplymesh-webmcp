# Phase 1.1 visual evidence verdict

**Verdict: BLOCKED.** The six images are genuine application output at the required viewports, but the desktop overview and filtered-map states do not satisfy the written requirement for readable vehicle labels and clear risk encodings. Functional checks do not override this visual failure.

## Evidence conditions

- Chromium rendered the checked-in application and ORS route fixtures with live token-free OpenStreetMap tiles.
- Each state started from cleared local storage, reduced motion, settled fonts, and fully loaded visible tiles.
- Desktop images are 1440×900; tablet images are 900×900. No canvas, static mockup, background substitute, or image-composited UI was used.
- Comparison authority is the supplied logistics-console references plus the Phase 1.1 proposal/spec/design brief. The references guide hierarchy and composition rather than pixel matching.

## State comparison

| State | What matches | Critical comparison |
|---|---|---|
| Desktop overview | Correct 56px dark topbar, compact dark rail, dominant map, bounded overview panel, Spain-centered operational context, four derived cards, attribution, and no forbidden decoration. | **Fail:** truck labels and REST/restriction labels overlap heavily through northern and central Spain. Several labels are clipped or obscured, so fleet identity and risk meaning are not readable at a glance. The risk layer dominates the logistics hierarchy instead of supporting it. |
| Desktop Weather affected | Correct expanded 232px rail, active Weather state/count, three concise results, muted nonmatches, and stable right-panel proportions. | **Fail:** muted secondary labels remain numerous enough to form a gray text cloud around northern Spain. The three matched trucks are more visible, but risk text still collides with vehicle labels and weakens the intended filtered focus. |
| Desktop selected route/risk | Strongest state: selected Unit 204, plausible Barcelona→Valencia blue road corridor, distinct critical/rest and severe-snow treatment, useful inspection hierarchy, legible risk comparison, and restrained secondary context. | **Pass for this state:** route, vehicle, risks, legend, and inspection are distinguishable. The map still carries busy secondary boundary/route context, but it does not obscure the selected corridor. |
| Desktop two filters | Correct simultaneous Weather + Critical controls/chips, five deduplicated results in required priority, severity badges, expanded rail, and stable composition. | **Fail:** the map repeats the filtered-state density problem. Multiple REST/restriction labels collide around the center, and selected/matched fleet labels compete with risk text rather than forming a clean operational scan path. |
| Tablet results | Correct 900×900 overlay behavior, expanded rail, modal results drawer, dimmed map, three Weather results, close control, attribution, and no horizontal overflow. | **Pass with limitation:** the modal hierarchy is clear, but the combination of expanded rail and wide drawer leaves only a narrow map sliver. This is usable for results review, not meaningful map comparison. |
| Tablet detail | Correct contained inspection dialog, visible identity/route/status/risk hierarchy, dimmed selected-route map, readable typography, and viewport-safe bounds. | **Pass with limitation:** actions and secondary tabs are below the captured fold and require scrolling. The visible portion remains coherent and does not overflow the viewport. |

## Cross-state findings

- **Composition and proportions:** desktop shell proportions follow the brief; tablet overlays are contained and intentional.
- **Logistics-console hierarchy:** panels and selected-detail hierarchy are professional, but default/filter map density defeats rapid scanning.
- **Trucks and labels:** truck glyphs are distinct, yet many labels overlap or truncate in the required overview and filtered states. This is acceptance-critical.
- **Route plausibility:** the selected Barcelona→Valencia route follows a credible road corridor. Background routes are appropriately de-emphasized in the selected state.
- **Risk legibility:** selected risks are clear; aggregate REST/restriction labels are not. Repetition and collisions overwhelm the map.
- **Spain viewport:** Spain is centered with useful Iberian context, though the overview includes substantial France and North Africa. This is acceptable context, not the blocker.
- **Panels, cards, and drawer:** overview cards, filter result rows, and inspection sections are compact, aligned, and free of nested-card decoration.
- **Filters:** counts, active states, chips, deduplicated results, and severity are visually explicit.
- **Density and overflow:** no page-level horizontal overflow was observed. The failure is semantic density and collision, not viewport overflow.
- **Forbidden decoration:** no gradients, glassmorphism, giant metric cards, sparkles, bottom bar, agent/chat chrome, or Phase 2 controls appear.

## Required correction before acceptance

Reduce aggregate map-label collisions without hiding required context: prioritize fleet labels, collapse repeated driving/rest labels at the overview zoom, and prevent risk/vehicle label overlap in filtered states. Production behavior was not changed in this evidence unit, so the acceptance-critical miss remains visible and tasks 5.1–5.4 remain incomplete.
