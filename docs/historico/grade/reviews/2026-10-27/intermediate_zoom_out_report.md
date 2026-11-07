# Stage 8: Intermediate zoom out

Reviewer: `egm_grade_zoom_final`, fresh context, EGM zoom-out persona.
Standard: `zoom-out-standard.md`. Target: unchanged brief, lines 1–106, plus all
Stage 5–7 reports.

## Verdict

Pass at concept altitude, with unresolved behavioral decisions and design risks.
No Blocker, no new independent finding and no fundamental scope change required.
This is not implementation-readiness approval. None of the earlier findings has
been fixed because the target was not amended.

The distinction among comparison membership, participation, priority and allowed
classes is justified by present interactions. Extending the existing browser
planner is a credible direction; copying the Python generator is unnecessary.

## Behavioral and engineering priorities

1. **C3 — Major, first decision:** define the universe used by each filter and
   generation. Existing seat filtering constrains generator inputs, so a new
   display-only meaning would change behavior. Keep persistent choices separate
   from the derived filtered view.
2. **C1/D2 — Major:** define which inspected class is forced alongside enabled
   required subjects. Give examples for required subjects, extras, disabled
   subjects and no enabled required subjects. These are one decision group.
3. **C2/C5 — Major:** complete select-all, hidden-selection and empty-selection
   semantics. The two questions are related but independently observable.
4. **C4/D4 plus persistence from S3 — Major:** state legacy participation and
   allowed-set defaults, preserve committed choices independently, and retain
   unavailable references explicitly. Extend existing validation/history.
5. **D3/D5 — Major:** bound aggregate filtering/search work and retained variants,
   not just one search. Define cancellation, stale-response handling and incomplete
   counts. Use existing Worker and calculation boundaries. Exact thresholds and
   eager versus on-demand work belong in detailed design.
6. **D6 — Major:** allow achievable explanations. A jointly impossible request
   may have no conflicting pair. Distinguish sufficient evidence, proven absence
   of a solution and unresolved bounded search. Label partial alternatives.

## Proportionality and deduplication

- **ZO1/S1 — Nit at concept altitude.** A reuse/data-flow paragraph helps. Missing
  module ownership is not evidence that this concept lacks a viable architecture.
  It becomes necessary in detailed design. S1's raw Major severity is reduced here.
- **D1/S2 — Nit now, required design work later.** Compare meaningful cost
  alternatives in detailed design. Fixed-choice conflict checking alone is not
  behaviorally equivalent to the requested alternative-assignment filtering, so
  do not reopen accepted product behavior merely to populate an alternatives table.
- **S3 — Split, not another independent Major.** Its computation and preservation
  risks are already covered above. The proposal adds no account, remote store or
  external trust boundary. Preserve local validation without inventing another
  concept-level security failure.
- **T1 — Nit, subject to verified process state.** The pending-review wording is
  stale compared with the supplied reports. The fresh reviewer did not retrieve
  human history or claim independent knowledge of the readiness confirmation.
- **T2/T3 — Nit.** Repair the editing remnant and lead with the precise equivalence
  definition. These are wording repairs rather than architecture changes.

## What can proceed

The concept can proceed to detailed design after alignment on the brief and the
outstanding behavioral contracts. Reuse the browser UI, calculation, Worker and
backup/history modules. Treat Python as an interaction reference, not a source
for silent filter fallback or a replacement Cartesian-product generator.

This review does not establish browser latency, exhaustive grouped alternatives,
semantic migration correctness or implementation readiness. Those require further
design and verification.

## Read receipts

All required files accessible. Full EGM persona and standard; full brief; full
Stage 5, Stage 6, critic, design, structural and style reports; full README and
`docs/grade.md`; full `grade-calculos.js`, `grade-worker.js`, `grade-arquivos.js`.
`grade.js`: 1–111, 182–282, 406–458, 533–650 plus relevant searches. HTML: 107–179
without truncation plus control searches; an earlier truncated excerpt was not
claimed as a full read. Python: 760–795, 856–950, 1628–1840, 2071–2266 plus searches.
No private saves, credentials, history, memory, source edits, builds or tests.
