# Common Test Source Verification

Scope: local `common/2022` through `common/2026` directories.

## Official Source Pages

- 2022 / Reiwa 4: https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r4/index.html
- 2023 / Reiwa 5: https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r5/index.html
- 2024 / Reiwa 6: https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r6/index.html
- 2025 / Reiwa 7: https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r7/
- 2026 / Reiwa 8: https://www.dnc.ac.jp/kyotsu/shiken_jouhou/r8/index.html

The DNC 2026 page currently says the exam problems will be posted after copyright processing is complete, while the official answer PDFs are already posted. Therefore, local 2026 `answer.pdf` files can be checked against DNC, but local 2026 `problem.pdf` files currently come from Asahi problem PDFs rather than DNC-hosted problem PDFs.

## Local File Presence

All registered local `common/2022` through `common/2026` subject directories contain:

- `problem.pdf`
- `answer.pdf`
- `metadata.json`
- `marksheet.json`

No registered local common-test subject directory is missing one of those four files.

## Import Source Notes

- 2022 files were imported from `edu.chunichi.co.jp/site_home/center/pdf` by `exam-system/scripts/import_common_2022_subjects.py`.
- 2023 files were imported from DNC problem/answer pages by `exam-system/scripts/import_common_2023_subjects.py`.
- 2024 files use Asahi problem PDF URLs and DNC answer PDF URLs in `exam-system/scripts/import_common_2024_subjects.py`.
- 2025 files use Asahi problem PDF URLs and DNC answer PDF URLs in `exam-system/scripts/import_common_2025_subjects.py`.
- 2026 files use Asahi problem PDF URLs and DNC answer PDF URLs in `exam-system/scripts/import_common_2026_subjects.py`.

## Follow-up Check Needed

For a strict byte-for-byte source audit, download the currently published DNC problem PDFs for 2022-2025 and compare SHA-256 hashes against local `problem.pdf` files. This was not done in this pass because the immediate correction target was the right-side marksheet UI and answer selection data.
