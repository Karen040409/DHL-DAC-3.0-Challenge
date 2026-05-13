# SmartHubBot — UiPath project (Scenario 1 RPA)

This folder is a **UiPath Studio project** that automates the “raw messy input → clean Knowledge Base draft” flow described in **Scenario 1**. It calls the SmartHub web app's REST API for everything (no UI scraping required), which means the bot is fast, idempotent, and easy to demo.

> Open **`SmartHubBot.sln`** (UiPath also creates this automatically when you open `project.json` in Studio). The entry point is **`Main.xaml`**.

---

## What the bot does (functional requirement 5.2)

| Requirement | How this bot fulfils it |
|-------------|--------------------------|
| **Ingestion** | Reads new files from a watched folder (mock “Drive sync”). Path is configured in `Data/Config.xlsx`. Replace with **Google Drive Activities** or **POP3/IMAP → save attachment** for the real Drive/inbox flow. |
| **Duplicate check (14d)** | Hashes file content with **Generate Hash** activity (SHA-256). Calls **`POST /api/ingestion/check-duplicate`**. If `duplicate=true`, skip the file and increment `Duplicates` counter. |
| **Create + attach** | Calls **`POST /api/articles`** with title/summary/content/tags. Then uploads the source file to **`POST /api/articles/:id/attachments`** (multipart, field name `files`). |
| **Update status** | Optional **`PUT /api/articles/:id`** with `status="Reviewed"` and `actor_user_id` to advance the workflow programmatically (e.g. once OCR succeeds). |
| **Error handling** | Each iteration is wrapped in **Try/Catch**. The Catch branch runs `Workflows/HandleError.xaml`, which **Takes Screenshot** to `Logs/screenshots/`, appends a row to `Logs/run-YYYYMMDD.log`, and increments `Failed` counter. |
| **Summary email** | After the loop, `Workflows/SendSummaryEmail.xaml` sends an SMTP message to the admin with totals (Created, Updated, Duplicates, Failed) and attaches the run log + ProcessingLog.xlsx. |

---

## Files in this project

```
SmartHubBot/
├── project.json              # UiPath project descriptor
├── Main.xaml                 # Orchestrator (Try/Catch + For Each File)
├── Workflows/
│   ├── ReadInput.xaml        # Reads .txt/.pdf/.docx → strText (uses Read PDF Text / Word activities)
│   ├── CheckDuplicate.xaml   # Hash + POST /api/ingestion/check-duplicate
│   ├── CreateArticle.xaml    # POST /api/articles, optional file attach
│   ├── UpdateStatus.xaml     # PUT /api/articles/:id (status)
│   ├── HandleError.xaml      # Screenshot + log row + increment counter
│   └── SendSummaryEmail.xaml # SMTP summary with attachments
├── Data/
│   ├── Config.xlsx           # InputFolder, ApiBaseUrl, AdminEmail, SmtpHost…
│   └── ProcessingLog.xlsx    # Persistent row-per-file audit (optional, server log is the source of truth)
├── Inputs/                   # Sample messy files (Teams snippet, SOP text, screenshot)
├── Logs/                     # Created automatically at runtime
└── README.md                 # This file
```

> The `.xaml` files in this scaffold are documented **per-activity** in `Workflows/*.md`. Open each one in **UiPath Studio** and drag in the listed activities — variable names and argument types are already specified, so the bot composes cleanly. Submit the **`.xaml`** files (and a recorded run) as part of your 40% RPA design grade.

---

## Variables used across workflows (declare in `Main.xaml`)

| Name | Type | Purpose |
|------|------|---------|
| `in_Config` | `Dictionary<String,String>` | Loaded from `Data/Config.xlsx` |
| `io_Counters` | `Dictionary<String,Int32>` | Keys: Created, Updated, Duplicates, Failed |
| `io_LogPath` | `String` | `"Logs/run-" + DateTime.Now.ToString("yyyyMMdd") + ".log"` |
| `io_LogTable` | `DataTable` | Row schema: Timestamp, FileName, Hash, Outcome, ArticleId, Notes |
| `in_CurrentFile` | `String` | Full path passed to inner workflows |

---

## Config (`Data/Config.xlsx`, one sheet `settings`)

| Key | Example value |
|-----|---------------|
| `InputFolder` | `C:\SmartHub\Inbox` |
| `ApiBaseUrl` | `http://localhost:3001` |
| `AdminEmail` | `admin@dhl.example` |
| `SmtpHost` | `smtp.gmail.com` |
| `SmtpPort` | `587` |
| `SmtpUser` | `bot@dhl.example` |
| `SmtpPassword` | *(stored in Orchestrator asset for production)* |
| `CreatorUserId` | `1` |
| `DefaultStatusAfterCreate` | `Draft` |
| `AdvanceToReviewed` | `False` |

`Main.xaml` first activity is **Excel Application Scope → Read Range → Output To Data Table**, then a **For Each Row** that populates `in_Config(row("Key").ToString) = row("Value").ToString`.

---

## ProcessingLog.xlsx (audit row per file the bot considers)

| Column | Type | Notes |
|--------|------|-------|
| `Timestamp` | DateTime | `DateTime.Now` |
| `FileName` | String | `Path.GetFileName(in_CurrentFile)` |
| `SHA256` | String | output of `Generate Hash` (Algorithm = SHA256) on `File.ReadAllBytes(in_CurrentFile)` |
| `Outcome` | String | `Created` / `Duplicate` / `Failed` / `Updated` |
| `ArticleId` | Int32 | filled when API returns `id` |
| `Notes` | String | error message or `"OK"` |

Mirror is also written server-side via **`POST /api/ingestion/log`** so the **Viewer admin** can see runs even if the Excel file is lost.

---

## Run order (first time)

1. Set up the web app:
   ```
   mysql -u root -p dhl_kb < database/schema.sql
   mysql -u root -p dhl_kb < database/seed.sql
   ```
2. In **`backend/`**: `npm install && npm run dev`.
3. In **`frontend/`**: `npm install && npm run dev`.
4. In UiPath Studio: open this folder. Configure **`Data/Config.xlsx`**. Drop a `.txt`/`.pdf`/`.docx` into the `InputFolder`.
5. **Run `Main.xaml`**. Open the Viewer in the browser to see the new **Draft** + attachment.
6. Check the inbox set in `AdminEmail` for the summary mail.

---

## Mapping each functional requirement to a screen-recordable demo step

When you record the demo video, suggested flow:

1. Show the **InputFolder** with 3 files (`teams-export.txt`, `sop.pdf`, `screen.png`).
2. Run **Main.xaml** in Studio — the Output panel logs:
   - `Hash matched within 14 days, skipping <duplicate>`
   - `Created article #N from <file>`
   - `Attachment uploaded id=…`
3. Switch to the browser → **Viewer** → 2 new drafts appear with tags + attachment links.
4. Show the **Logs/run-YYYYMMDD.log** and **screenshots/** folder.
5. Show the **summary email** in the admin inbox (attach the log file).

This covers every bullet of section **5.2 RPA Automation**.
