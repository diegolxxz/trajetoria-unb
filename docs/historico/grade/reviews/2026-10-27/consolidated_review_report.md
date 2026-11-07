# Grade builder: consolidated review

Date: 2026-10-27.
Target: [reviewed concept snapshot](reviewed_concepts_brief.md), lines 1–106.
The [current brief](../../concepts_brief.md) incorporates subsequent accepted decisions.
Preset: consolidated review without intermediate approval checkpoints.

**Status:** Review complete for the available feature concept: Stages 5–8 complete.
Six Major action groups and three Nit groups remain open; no Blocker or required
fundamental scope change was identified. This is not an implementation approval.
Stage 9 is not applicable because no detailed implementation plan exists.

## Scope

This is a review of the proposed planner behavior, not a new audit of the whole
application or an assertion that unimplemented requirements are current bugs.
Fresh-context reviewers read their installed EGM persona, standard, target and
named baseline. Stage 7's design, structural and style lenses ran independently
in parallel. The concept and application code were not changed during review.

## Main conclusion

The request can be addressed by extending the current static browser planner.
No new backend, account system or replacement engine is justified by this brief.
The outstanding work is to make user-visible rules precise, describe state
preservation and put a total bound on the new filtering/grouping work.

## Prioritized actions

### A1 — Major: Define what “fits” means for an inspected class

Sources: C1, D2, aggregate-cost part of D3.

An unchecked subject must remain inspectable, but the candidate must participate
in the feasibility question. Otherwise, a Monday Chemistry class could look
compatible merely because Physics alone has a valid Monday timetable.

Suggested rule: temporarily force the inspected class alongside all enabled
required subjects. For a candidate of a required subject, replace that subject's
alternatives with the inspected class. Other extras must not make this test fail
just because they were omitted. With no required subjects, assess the candidate
itself against its eligibility filters.

Bound all checks triggered by one interaction together. Cancel obsolete work and
discard stale responses. When compatibility remains unknown, retain the candidate
with a clear pending/unknown status rather than falsely hiding it as impossible.

### A2 — Major: Separate visibility, allowed classes and generation eligibility

Source: C3.

“Do not change participation” does not establish whether filters constrain the
classes that can actually be generated. A hidden full class must not unexpectedly
reappear in a generated result when the user asked for available seats.

Suggested rule: the available-seat filter constrains both displayed availability
and generation eligibility; use the same candidate universe for compatibility
checks. It must not delete saved allowed choices or disable the subject. Describe
display-only controls separately. A subject with no eligible classes stays in the
saved comparison list even when its matching row is temporarily hidden.

### A3 — Major: Define select-all and empty editor behavior

Sources: C2, C5.

All offered classes, saved allowed classes and currently visible classes are not
the same set. The current wording allows different results after the same edits.

Suggested rule: label bulk selection according to its actual universe, such as
“Select all visible classes.” Keep “all offered classes” as the default unrestricted
mode. In the inclusion editor, applying a specific selection replaces the full
allowed set; cancelling preserves the previous set. Show a clear selection count
before applying so hidden previous choices are not retained unexpectedly.

Reject an empty committed restriction, keep previous choices, and explain that
the user can instead disable that subject's generation checkbox. This avoids
silently treating an empty choice as “all” or mixing two independent controls.

### A4 — Major: Preserve the meaning of old plans and imports

Sources: C4, D4, persistence/input part of S3.

The old format has priorities and one manual class snapshot. The new concept adds
participation and allowed alternatives. The present validator reconstructs known
fields, so merely attaching new fields would lose them at that boundary.

Suggested mapping: preserve every old subject as enabled for generation, preserve
its required/extra priority, and keep manual snapshots independently of the new
allowed-class setting. Preserve the old generator's unrestricted behavior rather
than converting a past manual choice into a new restriction without notice.

For the new format, persist explicit restrictions and participation through saves,
backups and undo/redo. Keep unresolved saved references with a visible status;
never silently broaden a restriction when its class disappears. Migration and
validation remain local; do not upload personal plans. Require old/new backup
round trips, reload and changed-offering acceptance cases.

### A5 — Major: Group schedules without unbounded variant storage

Sources: D3, D5; wording clarified by T3.

Ten same-time class variants in ten subjects can describe one visible timetable
but 10^10 concrete assignments. A cap on displayed timetables does not bound that
hidden product. Bounded discovery also cannot promise an exhaustive variant count.

Suggested direction: group by subject code and its day/time assignment, preserving
eligible class choices within the group. Swapped subject times remain distinct.
Prefer compact per-subject alternatives over eagerly enumerating the whole product.
Separate work, retained-option and visible-result limits. Qualify discovered
counts and ensure every selectable final assignment has been checked.

### A6 — Major: Make explanations truthful when conflicts are global

Source: D6.

Three required subjects sharing only two possible slots are jointly impossible,
even when every pair fits. A pairwise conflict label cannot explain every failure.
Finding the smallest conflicting set can also cost more than the original search.

Suggested rule: allow a sufficient non-minimal conflicting set. Distinguish zero
eligible classes, proven joint infeasibility and an unresolved bounded search.
Partial previews must name omitted subjects and must not imply that a time limit
proved those omissions necessary. They must not overwrite the request automatically.

### A7 — Nit now, required design work: Describe ownership and state flow

Sources: S1, ZO1, boundary-assessment part of S3.

Add a short architecture statement, not an implementation algorithm. Explain the
relationship between comparison-list membership, participation, priority, allowed
classes, filtered views, grouped results and a committed timetable.

Reuse `grade.js` for interaction, `grade-calculos.js` for schedule/search logic,
`grade-worker.js` for background work, and `grade-arquivos.js` for validated
storage/history/backups. State what persists, what is an uncommitted editor draft
and what is a derived view. Keep the existing local-data security boundary.

Stage 8 reduced S1's raw Major severity for this concept brief: the missing
ownership paragraph is not evidence that the idea lacks a viable architecture.

### A8 — Nit now, required design work: Record alternatives and trade-offs

Sources: D1, S2.

Some alternatives are already rejected, including silent filter relaxation and a
global extras switch. Complete the comparison for the principal remaining choices:
complete-assignment checks versus fixed-choice or on-demand checks; grouping
during search versus after enumeration; required/extra priorities versus silently
dropping arbitrary subjects. Explain rejection reasons and browser costs.

Stage 8 reduced D1/S2's raw Major severity at concept altitude. Fixed-choice
conflict checking alone does not satisfy the accepted alternative-assignment
semantics; compare it fairly rather than presenting it as an equivalent shortcut.

### A9 — Nit in the consolidated action list: Repair status and wording

Sources: T1–T3. Raw T1 remains Major in the style report because obsolete readiness
instructions could stall a fresh reviewer. Here the user explicitly selected the
review preset and readiness was verified, so it is an editorial repair rather
than a newly discovered functional gate.

Update the stale review status, remove “The exact user,” and state identical
subject-to-time assignments before discussing teacher/class alternatives. These
changes are not applied by this review.

## Traceability matrix

Raw severities are retained in their stage reports; consolidated actions merge
related findings rather than counting the same issue repeatedly.

| Raw finding | Consolidated action |
| --- | --- |
| ZO1 | A7 |
| C1 | A1 |
| C2 | A3 |
| C3 | A2 |
| C4 | A4 |
| C5 | A3 |
| D1 | A8 |
| D2 | A1 |
| D3 | A1, A5 |
| D4 | A4 |
| D5 | A5 |
| D6 | A6 |
| S1 | A7 |
| S2 | A8 |
| S3 | A4, A7 |
| T1 | A9 |
| T2 | A9 |
| T3 | A5, A9 |

## Pipeline evidence

- [Initial zoom out](zoom_out_report.md): one Nit.
- [Comprehension](comprehension_report.md): five Major behavioral ambiguities.
- [Critic review](critic_report.md): parallel design, structure and style reports.
- [Intermediate zoom out](intermediate_zoom_out_report.md): no new independent
  finding; six material decision groups confirmed, document-only severities adjusted.
- [Implementation readiness status](implementation_readiness_report.md): not
  applicable, not a readiness pass.

No implementation tests were run because no application code was changed. No
commit was created. The suggested rules above require acceptance and incorporation
into the design before they become implementation requirements.

## Next step

Post-review update: the user accepted options 1A–6A from `decision_options.md`.
The current brief now records those choices. The snapshot and raw findings remain
unchanged as historical evidence; no re-audit or readiness approval is implied.

Amend the brief with accepted behavioral defaults for A1–A6, then write the
detailed design and implementation plan. A7–A9 are supporting document work.
The review does not require another open-ended product interview: the suggested
defaults can be accepted together or adjusted by item. Do not change application
code on the strength of this review alone.
