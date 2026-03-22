const registered = {
  processHandlers: false,
  warningHandler: false,
  multipleResolvesHandler: false,
  consoleErrorPatched: false,
};

let originalConsoleError = null;

function registerProcessErrorHandlers(onError, captureOptions) {
  const options = captureOptions || {};

  if (registered.processHandlers) {
    patchConsoleError(onError, options);
    return;
  }

  process.on('uncaughtException', (error) => {
    safeHandle(onError, error, { source: 'uncaughtException' });
  });

  process.on('unhandledRejection', (reason) => {
    safeHandle(onError, reason, { source: 'unhandledRejection' });
  });

  if (options.processWarnings && !registered.warningHandler) {
    process.on('warning', (warning) => {
      safeHandle(onError, warning, { source: 'process.warning' });
    });
    registered.warningHandler = true;
  }

  if (options.multipleResolves && !registered.multipleResolvesHandler) {
    process.on('multipleResolves', (type, _promise, reason) => {
      safeHandle(onError, reason || new Error(`multipleResolves: ${type}`), {
        source: 'process.multipleResolves',
        resolveType: type,
      });
    });
    registered.multipleResolvesHandler = true;
  }

  patchConsoleError(onError, options);
  registered.processHandlers = true;
}

function patchConsoleError(onError, options) {
  if (!options.consoleErrors || registered.consoleErrorPatched) {
    return;
  }

  originalConsoleError = console.error;
  console.error = function patchedConsoleError(...args) {
    originalConsoleError.apply(console, args);

    const firstError = args.find((arg) => arg instanceof Error);
    const firstString = args.find((arg) => typeof arg === 'string');

    const tracked = firstError || firstString || 'console.error called';
    safeHandle(onError, tracked, {
      source: 'console.error',
      preview: firstString ? String(firstString).slice(0, 500) : '',
    });
  };

  registered.consoleErrorPatched = true;
}

function createExpressMiddleware(onError) {
  return function bugvaultyExpressMiddleware(err, req, _res, next) {
    if (err) {
      safeHandle(onError, err, {
        source: 'express',
        method: req && req.method,
        route: req && (req.originalUrl || req.url),
      });
    }

    if (typeof next === 'function') {
      next(err);
    }
  };
}

function safeHandle(onError, errorLike, context) {
  try {
    Promise.resolve(onError(errorLike, context)).catch(() => {
      // Silent by design.
    });
  } catch (_err) {
    // Silent by design.
  }
}

module.exports = {
  registerProcessErrorHandlers,
  createExpressMiddleware,
};
