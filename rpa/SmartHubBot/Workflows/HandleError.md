# Workflows/HandleError.xaml

Runs from the inner Try/Catch (one per file). Captures evidence, appends to logs,
and records the failure server-side so the summary email is accurate.

## Arguments

| Direction | Name | Type | Purpose |
|-----------|------|------|---------|
| In | `in_Exception` | `System.Exception` | from the Catch branch |
| In | `in_File` | `String` |  |
| In | `in_Hash` | `String` | may be `""` if hashing itself failed |
| In | `in_Config` | `Dictionary<String,String>` |  |

## Activities

1. **Assign**:
   `strShotPath = "Logs\screenshots\" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + "_" + Path.GetFileNameWithoutExtension(in_File) + ".png"`
2. **Create Directory** `Path.GetDirectoryName(strShotPath)`.
3. **Take Screenshot** activity:
   * `FileName` = `strShotPath`
   * Output is saved automatically.
4. **Append Line** to `io_LogPath`:
   `DateTime.Now.ToString("o") + "  FAILED  " + Path.GetFileName(in_File) + "  " + in_Exception.GetType().Name + "  " + in_Exception.Message`
5. **HTTP Request** — server log
   * `POST /api/ingestion/log`
   * Body: `{"content_hash": in_Hash, "source_path": in_File, "outcome": "failed", "message": in_Exception.Message}`
6. **Add Data Row** to `io_LogTable` with `Outcome = "Failed"`, `Notes = in_Exception.Message`.
7. Increment `io_Counters("Failed")`.

## Notes

* Wrap **the Catch** itself in a Try/Catch — if the API is down, you still want
  the screenshot/log on disk for the post-mortem.
* For sensitive screens, redact regions before saving (UiPath has
  **Hide on Screen** patterns); not needed for the demo data.
