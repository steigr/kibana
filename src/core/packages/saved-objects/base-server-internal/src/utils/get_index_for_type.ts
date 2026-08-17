/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  type ISavedObjectTypeRegistry,
  applySavedObjectIndexSuffix,
} from '@kbn/core-saved-objects-server';

interface GetIndexForTypeOptions {
  type: string;
  typeRegistry: ISavedObjectTypeRegistry;
  kibanaVersion: string;
  /**
   * The resolved default saved object index name, i.e. `.kibana` with any
   * `kibana.index` suffix applied (e.g. `.kibana-custom`). It is both the
   * fallback index for types that don't declare an `indexPattern` and the
   * source of the suffix applied to the canonical index of types that do.
   */
  defaultIndex: string;
}

export const getIndexForType = ({
  type,
  typeRegistry,
  defaultIndex,
  kibanaVersion,
}: GetIndexForTypeOptions): string => {
  const registeredIndex = typeRegistry.getIndex(type);
  const baseIndex = registeredIndex
    ? applySavedObjectIndexSuffix(registeredIndex, defaultIndex)
    : defaultIndex;
  return `${baseIndex}_${kibanaVersion}`;
};
