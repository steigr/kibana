/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { LicensingPluginStart } from '@kbn/licensing-plugin/server';

/**
 * Resolves the effective `telemetry.optIn` config value.
 *
 * When left unset in `kibana.yml`, the default is derived from the license: disabled on a
 * free/basic (or unavailable) license, enabled otherwise (matching the historical default).
 */
export async function resolveConfigTelemetryOptIn(
  configOptIn: boolean | undefined,
  getLicensing: () => LicensingPluginStart | undefined
): Promise<boolean | null> {
  if (typeof configOptIn === 'boolean') {
    return configOptIn;
  }

  const licensing = getLicensing();
  if (!licensing) {
    return true;
  }

  try {
    const license = await licensing.getLicense();
    const isFreeEdition = !license.isAvailable || license.type === 'basic';
    return !isFreeEdition;
  } catch {
    return null;
  }
}
