---
'@requested/export': minor
---

Support the `label_values` format used by `pending_follow_requests.json`.

Validated against a real August 2026 export: sent follow requests are stored as a bare array of `{timestamp, media, label_values, fbid}` entries, **not** the `string_list_data` shape used by `following.json` — the two formats coexist in the same archive. Records also leave `URL` blank in the overwhelming majority of cases (377 of 390 in the sample), so profile links are synthesised from the handle.

`collectStringListData` is replaced by `collectRelationships`, which handles both formats and returns a normalised `RawRelationship`. Username labels are matched case-insensitively across locales.
