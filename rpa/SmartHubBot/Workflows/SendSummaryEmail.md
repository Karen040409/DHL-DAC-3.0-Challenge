# Workflows/SendSummaryEmail.xaml

Final activity in `Main.xaml`. Builds a tabular summary, attaches the run log and
processing log, and sends to `Config("AdminEmail")`.

## Arguments

| Direction | Name | Type | Purpose |
|-----------|------|------|---------|
| In | `in_Counters` | `Dictionary<String,Int32>` | Created/Updated/Duplicates/Failed |
| In | `in_LogPath` | `String` | Plain-text run log |
| In | `in_LogTablePath` | `String` | Path to `ProcessingLog.xlsx` |
| In | `in_Config` | `Dictionary<String,String>` |  |

## Activities

1. **Assign** `strBody` (HTML):
   ```
   "<h2>SmartHubBot summary — " + DateTime.Now.ToString("u") + "</h2>" &
   "<table border='1' cellpadding='6' cellspacing='0'>" &
   "<tr><th>Created</th><th>Updated</th><th>Duplicates skipped</th><th>Failed</th></tr>" &
   "<tr><td>" & in_Counters("Created") & "</td>" &
   "<td>" & in_Counters("Updated") & "</td>" &
   "<td>" & in_Counters("Duplicates") & "</td>" &
   "<td>" & in_Counters("Failed") & "</td></tr>" &
   "</table>" &
   "<p>Logs are attached. Full audit trail: " & in_Config("ApiBaseUrl") & "/api/ingestion/recent</p>"
   ```
2. **Send SMTP Mail Message**:
   * **Server**: `in_Config("SmtpHost")`
   * **Port**: `CInt(in_Config("SmtpPort"))`
   * **Email**: `in_Config("SmtpUser")`
   * **Password**: Orchestrator asset `SmartHub_SmtpPassword`
   * **To**: `in_Config("AdminEmail")`
   * **Subject**: `"[SmartHub] RPA run summary — " + DateTime.Now.ToString("yyyy-MM-dd HH:mm")`
   * **Body**: `strBody`
   * **IsBodyHtml**: `True`
   * **Files / Attachments**: `{ in_LogPath, in_LogTablePath }`

## Fallback (no SMTP available in demo)

Use **Outlook Mail Message** activity instead and pass the same parameters; or
**Write Text File** to `Logs/summary-YYYYMMDD.html` so the grader can open it
from disk during the recorded demo.
