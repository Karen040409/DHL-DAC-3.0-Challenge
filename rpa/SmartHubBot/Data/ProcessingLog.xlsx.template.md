# ProcessingLog.xlsx (template)

Single sheet **`runs`** with these columns. Each iteration of `Main.xaml`'s
For Each File appends one row. The server also stores this in `processing_log`
table via `POST /api/ingestion/log`, but keeping a local copy makes the
UiPath-only screen recording easier to grade.

| Column | Type | Notes |
|--------|------|-------|
| `Timestamp` | DateTime | `DateTime.Now` |
| `FileName` | String | `Path.GetFileName(in_CurrentFile)` |
| `SHA256` | String | from **Generate Hash** activity |
| `Outcome` | String | `Created`, `Updated`, `Duplicate`, `Failed` |
| `ArticleId` | Int32 | from POST response when applicable |
| `Notes` | String | error message or `OK` |
