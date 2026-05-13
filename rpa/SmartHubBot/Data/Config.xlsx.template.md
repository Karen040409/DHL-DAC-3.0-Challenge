# Config.xlsx (template)

Studio expects a sheet named **`settings`** with two columns: `Key`, `Value`.

| Key | Value |
|-----|-------|
| `InputFolder` | `C:\SmartHub\Inbox` |
| `ApiBaseUrl` | `http://localhost:3001` |
| `AdminEmail` | `admin@dhl.example` |
| `SmtpHost` | `smtp.gmail.com` |
| `SmtpPort` | `587` |
| `SmtpUser` | `bot@dhl.example` |
| `CreatorUserId` | `1` |
| `DefaultStatusAfterCreate` | `Draft` |
| `AdvanceToReviewed` | `False` |

The bot reads this once at startup into `in_Config (Dictionary<String,String>)`.
SMTP password should be a Studio asset, not a cell value.
