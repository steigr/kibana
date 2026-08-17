/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// `consoleHardeningApplied` is normally derived from `process.env.NODE_ENV`
// at module-load time, frozen for the lifetime of the process. Since this
// suite runs with `NODE_ENV=test`, force it to simulate a production boot,
// while keeping the real `unsafeConsole` behavior from the same module.
jest.mock('@kbn/security-hardening', () => ({
  ...jest.requireActual('@kbn/security-hardening'),
  consoleHardeningApplied: true,
}));

import { createRoot as createkbnTestServerRoot } from '@kbn/core-test-helpers-kbn-server';
import { unsafeConsole } from '@kbn/security-hardening';

const NOTICE_MESSAGE =
  'Native global console methods have been overridden in production environment.';

function createRoot() {
  return createkbnTestServerRoot({
    logging: {
      appenders: {
        default: {
          type: 'console',
          layout: { type: 'json' },
        },
      },
      root: {
        level: 'info',
      },
      // `createRoot`'s own test defaults route the "root" context to a
      // pattern-layout appender at "error" level; override it explicitly so
      // this test actually exercises the "info"-level, JSON-layout scenario
      // from `logging.root`/`logging.appenders.default` above.
      loggers: [
        {
          name: 'root',
          level: 'info',
          appenders: ['default'],
        },
      ],
    },
    server: { restrictInternalApis: false },
  });
}

describe('console hardening notice', () => {
  let root: ReturnType<typeof createRoot>;
  let mockConsoleLog: jest.SpyInstance;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(unsafeConsole, 'log');
  });

  afterEach(async () => {
    mockConsoleLog.mockRestore();
    if (root) {
      await root.shutdown();
    }
  });

  it('is emitted as a structured JSON log through the "root" logger, not a raw console line', async () => {
    root = createRoot();

    await root.preboot();

    const jsonLogLines = mockConsoleLog.mock.calls
      .map(([line]) => line as string)
      .filter((line) => {
        try {
          return JSON.parse(line).message === NOTICE_MESSAGE;
        } catch {
          return false;
        }
      });

    expect(jsonLogLines).toHaveLength(1);

    const parsed = JSON.parse(jsonLogLines[0]);
    expect(parsed).toMatchObject({
      message: NOTICE_MESSAGE,
      log: { level: 'INFO', logger: 'root' },
    });
  });
});
