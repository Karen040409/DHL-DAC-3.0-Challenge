# Workflows/UpdateStatus.xaml

Advances an article to `Reviewed` or `Published`. Recorded in `article_status_history`
on the server, so the **Viewer → History** modal shows the bot run.

## Arguments

| Direction | Name | Type | Purpose |
|-----------|------|------|---------|
| In | `in_ArticleId` | `Int32` |  |
| In | `in_NewStatus` | `String` | `Reviewed` or `Published` |
| In | `in_Config` | `Dictionary<String,String>` |  |
| Out | `out_Updated` | `Boolean` | true if response 200 |

## Activities

1. **HTTP Request**
   * **Endpoint**: `in_Config("ApiBaseUrl") + "/api/articles/" + in_ArticleId.ToString()`
   * **Method**: `PUT`
   * **Body format**: `application/json`
   * **Body**:
     ```
     "{""status"":""" + in_NewStatus + """,""actor_user_id"":" + in_Config("CreatorUserId") + "}"
     ```
   * **Headers**: `Content-Type = application/json`
2. **If StatusCode = 200** → `out_Updated = True`, increment `io_Counters("Updated")`
3. **Else** → Log warning and throw to let the orchestrator's Catch handle it.

## Notes

* The API enforces the allowed enum (`Draft|Reviewed|Published`) and rejects others.
* The Viewer's **History** modal will show `Draft → Reviewed (bot)` once you
  configure the bot's user under `CreatorUserId`.
