# Stage 5: Initial zoom out

Reviewer: `egm_grade_zoom_initial`, fresh context, EGM zoom-out persona.
Target: `../../concepts_brief.md`, lines 1–106.
Standard: installed `zoom-out-standard.md`.

## Verdict

Pass with one Nit. No Blocker or Major finding at this review altitude. This is
not feature approval or implementation readiness approval.

The brief addresses the planner's purpose and stays at concept level. Comparison
list membership, generator participation and required/extra priority each have a
current user-facing purpose. No new service, remote persistence system or
speculative framework is proposed.

## ZO1 — Nit: Name the existing browser boundaries to reuse

Affected target lines: 9–13, 84–89.

The Python application is named as the interaction reference, but the brief does
not name the substantial browser functionality already available for extension.
A fresh implementer could mistake the work for a replacement or a Python port.

Code search found these reuse points:

- `public/js/grade-calculos.js:23–53`: schedule parsing and conflicts.
- `public/js/grade-calculos.js:72–127`: one class per subject, required subjects,
  optional omissions, bounded search and search status.
- `public/js/grade-worker.js:1–12`: Worker transport and result/node limits.
- `public/js/grade.js:182–280`: subject controls, selected snapshots and missing
  offer notices.
- `public/js/grade.js:406–457`: generator requests, seat filtering and result
  application.
- `public/js/grade-arquivos.js:50–98`: normalization and history boundaries.

Additional candidate and participation state must eventually pass through the
normalization/history boundary. Merely adding fields in the interface will not
preserve them in backups.

Recommendation: add a brief reuse statement and extend the existing planner,
calculation module, Worker and persistence module. Leave schema evolution and
algorithm changes for the design stage.

The Python available-class filter compares candidates with the selected timetable
(`_calcular_disponiveis`, lines 913–947). The brief asks for feasibility across
alternative assignments. The Python generator uses capped Cartesian products
(`_gerar_executar`, lines 2137–2258); the browser already prunes conflicts during
search. Reusing browser logic is the smaller approach.

These are documentation and reuse observations. Current code not yet implementing
the proposed additions is not classified as a code defect.

## Read receipts

The reviewer reported all required files accessible:

- Full EGM `agents/zoom_out.md` and `resources/document_standards/zoom-out-standard.md`.
- Full target, project README and `docs/grade.md`.
- `/grade/index.html`: controls and timetable/export sections.
- `grade.js`: loading, subject rendering and generation; remaining declarations searched.
- Full `grade-calculos.js` and `grade-worker.js`.
- `grade-arquivos.js`: lines 1–105 and remaining declarations searched.
- Reference Python: parsing, conflicts, profile lists, save/restore, availability
  filtering and generator preparation/execution sections. No personal save files.

No source edits, builds or tests were performed.
