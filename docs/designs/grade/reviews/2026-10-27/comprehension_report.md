# Stage 6: Comprehension

Reviewer: `egm_grade_comprehension`, fresh context, EGM comprehension persona.
Target: `../../concepts_brief.md`, lines 1–106.
Standard: installed `re-implementation-standard.md`.

## Verdict

Five Major gaps in observable feature behavior. These are not requests to choose
internal algorithms, private data structures or implementation syntax.

The brief clearly establishes alternatives per subject, individual generation
participation, reversible visibility and subject-to-time schedule equivalence.
It does not yet establish the same observable behavior for every fresh reader.

## C1 — Major: Compatibility of unchecked subjects

Target lines: 41–46, 72–76.

Compatibility refers to a complete assignment of current required subjects, while
unchecked subjects must remain inspectable for classes that might fit. It is not
specified whether testing an unchecked candidate temporarily adds that candidate.

Example: required A has Monday 08:00. Unchecked B has Monday 08:00 and Tuesday
08:00. A is feasible without B, but only Tuesday B can join it. Literal readings
could retain either both B classes or only Tuesday B.

Resolve whether an unchecked subject or extra must fit alongside all enabled
required subjects. Also state whether checking a particular class of a required
subject replaces that subject's other alternatives during the check.

## C2 — Major: Selection universe of “select every class”

Target lines: 22–25, 39–40, 48–51, 74.

Allowed classes and visible classes are separate sets. The select-all action has
no explicit universe, and applying edits does not define the fate of hidden
previously allowed classes.

Example: A and B are offered, but the seat filter shows only A. Select all,
apply, then remove the filter. Either both classes or only A could remain allowed.

Define whether select-all means all offered or all visible classes. Define whether
applying under filters retains hidden selections or replaces the whole allowed set.

## C3 — Major: Display filters versus generator eligibility

Target lines: 22–25, 37–44, 68–76.

Filters cannot disable subject participation, but it is not explicit whether
they remove individual classes from the generator's eligible candidates.

Example: required A allows A1 with seats and full A2. Only A2 fits required B.
After enabling the seat filter, A2 is hidden. A generator using saved candidates
can still produce A2+B; intersecting with the filter produces no complete result.
Both interpretations preserve A's participation.

Define which filters constrain generation and which only change display. State
whether compatibility is evaluated using the same seat-filtered candidate universe.

## C4 — Major: Mapping existing saved plans to new choices

Target lines: 9–11, 45–51, 84–86, 98–99.

The existing format preserves priorities and one selected class snapshot. The
proposal introduces participation and multiple allowed classes. The observable
mapping is missing; storage format and migration mechanics can remain deferred.

Example: an old plan has required A with selected A1 and optional B without a
selection. After upgrading, A might permit only A1 or all offered classes. B might
start enabled as an extra or disabled in the comparison list.

Specify participation and allowed-class defaults for existing plans and imported
old backups. Specify how a saved selection absent from the current offer appears.

## C5 — Major: Applying zero allowed classes

Target lines: 17–18, 45–51, 55–66.

An editor applies a replacement set, but the empty-set meaning is undefined.
Allowed classes and subject participation are separate choices. The Python
reference's fallback does not resolve the proposed inclusion editor's behavior.

Example: required A remains enabled. The user marks no classes and applies.
Possible outcomes are rejected edits, zero eligible candidates, or unrestricted
classes. These produce different results.

Define whether zero allowed classes is permitted. If permitted, distinguish zero
candidates from unrestricted selection. If prohibited, describe validation that
keeps the previous selection intact.

## Read receipts

The reviewer reported all required files accessible:

- Full EGM comprehension persona and re-implementation standard.
- Full target (1–106), `/grade/index.html` and `docs/grade.md`.
- Python: class definitions, schedules, availability filters, profile interface,
  candidate filtering and generator/result application. No private save files.
- `grade.js`: loading, mutation, subject/class controls, generation, plan switches,
  undo/redo and import/export.
- `grade-calculos.js`: parsing, identity and combinations.
- `grade-arquivos.js`: validation, history and calendar export.

No source edits, builds or tests were performed.
