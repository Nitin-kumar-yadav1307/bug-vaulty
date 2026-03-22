# BugVaulty

BugVaulty automatically catches errors from Node.js, Express, and React apps, gets AI-generated fixes, and saves everything to Notion.

## Install

```bash
npm install bugvaulty
```

## Init API

Pass keys directly to `init()` or via environment variables for production safety.

Environment variable support:
- `BUGVAULTY_NOTION_TOKEN`
- `BUGVAULTY_NOTION_PAGE_ID`
- `BUGVAULTY_AI_PROVIDER`
- `BUGVAULTY_AI_API_KEY`
- `BUGVAULTY_CAPTURE_CONSOLE_ERRORS=true` (optional)

### Option 1: Groq

```js
const bugvaulty = require('bugvaulty');

bugvaulty.init({
  notionToken: 'ntn_xxx',
  notionPageId: 'xxx',
  ai: {
    provider: 'groq',
    apiKey: 'gsk_xxx'
  }
});
```

### Option 2: OpenAI

```js
bugvaulty.init({
  notionToken: 'ntn_xxx',
  notionPageId: 'xxx',
  ai: {
    provider: 'openai',
    apiKey: 'sk-xxx'
  }
});
```

### Option 3: Claude

```js
bugvaulty.init({
  notionToken: 'ntn_xxx',
  notionPageId: 'xxx',
  ai: {
    provider: 'claude',
    apiKey: 'sk-ant-xxx'
  }
});
```

### Option 4: No AI (Notion only)

```js
bugvaulty.init({
  notionToken: 'ntn_xxx',
  notionPageId: 'xxx'
});
```

## Validation behavior in `init()`

- Missing `notionToken` -> throws `Error("BugVaulty: notionToken is required")`
- Missing `notionPageId` -> throws `Error("BugVaulty: notionPageId is required")`
- `ai.provider` set but missing `ai.apiKey` -> warns:
  - `[BugVaulty] Warning: AI provider set but no apiKey provided. Errors will be saved without AI analysis.`
- Unknown provider -> warns:
  - `[BugVaulty] Warning: Unknown AI provider. Supported: groq, openai, claude`

On successful init:

```txt
[BugVaulty] Initialized successfully. Tracking errors to Notion.
```

## Express integration

```js
const express = require('express');
const bugvaulty = require('bugvaulty');

const app = express();

bugvaulty.init({
  notionToken: 'ntn_xxx',
  notionPageId: 'xxx',
  ai: {
    provider: 'groq',
    apiKey: 'gsk_xxx'
  }
});

// add after your routes
app.use(bugvaulty.expressMiddleware());
```

BugVaulty automatically catches:
- `process.on('uncaughtException')`
- `process.on('unhandledRejection')`
- Express route errors via `expressMiddleware()`

## React integration

```jsx
import React from 'react';
import { BugVaultyProvider } from 'bugvaulty/react';
import App from './App';

export default function Root() {
  return (
    <BugVaultyProvider
      keys={{
        notionToken: 'ntn_xxx',
        notionPageId: 'xxx',
        ai: {
          provider: 'groq',
          apiKey: 'gsk_xxx'
        }
      }}
    >
      <App />
    </BugVaultyProvider>
  );
}
```

If a component crashes, fallback UI shows:

```txt
Something went wrong. BugVaulty has logged this error.
```

## What BugVaulty stores in Notion

For each error, BugVaulty will:
1. Detect project name from your `package.json` `name` or current folder name.
2. Find or create a project page under your root Notion page.
3. Create a child page with this structure:

```md
🐛 ErrorType: ErrorMessage

## 📋 Error Details
- 📅 Date
- ⏰ Time
- 📁 Path
- 📍 Line

## ❌ What Went Wrong
[AI explanation]

## 💡 Solution
[AI step-by-step solution]

## 🔧 Code Fix
[code block]

## 🚀 How To Avoid This
[AI prevention tips]

## ⭐ Difficulty: Beginner
## 🏷️ Tags: #React #TypeError

## 📄 Stack Trace
[raw stack trace code block]
```

## AI providers and APIs

- Groq
  - URL: `https://api.groq.com/openai/v1/chat/completions`
  - Model: `llama-3.3-70b-versatile`
- OpenAI
  - URL: `https://api.openai.com/v1/chat/completions`
  - Model: `gpt-4o`
- Claude (Anthropic)
  - URL: `https://api.anthropic.com/v1/messages`
  - Model: `claude-sonnet-4-20250514`

All providers normalize to this JSON shape:

```json
{
  "whatWentWrong": "simple explanation",
  "solution": "step by step solution",
  "codeFix": "corrected code",
  "howToAvoid": "prevention tips",
  "difficulty": "Beginner",
  "tags": ["React", "TypeError"]
}
```

## Reliability and safety behavior

- BugVaulty never throws its own errors back to your app.
- If AI fails, BugVaulty still logs to Notion with fallback analysis.
- If Notion fails, BugVaulty logs an error and never crashes your app.
- Every error is grouped automatically by project name in Notion.
- Optional extended detection:
  - `process.on('warning')`
  - `process.on('multipleResolves')`
  - `console.error` interception (enable via `capture.consoleErrors`)

Console messages:

```txt
[BugVaulty] Error tracked successfully → ProjectName/ErrorType
[BugVaulty] AI analysis failed, saving without solution.
[BugVaulty] Failed to save to Notion: {error message}
```

## API

### `init(options)`

```ts
init({
  notionToken?: string,
  notionPageId?: string,
  ai?: {
    provider: 'groq' | 'openai' | 'claude',
    apiKey: string
  },
  capture?: {
    processWarnings?: boolean,
    multipleResolves?: boolean,
    consoleErrors?: boolean
  }
})
```

If `notionToken` and `notionPageId` are omitted, BugVaulty reads:
- `BUGVAULTY_NOTION_TOKEN`
- `BUGVAULTY_NOTION_PAGE_ID`

### `expressMiddleware()`
Returns standard Express error middleware `(err, req, res, next)`.

### `trackReactError(error, context?)`
Used internally by `BugVaultyProvider`, but exported for advanced cases.

## Notes

- Keys are stored only in memory from `init()` config.
- BugVaulty does not require manual error reporting after setup.
- To let BugVaulty create pages under a parent page, your integration must have access to that page in Notion.
- React integration requires `react` in your app.
# bug-vaulty
