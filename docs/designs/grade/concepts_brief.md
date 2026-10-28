# Grade builder

* **Author:** Diego
* **Date:** 2026-10-27
* **Status:** Review completed. Product decisions 1A–6A accepted by the user. Detailed design and implementation plan are next; no implementation-readiness approval has been issued.

## Overview

Improve the existing `/grade/` page using the interaction model in
`minhagrade/em python/gradeempython.py`. Keep the website's compact interface,
static class data, saved semester plans, imports, exports, and undo/redo.
Choosing subjects and acceptable classes comes before displaying a finished
weekly timetable.

## Confirmed behavior

- A subject can have several acceptable classes. They are alternatives, not
  simultaneous enrollments. A final timetable uses at most one class per subject.
- The generator must evaluate those alternatives together. If Physics has one
  allowed class and Calculus has two, but only one Calculus class fits Physics,
  exactly one final combination remains.
- Subjects with no matching classes disappear while a filter is active. Removing
  that filter restores the available choices without deleting the saved selection.
- Include filters for schedule compatibility and available seats. Do not copy the
  Python fallback that silently ignores a filter when it removes every class.
- Explain why the requested subjects cannot all fit when no complete combination
  exists. Do not claim that a search stopped by its limit proves impossibility.
- Group results with identical subject-to-time assignments into one timetable,
  even when their teachers or class identifiers differ. Keep those class
  alternatives accessible inside that result, with a clear count and notice.
  Subject-to-time assignments define equivalence: swapping two subjects' times
  is a different timetable even when the occupied hours are identical.
- Preserve the two requested entry flows: choosing subjects or acceptable classes
  before generation, and choosing from a filtered list step by step. In both
  flows, the user chooses each subject and may restrict it to several acceptable classes.
  The generator then chooses one allowed class per included subject. These flows
  can share controls rather than requiring separate copies of the planner.
- Compatibility and available-seat filters are the initial scope. A control to
  hide extra subjects is also wanted. More filters can be considered later.
- Include an explicit action to select every class of a subject, plus a count of
  classes still available after filtering. The user explicitly accepted both.
- Keep a subject in the user's comparison list even when it is not enabled for
  generation. Membership in this list and participation in generation are separate
  decisions. An unchecked subject must remain available for inspecting classes
  that might fit. Schedule and seat filters can still hide unmatched entries.
- Every subject has an individual "Use in generator" control, including extras.
  Only enabled extras can be considered; the user chooses which extras to attempt.
  Do not add a global extras switch that overrides these individual choices.
- Adding a subject initially allows all its classes. Choosing specific classes
  must work by inclusion: the user marks the classes they want rather than
  unchecking every unwanted class. Opening this editor must not commit changes;
  applying a selection replaces the allowed set, and cancelling preserves it.

## Accepted generation priorities

The user accepted the proposed defaults. Every subject is required
unless the user explicitly marks it as an extra. Generation only considers
subjects individually enabled by the user. Try to include every enabled subject
first; enabled extras may be omitted to keep the enabled required subjects. Show which
extras were omitted in each result, and prefer results that include more extras
without claiming a global optimum when the search stops early.

If the required subjects cannot all fit, keep the request unchanged, explain the
known blockers, and offer an explicit action to inspect partial alternatives.
These alternatives must name omitted subjects, including required subjects; they
are previews, not complete solutions to the original request. Never silently apply
a reduced timetable.

Individual subject controls replace the proposed global "Include extras" switch.
Disabling an extra excludes it from generation, but keeps it in the comparison
list. Display filters must not silently change participation in generation.

Compatibility means the inspected class can participate in at least one complete
assignment with all enabled required subjects. For a required subject, force
the inspected class instead of that subject's other alternatives. For a disabled
subject or an extra, temporarily require its inspected class alongside enabled
required subjects; other extras may be omitted. With no required subjects, check
the inspected class itself against the eligibility filters. Filters must not
clear saved candidates or disable subject participation.
If the bounded search cannot establish feasibility, do not label a candidate
impossible or silently hide it as proven incompatible.

Equivalent class choices should not consume the visible result limit before
different timetables can be found. Keep the search bounded, and distinguish a
result limit or search limit from a proof that no timetable exists.

## Accepted choices after review

The user selected A in every topic of [decision_options.md](decision_options.md).

1. **Automatic compatibility filtering.** With the compatibility filter active,
   update results as choices change. Bound all work caused by one interaction,
   cancel obsolete work and discard stale replies. Keep unknown candidates visible
   and labeled; a budget limit is not evidence of incompatibility.
2. **Seat filtering applies to both display and generation.** While active,
   exclude full classes and classes with unknown vacancy data from eligible
   candidates. Disabling the filter restores eligibility without changing saved
   allowed choices. Compatibility uses this same eligible universe.
3. **Select all visible classes.** The bulk action applies to the editor's visible
   classes and is labeled accordingly. Applying replaces the full allowed set;
   cancelling preserves it. An unrestricted subject's inclusion editor starts
   ready to mark only the desired classes; editing an existing restriction restores
   its previous choices. Reject an empty applied restriction and preserve the old
   setting. To exclude a subject, use its generation-participation control instead.
4. **Preserve legacy behavior.** Old subjects remain enabled with their existing
   required/extra priorities. Old committed timetable snapshots remain independent
   from generation restrictions; old generator requests start unrestricted as
   before. Never silently replace unavailable snapshots or broaden a new explicit
   restriction whose class has disappeared. Preserve all new decisions through
   reload, imports, backups and undo/redo, within the browser-local boundary.
5. **Choose equivalent classes inside each result.** Show one schedule and expand
   each subject's eligible teacher/class alternatives inside it before application.
   Do not enumerate the entire cross-product merely to show these options. Bound
   retention and qualify counts when discovery is incomplete. Every offered final
   assignment must be verified; swapping subject times produces a different result.
6. **Explain and offer partial alternatives.** Keep the request unchanged and
   expose partial previews through an explicit action, naming omitted subjects.
   Explanations may identify a sufficient conflicting set without promising the
   smallest set. Distinguish no eligible classes, proven joint infeasibility and
   an unfinished search. Never describe unknown feasibility as proven impossibility.

## Reuse and state flow

Extend the existing browser planner instead of porting the Python application.
`public/js/grade.js` owns interaction, `grade-calculos.js` owns pure schedule and
search logic, `grade-worker.js` runs bounded work outside the interface, and
`grade-arquivos.js` owns validation, backups and history. The existing semester
catalog and offer remain the source of classes.

Comparison membership, participation, required/extra priority and allowed-class
choices are separate persistent decisions. Editor drafts and filtered views are
not committed decisions. Grouped results become a saved timetable only after the
user chooses a concrete assignment and explicitly applies it.

## Alternatives and limits to settle in detailed design

Manual-only conflict checks do not meet the agreed alternative-class semantics.
The user chose automatic compatibility checks over an explicit verification
button, shared seat filtering over independent display/generation controls,
visible-class bulk selection over selecting hidden classes, legacy behavior
preservation over turning manual snapshots into restrictions, inline teacher
selection over a second result stage, and explicit partial previews over requiring
all adjustments to be made manually.

Detailed design must select aggregate work limits, cancellation rules and a
bounded representation of grouped alternatives. It must preserve the current
local import/validation boundary and specify migration and acceptance tests.
This concept does not promise exhaustive enumeration, an optimal result after a
truncated search, or a minimal conflict explanation.

## Goals vs. Non-Goals

* **In-Scope Goals:** Several acceptable classes per subject; strict, reversible
  filters; compatible timetable generation; clear explanations; useful handling
  of identical weekly schedules; preserve existing plans and exports.
* **Out-of-Scope Non-Goals:** Copying terminal menus and shortcuts; accounts or a
  remote database; silently relaxing filters; estimating curricular hours from
  teacher hours; generating an unbounded list that blocks the browser.

## Review record

The [consolidated review](reviews/2026-10-27/consolidated_review_report.md) documents
the independent findings and recommended defaults. The reviewed 106-line version
is preserved in `reviews/2026-10-27/reviewed_concepts_brief.md`; findings refer to
that version. The current brief incorporates the user's subsequent 1A–6A decision.
These changes have not received a new review or implementation-readiness approval.

## Key Decisions & Staging for Next Steps

Proceed to detailed design and a phased implementation/test plan using these
accepted product decisions. Do not reopen them merely to choose internal data
structures. Keep production changes separate from documentation work and retain
the existing instruction not to commit.
