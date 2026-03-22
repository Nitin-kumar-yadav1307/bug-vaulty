const fs = require('fs');
const path = require('path');

function getProjectName() {
  const packagePath = path.join(process.cwd(), 'package.json');

  try {
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (pkg && typeof pkg.name === 'string' && pkg.name.trim()) {
        return pkg.name.trim();
      }
    }
  } catch (_err) {
    // Silent by design: BugVaulty should never break host apps.
  }

  return path.basename(process.cwd());
}

function parseStackTrace(stack) {
  if (!stack || typeof stack !== 'string') {
    return { filePath: 'Unknown', lineNumber: null };
  }

  const lines = stack.split('\n').map((line) => line.trim());

  for (const line of lines) {
    const withParens = line.match(/\((.+):(\d+):(\d+)\)/);
    if (withParens) {
      return {
        filePath: withParens[1],
        lineNumber: Number(withParens[2]),
      };
    }

    const withoutParens = line.match(/at (.+):(\d+):(\d+)/);
    if (withoutParens) {
      return {
        filePath: withoutParens[1],
        lineNumber: Number(withoutParens[2]),
      };
    }
  }

  return { filePath: 'Unknown', lineNumber: null };
}

function getCurrentDateTime(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date();

  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toLocaleTimeString('en-US', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return { date: dateStr, time: timeStr };
}

function toError(reason) {
  if (reason instanceof Error) {
    return reason;
  }

  if (typeof reason === 'string') {
    return new Error(reason);
  }

  try {
    return new Error(JSON.stringify(reason));
  } catch (_err) {
    return new Error('Unknown error reason');
  }
}

function normalizeError(inputError, context) {
  const error = toError(inputError);
  const stackInfo = parseStackTrace(error.stack || '');
  const now = new Date();
  const dateParts = getCurrentDateTime(now);

  return {
    errorType: error.name || 'Error',
    message: error.message || 'No error message',
    stack: error.stack || '',
    filePath: stackInfo.filePath,
    lineNumber: stackInfo.lineNumber,
    date: dateParts.date,
    time: dateParts.time,
    timestamp: now.toISOString(),
    context: context || {},
  };
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 8);
}

module.exports = {
  getProjectName,
  parseStackTrace,
  getCurrentDateTime,
  normalizeError,
  safeJsonParse,
  normalizeTags,
};
