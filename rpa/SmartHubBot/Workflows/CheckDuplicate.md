# Workflows/CheckDuplicate.xaml

Asks the SmartHub API whether this content has been ingested in the last 14 days.
Server is the source of truth — Excel log is optional/local.

## Arguments

| Direction | Name | Type | Purpose |
|-----------|------|------|---------|
| In | `in_Text` | `String` | Plain text from `ReadInput.xaml` |
| In | `in_File` | `String` | Used only for logging |
| In | `in_Config` | `Dictionary<String,String>` | Has `ApiBaseUrl` |
| Out | `out_IsDuplicate` | `Boolean` |  |
| Out | `out_ExistingArticleId` | `Int32` | 0 when not a duplicate |
| Out | `out_Hash` | `String` | SHA-256 hex of `in_Text` |

## Activities (in order)

1. **Generate Hash** activity
   * **Algorithm**: `SHA256`
   * **Input**: `System.Text.Encoding.UTF8.GetBytes(in_Text)`
   * **Result**: `out_Hash` (already lowercase hex)
2. **HTTP Request** (UiPath.WebAPI.Activities):
   * **Endpoint**: `in_Config("ApiBaseUrl") + "/api/ingestion/check-duplicate"`
   * **Method**: `POST`
   * **Body format**: `application/json`
   * **Body**:
     ```
     "{""content_hash"":""" + out_Hash + """,""window_days"":14}"
     ```
   * **Headers**: `Content-Type = application/json`, `Accept = application/json`
   * **Result**: store **Result** to `strResp` (String)
3. **Deserialize JSON** (UiPath.Web.Activities or Newtonsoft):
   * Input: `strResp`
   * Output: `jResp` (JObject)
4. **Assign**:
   * `out_IsDuplicate = CBool(jResp("duplicate"))`
   * `out_ExistingArticleId = If(jResp("article_id") IsNot Nothing AndAlso jResp("article_id").Type <> JTokenType.Null, CInt(jResp("article_id")), 0)`
5. **If `out_IsDuplicate`**:
   * **Log Message** Info `"DUPLICATE — last seen " + jResp("last_seen_at").ToString() + " article #" + out_ExistingArticleId.ToString()`
   * Increment `io_Counters("Duplicates")`
   * **HTTP Request** POST `/api/ingestion/log` with body
     `{"content_hash": out_Hash, "source_path": in_File, "outcome": "duplicate"}` so the server log records this run too.

## Notes

* If you prefer to ship the **whole text** to the server and let Node hash it,
  pass `{"text": in_Text}` instead of `content_hash` — same endpoint.
* The 14-day window comes from the assignment requirement.  The endpoint accepts
  `window_days` to make demos easier (e.g. set it to `1` to retest fast).
