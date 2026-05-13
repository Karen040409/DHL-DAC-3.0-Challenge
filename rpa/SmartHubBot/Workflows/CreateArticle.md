# Workflows/CreateArticle.xaml

Creates a Draft via `POST /api/articles` and (optionally) uploads the source file
as an attachment via `POST /api/articles/:id/attachments`.

## Arguments

| Direction | Name | Type | Purpose |
|-----------|------|------|---------|
| In | `in_Text` | `String` | Extracted text body |
| In | `in_File` | `String` | Local path of the source file (for attach) |
| In | `in_Hash` | `String` | SHA-256 (passed to ingestion log) |
| In | `in_Config` | `Dictionary<String,String>` |  |
| Out | `out_NewArticleId` | `Int32` | API-assigned id |

## Activities

1. **Assign**
   * `strTitle = If(in_Text.Split({Chr(10)}, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault(), "Untitled draft").Trim().Substring(0, Math.Min(120, …))`
   * `strSummary = in_Text.Substring(0, Math.Min(in_Text.Length, 400))`
   * `strTags = "Logistics,SOP"` *(or derive from file path/folder name)*
2. **HTTP Request** — create draft
   * **Endpoint**: `in_Config("ApiBaseUrl") + "/api/articles"`
   * **Method**: `POST`
   * **Body format**: `application/x-www-form-urlencoded` *(works in UiPath without JSON escaping headaches)*
   * **Parameters** (form data):
     | Name | Value |
     |------|-------|
     | `title` | `strTitle` |
     | `summary` | `strSummary` |
     | `content` | `in_Text` |
     | `creator_id` | `in_Config("CreatorUserId")` |
     | `tags` | `strTags` |
   * **Result**: `strCreated` (JSON response)
3. **Deserialize JSON** → `jCreated`
4. **Assign**: `out_NewArticleId = CInt(jCreated("id"))`
5. **If File.Exists(in_File)** (attach source file):
   * **HTTP Request** — multipart upload
     * **Endpoint**: `in_Config("ApiBaseUrl") + "/api/articles/" + out_NewArticleId.ToString() + "/attachments"`
     * **Method**: `POST`
     * **Body format**: `multipart/form-data`
     * **Files**: add entry — Name=`files`, Path=`in_File`
     * **Parameters**: `uploaded_by` = `in_Config("CreatorUserId")`
     * On success: **Log Message** `"Attached " + Path.GetFileName(in_File)`
6. **HTTP Request** — server-side processing log
   * `POST /api/ingestion/log`
   * Body (JSON): `{"content_hash": in_Hash, "source_path": in_File, "outcome": "created", "article_id": out_NewArticleId}`
7. Increment `io_Counters("Created")`.

## Notes

* If you want the bot to auto-publish (skip human review), call
  `Workflows/UpdateStatus.xaml` next with `status = "Published"`.  Keep
  `actor_user_id` set to the bot user so the **Status history** modal shows who
  did it.
