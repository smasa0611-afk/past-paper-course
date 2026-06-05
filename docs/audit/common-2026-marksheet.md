# 2026 Common Test Marksheet Audit

Checked against the current `common/2026/*/marksheet.json` files and the local official `answer.pdf` files.

## Summary

- `english` is structurally OK for the current data: answer labels are continuous `1` to `44`.
- `math_ia` is structurally OK for the current data: answer labels reset from `ア` by major question, and choices are `-`, `0` to `9`.
- Most 2026 choice subjects generated from official answer PDFs are not OK: the importer read the two-column answer table in PDF text order, so labels are interleaved or missing.
- `math_iibc` and `information_i` are not OK for the right-side UI: labels such as `ア` are de-duplicated across major questions instead of resetting per major question.
- Composite subjects (`science_basics`, `integrated_history_public`) need a separate UI/data decision because one official answer PDF contains multiple selectable component sections.

## Subject-by-subject status

| Subject | Current status | Notes |
| --- | --- | --- |
| `english` | OK | Current labels are continuous `1` to `44`. |
| `english_listening` | Needs rebuild | Current count is `22`; official table shows continuous answer labels through `37`. |
| `japanese` | Needs rebuild | Current count is `17`; official table shows answer labels through `37`, including `20-21`. |
| `geography` | Needs reorder/rebuild | Current count is `30`, but labels are interleaved like `1,15,2,16...`; UI should be continuous `1` to `30`. |
| `japanese_history` | Needs rebuild | Current count is `12`; official table shows answer labels through `34`, with conditional scoring around answer number `16`. |
| `world_history` | Needs rebuild | Current count is `16`; official table shows answer labels through `32`. |
| `public_ethics` | Needs reorder/rebuild | Current count is `32`, but labels are interleaved like `1,18,2,19...`; UI should be continuous `1` to `32`. |
| `public_politics_economy` | Needs rebuild | Current count is `11`; official table shows answer labels through `34`, with conditional scoring around answer numbers `9` and `21`. |
| `integrated_history_public` | Needs redesign/rebuild | Current data mixes component sections. Official PDF contains multiple selectable sections with repeated labels such as `101-116`. |
| `science_basics` | Needs redesign/rebuild | Current data mixes multiple basic-science component sections. Official PDF contains repeated component-specific labels such as `101-116`. |
| `physics` | Needs rebuild | Current count is `18`; official table shows continuous answer labels `1` to `22`. Current labels include invalid/non-choice entries such as `A`. |
| `chemistry` | Needs reorder/rebuild | Current count is `33`, but labels are interleaved like `1,19,2,20...`; UI should be continuous `1` to `33`. |
| `biology` | Needs rebuild | Current count is `23`; official table shows answer labels through `25`, including omitted labels `7` and `8` in a grouped row. |
| `earth_science` | Needs rebuild | Current count is `12`; official table shows answer labels through `28`. |
| `math_ia` | OK | Current data groups by `第1問` to `第4問`; answer labels reset from `ア` per group. |
| `math_iibc` | Needs rebuild | Current count is `21`; labels are de-duplicated and not grouped by major question. |
| `information_i` | Needs rebuild | Current count is `17`; labels are de-duplicated and not grouped by major question. |

## Missing Files

For the registered `common` exam directories, every subject directory currently has:

- `problem.pdf`
- `answer.pdf`
- `metadata.json`
- `marksheet.json`

There are no missing files inside the registered year/subject directories. Years before 2022, such as 2013, are not present under `common/` at all.
