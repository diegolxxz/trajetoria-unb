# Grade builder

* **Author:** Diego
* **Date:** 2026-10-27
* **Status:** Anchored working hypothesis, awaiting user readiness confirmation. No Goldfish review or implementation approval yet.

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
- Show one timetable when only the teacher or class changes. Keep those class
  alternatives accessible inside that result, with a clear count and notice.
  Subject-to-time assignments define equivalence: swapping two subjects' times
  is a different timetable even when the occupied hours are identical.
- Preserve the two requested entry flows: choosing subjects or acceptable classes
  before generation, and choosing from a filtered list step by step. The exact
  user chooses each subject and may restrict it to several acceptable classes.
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

## Proposed handling of incomplete results

The user delegated this decision. Proposed default: every subject is required
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

Compatibility means an allowed class can participate in at least one complete
assignment for the current required subjects, rather than needing to fit every
alternative class simultaneously. Filters must not clear saved candidates.
If the bounded search cannot establish feasibility, do not label a candidate
impossible or silently hide it as proven incompatible.

Equivalent class choices should not consume the visible result limit before
different timetables can be found. Keep the search bounded, and distinguish a
result limit or search limit from a proof that no timetable exists.

## Goals vs. Non-Goals

* **In-Scope Goals:** Several acceptable classes per subject; strict, reversible
  filters; compatible timetable generation; clear explanations; useful handling
  of identical weekly schedules; preserve existing plans and exports.
* **Out-of-Scope Non-Goals:** Copying terminal menus and shortcuts; accounts or a
  remote database; silently relaxing filters; estimating curricular hours from
  teacher hours; generating an unbounded list that blocks the browser.

## Remaining Review Points

The user has answered the main feature questions and delegated the priority policy.
The interaction defaults are settled: individual participation controls apply to
required subjects and extras; comparison-list membership remains independent;
class restriction works by selecting acceptable alternatives.
Confirm the proposed defaults and obtain readiness confirmation before review.
Review the cost of compatibility filtering, explanations when no solution exists,
grouping without losing teacher choices, and preservation of existing saved plans.

## Key Decisions & Staging for Next Steps

Present the anchored hypothesis and obtain explicit readiness confirmation before
dispatching fresh-context Goldfish reviewers. After reviewing and resolving their
findings, obtain alignment on the brief before proceeding to the design stage.
This file is a draft, not a reviewed design or implementation plan.
