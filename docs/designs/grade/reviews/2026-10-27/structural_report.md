# Stage 7: Structural lens

Reviewer: `egm_grade_structure`, fresh context. Persona: EGM structural.
Standard: `feature-spec-standard.md`. Target: lines 1–106.
Verdict: three Major findings, no Blocker.

## Heading map

H1: Grade builder (1). H2: Overview (7), Confirmed behavior (15), Proposed handling
of incomplete results (53), Goals vs. Non-Goals (82), Remaining Review Points (91),
Key Decisions & Staging for Next Steps (101).

Hierarchy and Markdown lists are valid. There are no tables, code fences or
Markdown hyperlinks. The standard's literal heading names are not mandatory;
equivalent content counts.

## S1 — Major: Missing conceptual architecture coverage

Target: 9–13, 15–80. The interaction rules do not explain the relationship among
comparison membership, participation, allowed classes, filtered views and committed
choices through the UI, engine, Worker and persistence boundary.

Add a short state/data-flow description: selection, filtering, generation, grouped
results, explicit application. Identify existing ownership and which decisions
survive save/load and undo/redo. Detailed schemas and algorithms remain deferred.

## S2 — Major: Alternatives coverage is incomplete

Target: 24–25, 32–36, 45–51, 53–80. The brief already rejects filter relaxation,
a global extras switch, automatic reduction and duplicated controls. Alternatives
are therefore not entirely absent. However, the main priority and compatibility
choices lack evaluation of competing viable approaches and their costs.

Add a compact alternatives evaluation with rejection reasons. Reuse existing
rationale instead of repeating the whole requirements list.

## S3 — Major: Risk coverage is partial and deferred

Target: 72–80, 87–89, 97–99. Search uncertainty and browser blocking have mitigations.
Compatibility cost and persistence appear only as future review topics. Security
implications are not assessed. The current normalizer discards fields outside
its present known shape, so additional state needs preservation through that boundary.

Add risks/mitigations for computation, saved/imported choices and local input
validation. If no new security boundary is introduced, state that and name the
existing validation boundary to preserve.

## Read receipts

All required files accessible. Full structural persona, feature standard and target.
Python reference 1628–1782 and 2137–2210. Existing site: `/grade/index.html` 108–160;
`grade.js` 182–282 and 406–457; `grade-calculos.js` 72–130; `grade-arquivos.js` 1–104;
`docs/grade.md` 1–37. The Python inline-code path resolves through the supplied
external location; it is not a broken Markdown hyperlink, but is not navigable.
No edits, builds or tests.
