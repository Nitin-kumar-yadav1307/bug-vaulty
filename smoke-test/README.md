# BugVaulty Smoke Test

## 1) Configure environment variables

Copy `.env.example` and set your real values in your terminal session.

Windows PowerShell example:

```powershell
$env:BUGVAULTY_NOTION_TOKEN="ntn_xxx"
$env:BUGVAULTY_NOTION_PAGE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:BUGVAULTY_AI_PROVIDER="groq"
$env:BUGVAULTY_AI_API_KEY="gsk_xxx"
$env:BUGVAULTY_CAPTURE_CONSOLE_ERRORS="true"
```

Git Bash example:

```bash
export BUGVAULTY_NOTION_TOKEN="ntn_xxx"
export BUGVAULTY_NOTION_PAGE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export BUGVAULTY_AI_PROVIDER="groq"
export BUGVAULTY_AI_API_KEY="gsk_xxx"
export BUGVAULTY_CAPTURE_CONSOLE_ERRORS="true"
```

## 2) Install dependencies

From this folder:

npm install

## 3) Run test server

npm start

Server runs at:

http://localhost:3010

## 4) Trigger test errors

- http://localhost:3010/ok
- http://localhost:3010/sync-crash
- http://localhost:3010/async-crash

## 5) Expected results

Console should print:

[BugVaulty] Initialized successfully. Tracking errors to Notion.
[BugVaulty] Error tracked successfully → ProjectName/ErrorType

Notion should contain:
- project page auto-created from this app name
- child pages for each triggered error with AI analysis sections

## Notes

- If AI fails, BugVaulty still saves with fallback and prints:
  [BugVaulty] AI analysis failed, saving without solution.
- If Notion fails, BugVaulty prints:
  [BugVaulty] Failed to save to Notion: {error message}
