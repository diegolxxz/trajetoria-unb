# Grade options: focused correction plan

Scope: only the existing `/grade/` options/editor interface. The user requested
review, findings, then correction. Keep the previously chosen consolidated review
mode. Do not change the engine, data, routes, storage schema or other public pages.

## Problem and observed evidence

The current options disclosure sits inside the action flex container. Opening it
changes grid placement through `:has()` and moves the existing action controls.
The manual timetable selector is hidden behind another disclosure. The terms
used for generation restrictions, saved manual classes and priority overlap.
Unrelated plan mutations also close the inclusion editor and discard its draft.

Fresh screenshots at 1440, 390 and 320 px are stored outside the repository as
`grade-options-*.png` in the conversation's visualization directory. Read-only
EGM zoom-out and comprehension reviewers identified these problems independently.

## Intended behavior

Keep the compact closed row. The options trigger remains beside “Escolher turmas”
when opening or closing it. Its content is a separate full-width sibling below
the row, not an expanding child of the action flex container. An explicit button
must expose expanded state and its controlled panel for keyboard and touch use.

Within the panel, show two clearly labeled native fields: generator priority
(required or extra) and the selected class in the saved manual timetable. The
manual field is immediately visible, without a nested disclosure. Explain that
the manual choice does not restrict the generator. Keep reset and deletion in a
separate action row with names that describe their scope.

Preserve uncommitted class markings during same-plan changes to filters,
participation, priority and manual selection. Reopening the same class editor
must not recreate its draft. If another subject's editor is requested, keep the
current draft and ask the user to Apply or Cancel it before switching; do not
silently replace it. Close drafts on explicit Apply/Cancel, subject removal or
plan/semester change. Treat “Permitir todas no gerador” as an explicit application
of the unrestricted mode; label this effect and close that subject's draft.

Keep selected extras visible under the existing extras filter. Keep generated
combinations expanded. These already accepted behaviors are not being redesigned.

The subject being edited must also remain visible under the extras filter, even
when deactivated. The editor is independent of Options and remains reachable
when that panel closes. Give its controls stable IDs, preserve focused controls
on rerender and return focus to the class-choice trigger after Apply/Cancel.
Reentry or a blocked switch focuses the existing editor search. Opening Options
keeps focus on its trigger, following disclosure-button behavior.

If closing an inactive extra removes its row, focus falls back to the subject
search. Explicit Undo/Redo and backup import replace the working state and close
the draft, even for the same plan ID. Verify these exceptions. The participation
label needs a wider grid track than the old 44 px checkbox-only column; verify
its wrap at 320 px. Focus is checked in the real browser because Linkedom stubs it.

Show “Usar no gerador” beside the participation checkbox. Explain that required
priority applies only to participating subjects. Rename the extras filter to
“Ocultar extras fora do plano” and describe that subjects enabled in the generator,
with a saved class, or currently being edited remain visible.

## Alternatives considered

A native disclosure with relocated content would need more positioning rules to
keep its summary in the action row; an explicit sibling button/panel makes that
placement stable. A priority checkbox has less text but does not show the two
choices together; a native required/extra select names both. Multiple simultaneous
drafts would allow free switching but require more lifecycle state. Keep one
editor and preserve it, with an explicit Apply/Cancel step before switching.

## Detailed Implementation Plan

1. Modify `public/js/grade.js` only at the options/editor/state glue. Keep all
   calculation and persistence APIs. Render a sibling panel with a stable ID,
   labelled trigger, `aria-controls`, `aria-expanded`, and hidden state. Preserve
   open panels during re-rendering. Preserve same-plan draft objects except on
   the explicit close/reset/removal/switch actions above. Use a native priority
   select, show the manual select directly, clarify control labels, and announce
   removal with the existing message region and existing undo path.
2. Modify `public/css/grade.css`: remove the expansion-dependent parent grid
   rewrites. Span the new panel across all columns, keep fields in two columns
   on desktop and one on phones, retain 44 px controls, 16 px coarse-pointer
   inputs, focus outlines and horizontal containment.
3. Modify `public/grade/index.html` only where existing help calls extras optional,
   to keep terminology aligned. Do not touch other pages or shared CSS.
4. Modify `tests/grade-interface.test.cjs`: observe RED before implementation
   for same-editor re-entry, unrelated mutations preserving draft work, and the
   stable expanded-panel semantic contract. Verify explicit Apply/Cancel/reset,
   existing saved choices and selected-extra behavior remain intact.
5. Update `docs/grade.md` and this focused review's report with the actual scoped
   behavior and verification. No AGENTS, README or other page changes are needed.
6. Verify desktop and 390/320 px with isolated browser contexts. Compare trigger
   and class-choice button positions before and after opening; verify direct
   manual selection, priority, allowed-set reset, filter changes during editing,
   Apply/Cancel and state persistence. Run the existing JavaScript and site build
   verification. Do not claim physical phone testing. Do not commit.

## Existing boundaries and limits

The saved manual class remains independent of allowed generator classes. No new
storage field, worker, route, dependency, dialog framework or account is added.
Changing wording must not change the meanings of `obrigatoria`, `ativa`,
`permitidas` or the existing filter fields. Corrections are local to the view and
uncommitted editor lifecycle. Browser verification uses a bounded inspection and
at most one confirmation pass, not an open-ended styling loop.
