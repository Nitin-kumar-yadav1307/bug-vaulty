const express = require('express');
const bugvaulty = require('bugvaulty');

const config = {
  notionToken: process.env.BUGVAULTY_NOTION_TOKEN,
  notionPageId: process.env.BUGVAULTY_NOTION_PAGE_ID,
  ai: {
    provider: process.env.BUGVAULTY_AI_PROVIDER || 'groq',
    apiKey: process.env.BUGVAULTY_AI_API_KEY,
  },
  capture: {
    processWarnings: true,
    multipleResolves: true,
    consoleErrors: true,
  },
};

try {
  bugvaulty.init(config);
} catch (err) {
  console.error('[SmokeTest] Failed to initialize BugVaulty:', err.message);
  process.exit(1);
}

const app = express();

app.get('/sync-crash', (_req, _res) => {
  throw new Error('Sync crash test from /sync-crash');
});

app.get('/async-crash', async (_req, _res, next) => {
  try {
    await Promise.reject(new Error('Unhandled rejection test from /async-crash'));
  } catch (err) {
    next(err);
  }
});

app.get('/ok', (_req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

app.use(bugvaulty.expressMiddleware());

app.use((err, _req, res, _next) => {
  res.status(500).json({
    ok: false,
    message: err && err.message ? err.message : 'Internal Server Error',
  });
});

app.listen(3010, () => {
  console.log('[SmokeTest] Running on http://localhost:3010');
  console.log('[SmokeTest] Open /sync-crash or /async-crash to trigger logging.');

  setTimeout(() => {
    Promise.reject(new Error('Global unhandledRejection smoke test'));
  }, 2000);
});
