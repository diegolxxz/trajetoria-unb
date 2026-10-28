# Stage 7: Design lens

Reviewer: `egm_grade_design`, fresh context. Persona: EGM design critic.
Standard: `feature-spec-standard.md`. Target: entire brief, lines 1–106.

Verdict: six Major proposal gaps; no Blocker. These concern the proposed feature,
not defects alleged in code that has not been changed to implement it.

## D1 — Major: Evaluate alternatives

Target: 9–13, 72–80. The brief chooses complete-assignment compatibility filtering
and grouped results without comparing viable alternatives. Repeating feasibility
searches for every displayed class can cost more than fixed-selection conflict
checks. Compare global checking, fixed-selection checking and on-demand checking.
Also compare grouping during search with grouping after enumeration. Record the
correctness, browser-cost and interaction trade-offs, not algorithm syntax.

## D2 — Major: Define the candidate's role in compatibility checks

Target: 41–46, 72–76. Required Physics occupies Monday. Disabled Chemistry also
has only Monday. If Chemistry stays outside the tested assignment, Physics alone
is feasible and Chemistry could incorrectly appear compatible. If the candidate
is forced into the assignment, it is incompatible.

Define separate checks for an enabled required subject's class and for an extra
or disabled subject's class. State whether the inspected class is forced alongside
enabled required subjects, whether other extras remain optional, and what happens
when no required subjects are enabled. Add acceptance examples.

## D3 — Major: Bound aggregate work and retained alternatives

Target: 72–80, 87–89, 98–99. The existing Worker limits one generation request to
20 results and 25,000 attempts. That does not bound repeated compatibility checks,
explanations or the assignments hidden inside grouped results.

Twenty subjects with ten classes could cause 200 checks and five million attempts
per interaction under independent old limits. Ten same-time variants for each of
ten subjects produce one visible timetable but up to 10^10 concrete assignments.

Set a total work/time envelope per interaction, cancellation and stale-response
behavior, an unknown state and a bound on retained alternatives. Leave exact
algorithms and measured thresholds to detailed design.

## D4 — Major: Specify semantic migration

Target: 9–11, 41–51, 84–86, 98–99. Version 1 stores `{codigo, obrigatoria}` and at
most one selected snapshot. Its normalizer reconstructs only known fields.
Current generation considers all offered classes, independently of manual choices.

If an old manual A1 becomes the only allowed class, historical generator behavior
changes. If it becomes “all,” the manual choice is not a generator restriction.
Neither policy is defined. Changed teachers or unavailable snapshots also require
an explicit unresolved-reference policy.

Specify participation and allowed-set defaults; preserve manual selections
independently; retain unresolved restrictions instead of dropping or broadening
them silently. Test backup round trips, undo/redo, legacy imports and changed offers.
Migration must stay browser-local and must not require uploading personal plans.

## D5 — Major: Qualify alternative counts

Target: 28–31, 78–80. A bounded search might find 12 of 100 class variants. Showing
“12 alternatives” without qualification can imply completeness; discovering all
variants just to count them can exceed the budget. Keeping only a representative
loses the promised teacher choices.

Distinguish complete counts from discovered counts or “at least N.” Every option
offered for application must represent a verified concrete assignment. Define
bounded or lazy access to alternatives and examples of truncated grouped results.

## D6 — Major: Define an achievable explanation fallback

Target: 26–27, 62–66, 98–99. Three required subjects each have choices in only two
shared slots. Every pair fits, but all three cannot fit together. Pairwise conflict
reporting cannot explain that case; finding a minimal conflict set may itself be
expensive.

Allow a sufficient conflicting set without promising minimality. Distinguish no
eligible classes, proven joint infeasibility and an unresolved search/explanation.
Define partial-preview behavior after inconclusive searches, without implying
that omitted subjects were proved impossible to include.

## Read receipts

All required files accessible. Full persona, standard and target read. Python
reference: state/profile 330–363, filters 860–950, profile 1626–1705, generator
1701–1840, controls 1900–1935, execution 2070–2198 and application 2238–2265.
Full `/grade/index.html`, `grade-calculos.js`, `grade-arquivos.js` and `docs/grade.md`.
`grade.js`: 1–110, 180–282, 400–463, 530–610, 615–650. Worker limits searched.
No private save files, source edits, builds or tests.
