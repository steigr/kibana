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
import type { SavedObjectsTypeMappingDefinitions } from '@kbn/core-saved-objects-base-server-internal';

export interface CreateIndexMapOptions {
  /**
   * The resolved default saved object index name. When `kibana.index` is
   * customized this carries the configured suffix (e.g. `.kibana-custom`) so
   * that every derived index (`_task_manager`, `_analytics`, ...) is migrated
   * under the suffixed name.
   */
  kibanaIndexName: string;
  registry: ISavedObjectTypeRegistry;
  indexMap: SavedObjectsTypeMappingDefinitions;
}

export interface IndexMap {
  [index: string]: {
    typeMappings: SavedObjectsTypeMappingDefinitions;
    script?: string;
  };
}

/*
 * This file contains logic to convert savedObjectSchemas into a dictionary of indexes and documents
 */
export function createIndexMap({ kibanaIndexName, registry, indexMap }: CreateIndexMapOptions) {
  const map: IndexMap = {};
  Object.keys(indexMap).forEach((type) => {
    const typeDef = registry.getType(type);
    const script = typeDef?.convertToAliasScript;
    // Defaults to kibanaIndexName if indexPattern isn't defined. When a type
    // declares a canonical `.kibana*` indexPattern, extend it with the
    // configured suffix (a no-op when no suffix is configured).
    const indexPattern = typeDef?.indexPattern
      ? applySavedObjectIndexSuffix(typeDef.indexPattern, kibanaIndexName)
      : kibanaIndexName;
    if (!Object.hasOwn(map, indexPattern as string)) {
      map[indexPattern] = { typeMappings: {} };
    }
    map[indexPattern].typeMappings[type] = indexMap[type];
    if (script && map[indexPattern].script) {
      throw Error(
        `convertToAliasScript has been defined more than once for index pattern "${indexPattern}"`
      );
    } else if (script) {
      map[indexPattern].script = script;
    }
  });
  return map;
}
