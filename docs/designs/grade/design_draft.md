# Grade builder: choosing classes and generating timetables

* **Author:** Diego
* **Status:** Opening section approved. The user then explicitly requested implementation of `/grade/`; the design-only workflow was left for implementation. Technical decisions and changes are recorded below. This is not a separate implementation-readiness review approval.
* **Date:** 2026-10-27

## Overview

Extend the existing `/grade/` page so a student can keep a list of subjects to
compare, choose which subjects to use in generation, and allow several acceptable
classes for each subject. The generator chooses at most one class per included
subject and presents distinct weekly schedules without repeating the same hours
for every teacher variation.

Students can start with subjects and narrow their acceptable classes, or choose
classes step by step from a filtered list. Both paths use the same plan and
generation rules. The weekly view appears only after the student chooses to
mount a timetable. It remains a Monday-to-Saturday view, with a way to return to
the choices without losing them.

This draft starts from the [accepted concept brief](concepts_brief.md) and the
user's approval of all six A options in [decision_options.md](decision_options.md).
The [consolidated review](reviews/2026-10-27/consolidated_review_report.md) records
the earlier ambiguities and risks. Those product choices are not being reopened.

## The Problem

The current planner separates a manual class choice from automatic generation,
but it does not express the student's full intent. A student may accept two
Calculus classes and one Physics class, yet want to keep other subjects visible
for comparison without asking the generator to include them.

Requiring a single class too early hides possible solutions. Treating every
visible subject as part of the request makes comparison harder. Asking the
student to uncheck many unwanted classes creates extra work when they only want
to permit one or two. Repeating identical weekly schedules for different teachers
makes the results harder to compare.

The solution must preserve those separate decisions without turning the page
into separate copies of the planner. Filters must have predictable effects:
“With seats” affects both browsing and generation, while saved choices remain
available when the filter is removed. “Fits” means that the inspected class can
join a complete assignment of the enabled required subjects, not merely that
those subjects can fit without it.

Search has a limit. The interface must distinguish a proven conflict from work
that stopped before a conclusion. It must also retain the meaning of existing
plans and backups as the new choices are introduced.

## Goals

* **G1 — Keep comparison separate from participation.** A subject stays in the
  student's comparison list when “Use in generator” is off. Filters may temporarily
  hide unmatched rows, but must not erase the subject or its saved choices.
* **G2 — Choose acceptable classes by inclusion.** Adding a subject initially
  allows all its classes. A student can enter an editor and mark only the classes
  they want. “Select all visible classes” respects the editor's current filters.
  Applying replaces the allowed set; cancelling preserves it. An empty applied
  restriction is rejected without changing the previous setting.
* **G3 — Evaluate alternatives together.** Given one allowed Physics class and
  two allowed Calculus classes, with Physics conflicting with only one Calculus
  class, generation must retain the compatible combination. It must not include
  two classes of Calculus in one timetable.
* **G4 — Make filters consistent and reversible.** With seat filtering active,
  full classes and unknown vacancy data are ineligible for generation as well as
  hidden by that filter. Compatibility checks use the same eligible candidates.
  Turning filters off restores eligibility without broadening explicit manual
  restrictions or silently changing participation.
* **G5 — Check compatibility automatically without false certainty.** With “Only
  classes that fit” active, changes update compatibility. An inspected candidate
  is tested alongside all enabled required subjects, replacing its own subject's
  other alternatives when applicable. Other extras may be omitted. Unknown
  compatibility remains visible and labeled, rather than being treated as a
  proven conflict. Obsolete replies must not replace current results.
* **G6 — Respect subject priorities and individual extras.** Required subjects
  are included in complete results. Only individually enabled extras are tried;
  they may be omitted when necessary. Results identify omitted extras and prefer
  more included extras among verified results without claiming a global optimum
  after a bounded search.
* **G7 — Group by subject-to-time assignment.** Teacher or class variations with
  identical subject schedules appear in one result. The student chooses an
  eligible concrete class inside that result before application. Swapping the
  times of two subjects creates a different result. Counts must state when they
  cover discovered alternatives rather than an exhaustive set.
* **G8 — Explain unsuccessful requests and expose partial previews explicitly.**
  Distinguish no eligible classes, proven joint infeasibility, and an unfinished
  search. A sufficient conflicting set is acceptable; the smallest explanation
  is not promised. “View partial alternatives” shows omitted subjects and does
  not silently replace the original request or present an unknown outcome as
  proven infeasibility.
* **G9 — Preserve existing data and workflows.** Keep old subjects enabled with
  their priorities, old generator requests unrestricted, and committed manual
  snapshots independent of generator restrictions. Preserve unavailable choices
  with a visible status. Save the new decisions through reload, backups, imports
  and undo/redo. Keep semester isolation, JSON/ICS/PNG exports, existing routes,
  curricular hours and credits, and browser-local plans.
* **G10 — Preserve the site's compact desktop and phone interface.** Keep
  subject-first and step-by-step selection in the same page. Keep the weekly
  view out of the initial choice step. Bound filtering, generation, explanation
  work and retained alternatives so the interface remains usable. Detailed
  design will supply the exact limits and their verification criteria.

## Non-Goals

* Port the terminal application's menus, shortcuts or full internal structure.
  Its [Python planner](<C:/Users/diego/Documents/code/minhagrade/em python/gradeempython.py>)
  supplies interaction context, not a requirement to replace browser modules.
* Add accounts, remote personal-plan storage or synchronization between devices.
* Change IRA calculations, exchange-selection rules, the class scraper or the
  static semester-data format as part of this planner redesign.
* Relax active filters, broaden restrictions or drop required subjects without
  an explicit, visible user decision.
* Promise every possible combination, a globally optimal partial timetable,
  exhaustive teacher combinations or the smallest possible conflicting set.
* Add travel-time, campus-transfer, teacher-ranking or new day/shift preference
  filters in this iteration. The initial filters are compatibility and seats.
* Change application code or create commits during this design workflow.

## Technical Plan (Implementation Record)

Extend the existing UI, pure engine, Worker and validation/history boundary.
No additional framework, account service, storage key or semester file is needed.

```text
Comparison list + participation + priority + allowed class IDs
  -> eligible classes (restrictions intersect active seat filter)
  -> compatibility Worker (forced candidate + enabled required subjects)
  -> derived filtered list; unknown candidates remain visible
  -> generation Worker (canonical schedule groups, full inclusion first)
  -> grouped schedules with teacher/class selectors
  -> explicit application -> existing saved snapshot and weekly view/exports
```

`grade-calculos.js` keeps the old `gerarCombinacoes` interface and adds
`gerarGrades(pedidos, opcoes)` and `compatibilidades(pedidos, candidatos, opcoes)`.
Generation returns grouped classes, diagnostics, truncation and attempt counts.
Compatibility returns each candidate's stable ID and a compatible, incompatible
or unknown state. Both include preparation in a shared 25,000-attempt ceiling.
Generation retains up to 20 distinct schedules and 500 variants per subject;
compatibility checks up to 500 candidates per update. Unknowns are retained and
limits are reported. Full inclusion is attempted before optional omissions using
the same prepared schedule groups and aggregate budget. Explicit partial requests
permit required omissions and label them in the results.

`grade.js` keeps comparison membership independent of the generator's active
subjects, renders an inclusion editor, preserves its uncommitted draft until
apply/cancel, and uses separate Workers for generation and compatibility.
Replies from obsolete Workers are ignored. Available-seat filters constrain both
display and generation. Same-time variants are selected inside each result.

`grade-arquivos.js` validates optional version-1 fields `ativa`, `permitidas` and
plan `filtros`, preserving legacy field omission and manual snapshots. The same
normalization/history path covers saves, imports and undo/redo. Missing restricted
classes stay unresolved rather than becoming an unrestricted request.

## Alternatives Considered

The user accepted options 1A–6A. Manual verification buttons, display-only vacancy
filters, selecting hidden classes, converting old manual choices into new
restrictions, a separate professor-choice stage and manual-only recovery were
rejected in favor of the corresponding A behavior. Canonical schedule grouping
avoids enumerating the cross-product of equivalent professors. Existing Worker
and validation modules were extended instead of duplicating the planner.

## Detailed Implementation Record

All files changed for this implementation:

- `public/js/grade-calculos.js`: grouped generation, priority search, compatibility,
  aggregate limits and truthful diagnostics.
- `public/js/grade-arquivos.js`: backward-compatible optional selection fields.
- `public/js/grade-worker.js`: dispatch compatibility or grouped generation.
- `public/js/grade.js`: participation, allowed-class editor, filters, separate
  Workers, grouped teacher choices and explicit partial previews.
- `public/grade/index.html`: filter controls, compatibility status and partial action.
- `public/css/grade.css`: compact controls, class editor and grouped results.
- `tests/grade-calculos.test.cjs`: schedule equivalence, grouped limits, forced
  candidate checks, global infeasibility, partial previews and full-inclusion priority.
- `tests/grade-arquivos.test.cjs`: optional-field validation and legacy/history preservation.
- `tests/grade-interface.test.cjs`: comparison participation, inclusion editing and
  independent cancellation of compatibility and generation.
- `docs/grade.md`: actual controls, bounds and backup fields.
- `docs/designs/grade/design_draft.md`: approval and implementation record.

New logic was tested with observed failing tests before implementation. Browser
checks use an isolated context and temporary scripts outside the source tree;
they do not access personal plans. The verification commands are `bun run
build:verified` and `uv run pytest`. Phone behavior is checked in emulation,
not claimed as physical-device verification. No commits are requested.

## Remaining Verification

Final test and browser results belong to the implementation delivery, rather than
being inferred from this document. No new product choices are introduced here.

*Drafted with EGM; subsequently updated to record the explicitly requested
implementation. No independent implementation-readiness approval is implied.*
