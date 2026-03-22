const { registerProcessErrorHandlers, createExpressMiddleware } = require('./errorCatcher');
const { analyzeError } = require('./aiService');
const { NotionService } = require('./notionService');
const { normalizeError, getProjectName } = require('./utils');

const SUPPORTED_PROVIDERS = ['groq', 'openai', 'claude'];

const state = {
  initialized: false,
  config: null,
  projectName: null,
  notionService: null,
  trackedFingerprint: new Map(),
  queue: Promise.resolve(),
};

function resolveConfig(options) {
  const input = options && typeof options === 'object' ? options : {};
  const env = process.env || {};

  const providerRaw =
    (input.ai && input.ai.provider) || env.BUGVAULTY_AI_PROVIDER || null;

  return {
    notionToken: input.notionToken || env.BUGVAULTY_NOTION_TOKEN || null,
    notionPageId: input.notionPageId || env.BUGVAULTY_NOTION_PAGE_ID || null,
    ai: {
      provider: providerRaw ? String(providerRaw).toLowerCase() : null,
      apiKey:
        (input.ai && input.ai.apiKey) || env.BUGVAULTY_AI_API_KEY || null,
    },
    capture: {
      processWarnings:
        input.capture && typeof input.capture.processWarnings === 'boolean'
          ? input.capture.processWarnings
          : true,
      multipleResolves:
        input.capture && typeof input.capture.multipleResolves === 'boolean'
          ? input.capture.multipleResolves
          : true,
      consoleErrors:
        input.capture && typeof input.capture.consoleErrors === 'boolean'
          ? input.capture.consoleErrors
          : env.BUGVAULTY_CAPTURE_CONSOLE_ERRORS === 'true',
    },
  };
}

function validateOptions(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('BugVaulty: notionToken is required');
  }

  if (!config.notionToken) {
    throw new Error('BugVaulty: notionToken is required');
  }

  if (!config.notionPageId) {
    throw new Error('BugVaulty: notionPageId is required');
  }

  const provider = config.ai && config.ai.provider ? String(config.ai.provider).toLowerCase() : null;
  const apiKey = config.ai && config.ai.apiKey ? String(config.ai.apiKey) : '';

  if (provider && !apiKey) {
    console.warn(
      '[BugVaulty] Warning: AI provider set but no apiKey provided. Errors will be saved without AI analysis.'
    );
  }

  if (provider && SUPPORTED_PROVIDERS.indexOf(provider) === -1) {
    console.warn('[BugVaulty] Warning: Unknown AI provider. Supported: groq, openai, claude');
  }
}

function init(options) {
  const resolvedConfig = resolveConfig(options);
  validateOptions(resolvedConfig);
  state.config = resolvedConfig;

  state.projectName = getProjectName();
  state.notionService = new NotionService(state.config.notionToken, state.config.notionPageId);

  registerProcessErrorHandlers(trackError, state.config.capture);
  state.initialized = true;

  console.log('[BugVaulty] Initialized successfully. Tracking errors to Notion.');

  return {
    expressMiddleware,
    trackReactError,
  };
}

function expressMiddleware() {
  return createExpressMiddleware(trackError);
}

function getFingerprint(normalized) {
  return [normalized.errorType, normalized.message, normalized.filePath, normalized.lineNumber].join('|');
}

function isDuplicate(normalized) {
  const fingerprint = getFingerprint(normalized);
  const now = Date.now();
  const lastSeen = state.trackedFingerprint.get(fingerprint);

  if (lastSeen && now - lastSeen < 1500) {
    return true;
  }

  state.trackedFingerprint.set(fingerprint, now);

  if (state.trackedFingerprint.size > 200) {
    const firstKey = state.trackedFingerprint.keys().next().value;
    state.trackedFingerprint.delete(firstKey);
  }

  return false;
}

async function trackError(errorLike, context) {
  state.queue = state.queue
    .then(() => processTrackError(errorLike, context))
    .catch(() => {
      // Never allow tracking queue failures to bubble.
    });

  return state.queue;
}

function getFallbackAnalysis() {
  return {
    whatWentWrong: 'No AI provider configured',
    solution: 'Add an AI provider in bugvaulty.init() to get solutions',
    codeFix: '',
    howToAvoid: '',
    difficulty: 'Unknown',
    tags: [],
  };
}

async function processTrackError(errorLike, context) {
  if (!state.initialized || !state.notionService) {
    return;
  }

  const enrichedContext = {
    ...(context || {}),
    runtime: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    },
  };

  const normalized = normalizeError(errorLike, enrichedContext);
  if (isDuplicate(normalized)) {
    return;
  }

  let analysis;
  try {
    analysis = await analyzeError(
      {
        projectName: state.projectName,
        errorType: normalized.errorType,
        message: normalized.message,
        stack: normalized.stack,
        filePath: normalized.filePath,
        lineNumber: normalized.lineNumber,
        context: normalized.context,
      },
      state.config.ai
    );
  } catch (_err) {
    analysis = getFallbackAnalysis();
  }

  const payload = {
    ...normalized,
    analysis,
  };

  try {
    const projectPageId = await state.notionService.getOrCreateProjectPage(state.projectName);
    const errorPageId = await state.notionService.createErrorPage(projectPageId, payload);

    if (errorPageId) {
      console.log(
        `[BugVaulty] Error tracked successfully → ${state.projectName}/${normalized.errorType}`
      );
    } else {
      console.warn('[BugVaulty] Failed to save to Notion: Unknown Notion error');
    }
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown Notion error';
    console.warn(`[BugVaulty] Failed to save to Notion: ${message}`);
  }
}

function trackReactError(errorLike, context) {
  return trackError(errorLike, {
    source: 'react',
    ...(context || {}),
  });
}

module.exports = {
  init,
  expressMiddleware,
  trackReactError,
};
