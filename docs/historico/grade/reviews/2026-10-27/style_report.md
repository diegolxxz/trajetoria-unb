# Stage 7: Style lens

Reviewer: `egm_grade_style`, fresh context. Persona: EGM style.
Standard: relevant clarity/objectivity requirements of `feature-spec-standard.md`.
Target: lines 1–106. Verdict: one Major, two Nits, no Blocker.

## T1 — Major: Stale process instructions

Target: 5, 97, 103–106. Readiness is described as pending even though review is now
underway. A fresh reader may repeat a completed gate or think this review is premature.

After verifying gate state, replace status with “Concepts brief under review.
Not approved for implementation.” Replace obsolete next-step instructions with
“Resolve review findings and obtain alignment on the brief before proceeding to
detailed design. This brief is not an implementation plan.”

## T2 — Nit: Editing remnant

Target: 32–36, especially 33–34. “The exact user chooses each subject” has an
unintended meaning and interrupts the flow requirement.

Suggested wording: “In both flows, the user chooses each subject and may restrict
it to several acceptable classes. The generator then chooses one allowed class
per included subject.”

## T3 — Nit: State schedule equivalence first

Target: 28–31. “Only the teacher or class changes” can include a class whose times
change; later sentences narrow it to the intended subject-to-time equivalence.

Suggested wording: “Group results with identical subject-to-time assignments into
one timetable, even when their teachers or class identifiers differ. Keep the
class alternatives accessible within that result, with their count and a grouping
notice. Swapping two subjects' times produces a different timetable even when the
occupied hours are identical.”

## Read receipts

Full style persona, feature standard and target read. Python excerpts approximately
856–876, 915–946, 1628–1796, 1804–1838 and 2111–2259. Site excerpts: HTML 106–157;
`grade.js` 183–281 and 400–453; full `grade-calculos.js`; `grade-arquivos.js` 21–75.
Relevant introduction, priorities, filtering, plans, backup and search passages in
`docs/grade.md` read; a combined output truncated a small unrelated hours section.
All required files accessible. No edits, builds or tests.
