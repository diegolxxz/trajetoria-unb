# Class options review — /grade only

Review started: 2026-10-27. Correction verified: 2026-10-28. Requested sequence:
review, findings, correction. Consolidated
review mode carries forward from the existing EGM session. No commit requested.

## Evidence and scope

The baseline is the running options panel captured at 1440, 390 and 320 px in
`grade-options-*.png` in the conversation artifact directory. The correction
target is `../../options_fix_plan.md`; the broader design record remains
`../../design_draft.md`. The source baseline is `public/js/grade.js`,
`public/css/grade.css` and `public/grade/index.html`.

Only the options, their wording and the unsaved editor lifecycle are in scope.
The generator, worker protocol, stored schema, routes and other pages are not.

## Stage 5 — Initial zoom out

Fresh reviewer: `grade_options_zoom`, using `agents/zoom_out.md` and the
zoom-out standard. Read receipt included the design record, concepts brief,
current JavaScript, CSS and HTML, and desktop and phone screenshots.

- Z1, major: opening the disclosure changes its parent's grid position and
  moves the existing class-choice button. A separate full-width sibling panel
  can expand without relocating the action row.
- Z2, major: the manual choice needs another disclosure after opening Options.
  Its relationship to allowed generator classes is unclear. Expose the native
  manual select directly and name its independent effect.
- Z3, major: `registrar()` and repeat editor entry clear uncommitted markings.
  Preserve the current editor for same-plan changes and close it only for
  explicit application, cancellation, removal or plan/semester changes.

## Stage 6 — Comprehension

Fresh reviewer: `grade_options_comprehension`, using `agents/comprehension.md`
and the re-implementation standard. Receipt included the target design, current
options and editor code, CSS, HTML and phone screenshot.

- C1, major: vacancy and fit filters route through `registrar()` and discard the
  current draft. Preserve that draft while updating its visible candidates.
- C2, major: choosing allowed generator classes and choosing a saved manual
  class appear interchangeable. Label both effects and state their independence.
- C3, major: participation and required/extra priority overlap visually, while
  the help alternates between “opcional” and “extra”. Keep a consistent term and
  explain that participation enables generation and priority governs omission.
- C4, minor: clearing draft markings, permitting every class and removing the
  subject have different effects but vague names. Name their scopes explicitly.

## Before implementation

The first regression run reproduced three failures: hidden-panel semantics,
same-editor re-entry losing a checked class, and absence of the explicit
unrestricted-reset control. Seven existing interface checks still passed.

The remaining stages and final verification follow below.

## Stage 7 — Design, structure and language

Fresh reviewers: `options_design_critic` (design-critic persona) and
`options_structure_style` (structural and style personas), with the feature-spec
standard. Both read the correction target and current options source; the design
reviewer also inspected desktop and phone screenshots. Neither edited files.

- D1, major: preserving a draft is insufficient if the extras filter hides its
  subject. Keep the currently edited subject visible until Apply/Cancel.
- D2, major: rerenders replace controls and closure can lose keyboard focus.
  Give editor controls stable IDs and return focus to the originating trigger.
- D3, documentation: compare the sibling panel, native priority field and single
  draft with their alternatives. Added the rationale to the correction plan.
- D4, minor: closing Options must not hide the separate class editor.
- S1, major: participation needs a visible label, not only an accessible name.
  Add “Usar no gerador” and explain how participation differs from priority.
- S2, major: “extras não selecionadas” does not describe the actual filter.
  Clarify that active subjects, saved manual choices and the open editor remain.

These findings were accepted in the focused plan before production edits.

## Stage 8 — Intermediate zoom out

Fresh reviewer `options_scope_final` read the zoom-out persona and standard,
full correction plan and findings, current registrar/editor/options JavaScript
and relevant CSS. Accepted the bounded correction with no remaining major scope
blockers. No engine, storage-schema or navigation change is needed.

## Stage 9 — Implementation readiness

Fresh reviewers `options_implementation_readiness`, `options_codebase_readiness`
and `options_readiness_style` used their corresponding personas and the
implementation-readiness standard. They inspected the detailed plan, current
source, tests and accumulated findings; the style reviewer accepted its clarity.

- R1: closing a draft can hide an inactive extra. Use the subject search as the
  focus fallback when its original trigger disappears, and verify browser focus.
- R2: Undo/Redo and backup import intentionally replace the working state.
  Explicitly close drafts for those actions; same-plan filter and field changes
  preserve them. Import must also close drafts when plan IDs happen to match.
- R3: the visible participation label needs more than the original checkbox-only
  44 px column. Adjust that track and verify its wrapping at narrow widths.

All accepted readiness details were added before production corrections.

## Correction and resolution

The options trigger now controls a separate full-width sibling panel. Opening it
does not move either existing action button. Priority and manual saved-class
fields appear directly, in two columns on desktop and one on phones. Their
labels and help describe their independent effects. The participation checkbox
has a visible label, and reset/removal actions name their scope.

The class editor preserves its markings during same-plan filter, participation,
priority and manual-choice changes. Reopening it retains the same draft. Another
subject cannot silently replace that draft. Edited extras remain visible until
Apply/Cancel, even when their final filtered state would hide them. Closing
Options leaves the separate editor accessible. Stable IDs preserve focus through
rerenders; closure returns focus to the subject trigger or search when filtered
out. Bulk markings sit above the candidates; Apply/Cancel sit below them, with
Apply visually emphasized.

Undo/Redo and import intentionally close drafts because they replace the working
state. This is the selected policy for R2; same-plan field changes preserve them.
Resetting all allowed classes does not change the saved manual class. No new
persisted fields, calculation rules, data sources or routes were introduced in
this correction. Existing changes outside these options were preserved.

All actionable findings above are addressed. The single-editor guard remains an
intentional tradeoff: finish or cancel the current draft before editing another
subject. It adds no modal or parallel-draft state.

## Final verification

- Regression sequence: the new cases first reproduced four failures; after the
  correction all 12 interface tests passed, including explicit history/import
  replacement and independent draft cancellation.
- `bun run build:verified`: passed JavaScript/CSS/HTML lint, Prettier, source
  validation, all 59 JavaScript tests, static build and generated-site validation.
- `uv run pytest`: all 36 Python tests passed on Windows.
- `uv run ruff check .` and `uv run ruff format --check .`: passed.
- `git diff --check`: passed.
- Isolated Edge/Chromium contexts at 1440, 390 and 320 px: action positions were
  identical before/after Options opened; panels used the full available width;
  no page overflow or JavaScript errors occurred. Verified direct manual choice,
  priority, repeated entry, blocked switching, vacancy-filter draft preservation,
  Apply, unrestricted reset, edited-extra visibility, Cancel focus fallback,
  persistence after reload and expanded generated combinations. Phone inputs
  remained 16 px and controls retained their existing 44 px touch targets.

Artifacts in the conversation visualization directory:
`grade-options-final-open-{1440,390,320}.png`,
`grade-options-final-editor-{1440,390,320}.png` and
`grade-options-final-verification.json`.

Limit: phone checks used browser emulation, not physical iPhone/Android hardware.
No commit or push was made.
