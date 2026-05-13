# SmartHub RPA simulator

Node.js **demo insurance** for DHL SmartHub Scenario 1: it runs the same HTTP pipeline as the UiPath SmartHub bot against the real Express API (`POST /api/ingestion/check-duplicate`, `POST /api/extract`, `POST /api/articles`, attachments, ingestion log, optional status advance). Use it when UiPath Studio setup is fragile during recording, or as a quick **integration smoke test** for the API contract the bot uses.

**RPA design is still ~40% of the deliverable** — this script does not replace UiPath orchestration, config assets, or human-in-the-loop design documentation. It proves the backend wiring end-to-end.

## Requirements

- **Node.js 20 or later** (required by this repo’s simulator: stable `File`, `Blob`, and `FormData` for multipart `fetch`). The script exits with a clear message on older runtimes.
- Express API reachable at `API_BASE` (default `http://localhost:3001`).
- MySQL-backed app running so those routes succeed.

`package.json` lists `"engines": { "node": ">=18" }` for broad tooling compatibility; **actually run the simulator on Node 20+**.

## How to run

From the **workspace root** (so default `INPUT_DIR` resolves correctly):

```bash
node rpa/simulator/run.js
```

With CLI overrides:

```bash
node rpa/simulator/run.js --input path/to/folder --api http://localhost:3001 --creator 1 --advance
```

Or from this folder:

```bash
cd rpa/simulator
node run.js
```

If you use `cd rpa/simulator`, set `INPUT_DIR` to an absolute path or a path relative to that cwd.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `API_BASE` | `http://localhost:3001` | Express base URL (no trailing slash required). |
| `INPUT_DIR` | `rpa/SmartHubBot/Inputs` (resolved from `process.cwd()`) | Folder of files to process (non-recursive; files only). |
| `CREATOR_USER_ID` | `1` | `creator_id` / `uploaded_by` / optional `actor_user_id` when advancing status. |
| `WINDOW_DAYS` | `14` | Passed to `POST /api/ingestion/check-duplicate`. |
| `ADVANCE_TO_REVIEWED` | `false` | If `true`, after each successful create the script `PUT`s `status: "Reviewed"`. Same effect as `--advance`. |

## What the script does (per file)

1. Reads **raw bytes**, computes **SHA-256 hex** of the file (not only extracted text).
2. `POST /api/ingestion/check-duplicate` — on duplicate: logs `outcome: "duplicate"`, increments **Duplicates**, skips the rest.
3. By extension: **pdf / docx / txt / md / csv** → `POST /api/extract` (multipart `file`). **png / jpg / jpeg** → empty body text, `kind: "image"`, note that OCR would be needed for text.
4. Builds **title** (first non-empty line, max 120 chars, or `Untitled (<filename>)`), **summary** (first 280 chars), **tags** (filename heuristics + always `SOP`).
5. `POST /api/articles` with JSON `{ title, summary, content, creator_id, tags }`.
6. `POST /api/articles/:id/attachments` with the original bytes (`files`, `uploaded_by`).
7. `POST /api/ingestion/log` with `outcome: "created"` and `article_id`.
8. If `--advance` or `ADVANCE_TO_REVIEWED=true`: `PUT /api/articles/:id` with `{ status: "Reviewed", actor_user_id }`, increments **Updated**.

Errors are caught per file: **Failed** increments, stderr line in red (if TTY), and `POST /api/ingestion/log` with `outcome: "failed"` (best-effort if the API is down).

After the run: a **counter table** on stdout and an HTML report under `rpa/simulator/Logs/summary-YYYYMMDD-HHmmss.html`. Exit code **0** if no failures, **1** if any file failed.

## Stdout ↔ UiPath workflow mapping

UiPath workflow specs live under `rpa/SmartHubBot/Workflows/*.md`. Typical simulator lines map as follows:

| Simulator stdout | UiPath workflow doc | Notes |
|------------------|---------------------|--------|
| Startup block (`API_BASE=…`, `INPUT_DIR=…`, …) | `Main.xaml` (orchestration, not a separate `.md`) | Config load analogue. |
| `CREATED … article_id=…` | `CreateArticle.md` | Draft create + attachment + success path. |
| `note: …` (e.g. image / API warning) | `ReadInput.md` | Text extraction / image handling; warnings mirror bot logs. |
| `DUPLICATE …` | `CheckDuplicate.md` | Same duplicate API + skip create. |
| `REVIEWED …` | `UpdateStatus.md` | `PUT` to advance status when `--advance` / env is set. |
| `FAILED …` | `HandleError.md` | Per-file catch, server `failed` log, counter increment. |
| Summary counters + `HTML summary:` | `SendSummaryEmail.md` | Tabular summary; here written as HTML file instead of SMTP. |

**Note:** The UiPath `CheckDuplicate.md` design hashes **UTF-8 text**; this simulator hashes **raw file bytes** for `content_hash`, matching the user story for byte-stable dedupe on uploads. Align your bot with whichever rule your team standardises on.

## Zero runtime dependencies

Only Node built-ins and global `fetch` / `FormData` / `Blob` / `File` (Node 20+). No `npm install` required for the simulator package itself.
