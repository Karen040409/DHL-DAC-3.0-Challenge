# Workflows/ReadInput.xaml

Reads a single input file from disk (or Google Drive → local copy) and returns the
extracted plain text + a friendly MIME kind so the orchestrator can decide how to
hash and POST it.

## Arguments

| Direction | Name | Type | Purpose |
|-----------|------|------|---------|
| In | `in_File` | `String` | Absolute path to source file |
| Out | `out_Text` | `String` | Plain text contents (or `""` if binary) |
| Out | `out_MimeKind` | `String` | `text` / `pdf` / `docx` / `image` / `unknown` |

## Activities (in order)

1. **Assign** — `out_MimeKind = Path.GetExtension(in_File).ToLower().TrimStart("."c)`
2. **Switch** on `out_MimeKind`:
   - **Case `"txt"` or `"md"` or `"csv"`**
     - **Read Text File** — `Path = in_File`, output to `out_Text`
   - **Case `"pdf"`**
     - **Read PDF Text** (UiPath.PDF.Activities) — `FileName = in_File`, output to `out_Text`
     - If empty → **Read PDF With OCR** (Tesseract engine) as a fallback
   - **Case `"docx"`** or `"doc"`
     - **Word Application Scope** — `FilePath = in_File`
       - inside: **Read Text** → output to `out_Text`
   - **Case `"png"` or `"jpg"` or `"jpeg"`**
     - Set `out_MimeKind = "image"`, leave `out_Text = ""` (the API will only store the screenshot as attachment; structure comes from the editor or a future GPT OCR call)
   - **Default**
     - **Log Message** Warn `"Unsupported file kind: " + out_MimeKind`
     - Set `out_Text = ""`, `out_MimeKind = "unknown"`

## Notes

* For real Google Drive ingestion, replace step 1 with **Google Drive → Download File**
  (UiPath Integration Service) before this workflow is called, then pass the local
  path as `in_File`.
* Bodies larger than 5 MB should be truncated to keep `POST /api/articles` happy:
  `out_Text = out_Text.Substring(0, Math.Min(out_Text.Length, 50000))`.
