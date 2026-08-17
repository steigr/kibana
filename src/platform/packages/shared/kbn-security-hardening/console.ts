/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/* eslint-disable no-console */

// From https://www.ascii-code.com/characters/control-characters,
// but explicitly allowing the range \u0008-\u000F (line breaks, tabs, etc.)
const CONTROL_CHAR_REGEXP = new RegExp('[\\u0000-\\u0007\\u0010-\\u001F]', 'g');

export const unsafeConsole = {
  debug: console.debug.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  trace: console.trace.bind(console),
  warn: console.warn.bind(console),
};

function callWithSanitizedArgs(func: Function, ...args: any[]) {
  const cleanedArgs = args.map(function (arg) {
    if (typeof arg !== 'string') return arg;
    return escapeControlChars(arg);
  });
  func.apply(console, cleanedArgs);
}

/**
 * Whether the native global `console` methods have been overridden (always
 * true in a production environment). Consumed by `@kbn/core-root-server-internal`
 * to log this fact once Core's Logging Service is available, rather than via
 * a raw, unformatted `console.log` at module-load time (before the logging
 * system, and therefore any configured layout/appenders, exist).
 */
export const consoleHardeningApplied = process.env.NODE_ENV === 'production';

if (consoleHardeningApplied) {
  console.debug = function (...args) {
    callWithSanitizedArgs(unsafeConsole.debug, ...args);
  };

  console.error = function (...args) {
    callWithSanitizedArgs(unsafeConsole.error, ...args);
  };

  console.info = function (...args) {
    callWithSanitizedArgs(unsafeConsole.info, ...args);
  };

  console.log = function (...args) {
    callWithSanitizedArgs(unsafeConsole.log, ...args);
  };

  console.trace = function (...args) {
    callWithSanitizedArgs(unsafeConsole.trace, ...args);
  };

  console.warn = function (...args) {
    callWithSanitizedArgs(unsafeConsole.warn, ...args);
  };
}

function escapeControlChars(input: string) {
  return input.replace(
    CONTROL_CHAR_REGEXP,
    // Escaping control chars via JSON.stringify to maintain consistency with `meta` and the JSON layout.
    // This way, post analysis of the logs is easier as we can search the same patterns.
    // Our benchmark didn't show a big difference in performance between custom-escaping vs. JSON.stringify one.
    // The slice is removing the double-quotes.
    (substr) => JSON.stringify(substr).slice(1, -1)
  );
}
