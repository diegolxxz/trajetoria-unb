# Task 3 evidence

Implemented validated semester catalogs in Turmas and Grade. Entries require a string four-digit year followed by .1/.2 and a simple ASCII filename ending in .json (letters, digits, hyphens and underscores); nulls, traversal, absolute paths and query strings are filtered before options or fetches. Non-array catalogs become empty catalogs.

Turmas checks catalog membership before fetching and restores its previous valid choice for invalid events. Empty catalogs clear and disable the select. Grade rejects unknown choices before creating or recording a plan, restores the current selection and retains all existing historical-backup loading paths. Historical plans with unavailable offers still restore and show the existing unavailable-offer message.

Controller explicitly authorized the additional minimal grade-arquivos.js regex alignment and grade-arquivos.test.cjs regression: otherwise a valid 2100.1 catalog semester could not be saved. Storage keys and backup format are unchanged; calendar validation is unchanged.

## RED evidence

- `node --test tests/turmas-interface.test.cjs tests/grade-interface.test.cjs`: 8 tests, 4 existing passed, 4 new failed before implementation. Catalog tests exposed invalid items preventing population; empty-catalog test exposed retained placeholder. Historical/selection value assertions initially also exposed Linkedom having no select.value setter; fixtures now emulate writable browser values explicitly.
- `node --test tests/grade-arquivos.test.cjs`: 9 tests, 8 passed, new 2100.1 roundtrip failed with invalid-backup error before regex alignment.
- An initial test-writing command failed on Python default cp1252 decoding before any write; corrected all file operations to UTF-8.

## GREEN evidence

- `node --test tests/turmas-interface.test.cjs tests/grade-interface.test.cjs tests/grade-arquivos.test.cjs`: 18 passed, 0 failed.
- `bun run build:verified`: exit 0; JS/CSS/HTML lint, deploy formatting, source checks, all 52 JavaScript tests, static build and dist checks passed. Source and dist each verified 11 pages, 5 editais and 1684 candidates; build generated 18 entries.
- `uv run pytest -q`: 36 passed, 5 subtests passed.
- `git diff --check`: passed (only expected Windows LF-to-CRLF notices).

## Self-review

Verified changes stay in the isolated worktree and touch only semester selectors, their tests, the required backup regex/test and this report. No dependencies, public URLs, local/dados.json, storage keys or storage schema changed. No push, merge or deploy performed. Tests isolate storage in in-memory Maps and do not write user data. Existing backup restoration and unavailable-offer behavior remain intact. Tests cover invalid catalog items, empty/null-literal/unknown changes without extra fetch or plan mutation, 2027.1 valid switching, historical 2020.1 restoration with empty catalog, and 2100.1 UI persistence plus backup roundtrip. No real-browser interaction was performed; DOM behavior is exercised with Linkedom and explicit select.value emulation.
