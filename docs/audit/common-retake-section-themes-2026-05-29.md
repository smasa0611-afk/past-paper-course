# Common Retake Section Theme Audit

Date: 2026-05-29

Scope: weak reinforcement (`common_retake`) subjects from 2022 through 2026.

## Summary

- Total subject-year records: 97
- Official bundled source records: 55
- Placeholder source records: 21
- Partial source records: 21
- Records with retake-specific section themes: 15
- Records with retake-specific section themes and section points: 2
- Records whose existing marksheet sections are fully covered by retake-specific section themes: 14

The weak reinforcement data does not yet have complete retake-specific major-question themes for all subjects from 2022 through 2026. The previous state mixed a small number of manually entered entries with many missing retake entries, so it was not safe to say that every subject and year had been captured.

## Current Confirmed Entries

- `common_retake:2025:english`: 8 sections, points included. Rechecked against the National Center for University Entrance Examinations 2025 retake evaluation report and corrected section themes to the official descriptions.
- `common_retake:2025:math_ia`: 4 sections, points included.
- `common_retake:2025:math_iibc`: 7 sections, themes included, points still missing.
- `common_retake:2022:math_ia`: 5 sections, themes included.
- `common_retake:2022:math_iib`: 5 sections, themes included.
- `common_retake:2023:biology`: 6 sections, themes included.
- `common_retake:2023:math_iib`: 5 sections, themes included.
- `common_retake:2023:physics`: 4 sections, themes included.
- `common_retake:2024:math_ia`: 5 sections, themes included.
- `common_retake:2024:math_iib`: 5 sections, themes included.
- `common_retake:2025:biology`: 5 sections, themes included.
- `common_retake:2025:chemistry`: 6 sections, themes included.
- `common_retake:2025:information_i`: 4 sections, themes included.
- `common_retake:2025:integrated_history_public`: 1 section, themes included.
- `common_retake:2025:science_basics`: 2 sections, themes included.

## Source Caveats

- 2022 local retake PDFs are placeholders in metadata. For `math_ia` and `math_iib`, section themes were rechecked against the National Center for University Entrance Examinations R4 retake evaluation page index/search cache and public problem text pages; bundled local PDFs still need replacement by official files.
- 2023 and 2024 have official source metadata for most subjects, but retake-specific section themes have not been extracted into `section-themes.json`.
- 2026 records are marked `partial` locally. The National Center for University Entrance Examinations R8 page publishes official retake answers, but states that problem PDFs will be posted after copyright processing, so 2026 section themes should remain provisional until the official problem/evaluation source coverage is complete.

## Re-audit Command

```bash
cd exam-system
node scripts/audit-common-retake-section-themes.mjs
```
