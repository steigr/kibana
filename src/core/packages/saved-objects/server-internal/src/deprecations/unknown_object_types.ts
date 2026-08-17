/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { i18n } from '@kbn/i18n';
import type { DeprecationsDetails } from '@kbn/core-deprecations-common';
import type { IScopedClusterClient } from '@kbn/core-elasticsearch-server';
import {
  ALL_SAVED_OBJECT_INDICES,
  applySavedObjectIndexSuffix,
  type ISavedObjectTypeRegistry,
} from '@kbn/core-saved-objects-server';
import {
  getAggregatedTypesDocuments,
  addExcludedTypesToBoolQuery,
} from '@kbn/core-saved-objects-migration-server-internal';

interface UnknownTypesDeprecationOptions {
  typeRegistry: ISavedObjectTypeRegistry;
  esClient: IScopedClusterClient;
  kibanaVersion: string;
  /** The resolved default saved object index (`kibana.index` suffix applied, defaults to `.kibana`). */
  defaultIndex: string;
}

const getKnownTypes = (typeRegistry: ISavedObjectTypeRegistry) =>
  typeRegistry.getAllTypes().map((type) => type.name);

/**
 * Returns the versioned aliases for ALL known Kibana SO indices.
 *
 * Using the canonical {@link ALL_SAVED_OBJECT_INDICES} list instead of deriving indices from
 * registered types ensures that documents from disabled plugins (whose types are therefore not
 * registered) are also checked. For example, if `cloudSecurityPosture` is disabled because
 * `fleet` is disabled, its saved object types are not registered, but its documents still exist
 * in `.kibana_security_solution`. Without this explicit list, that index would be skipped
 * entirely if no other registered type happened to use it.
 *
 * Note: some of these version-aliased indices may not exist (e.g. if a plugin was never
 * loaded), so callers should use `ignore_unavailable: true` in their ES requests.
 */
const getTargetIndices = ({
  kibanaVersion,
  defaultIndex,
}: {
  kibanaVersion: string;
  defaultIndex: string;
}) => {
  return ALL_SAVED_OBJECT_INDICES.map(
    (index) => `${applySavedObjectIndexSuffix(index, defaultIndex)}_${kibanaVersion}`
  );
};

const getUnknownSavedObjects = async ({
  typeRegistry,
  esClient,
  kibanaVersion,
  defaultIndex,
}: UnknownTypesDeprecationOptions) => {
  const knownTypes = getKnownTypes(typeRegistry);
  const targetIndices = getTargetIndices({ kibanaVersion, defaultIndex });
  const excludeRegisteredTypes = addExcludedTypesToBoolQuery(knownTypes);
  return await getAggregatedTypesDocuments(
    esClient.asInternalUser,
    targetIndices,
    excludeRegisteredTypes,
    { ignoreUnavailable: true }
  );
};

export const getUnknownTypesDeprecations = async (
  options: UnknownTypesDeprecationOptions
): Promise<DeprecationsDetails[]> => {
  const deprecations: DeprecationsDetails[] = [];
  const unknownDocs = await getUnknownSavedObjects(options);
  if (unknownDocs.length) {
    deprecations.push({
      title: i18n.translate('core.savedObjects.deprecations.unknownTypes.title', {
        defaultMessage: 'Saved objects with unknown types are present in Kibana system indices',
      }),
      message: i18n.translate('core.savedObjects.deprecations.unknownTypes.message', {
        defaultMessage:
          '{objectCount, plural, one {# object} other {# objects}} with unknown types {objectCount, plural, one {was} other {were}} found in Kibana system indices. ' +
          'Upgrading with unknown savedObject types is no longer supported. ' +
          `To ensure that upgrades will succeed in the future, either re-enable plugins or delete these documents from the Kibana indices`,
        values: {
          objectCount: unknownDocs.length,
        },
      }),
      level: 'critical',
      requireRestart: false,
      deprecationType: undefined, // not config nor feature...
      correctiveActions: {
        manualSteps: [
          i18n.translate('core.savedObjects.deprecations.unknownTypes.manualSteps.1', {
            defaultMessage: 'Enable disabled plugins then restart Kibana.',
          }),
          i18n.translate('core.savedObjects.deprecations.unknownTypes.manualSteps.2', {
            defaultMessage:
              'If no plugins are disabled, or if enabling them does not fix the issue, delete the documents.',
          }),
        ],
        api: {
          path: '/internal/saved_objects/deprecations/_delete_unknown_types',
          method: 'POST',
          body: {},
        },
      },
    });
  }
  return deprecations;
};

interface DeleteUnknownTypesOptions {
  typeRegistry: ISavedObjectTypeRegistry;
  esClient: IScopedClusterClient;
  kibanaVersion: string;
  /** The resolved default saved object index (`kibana.index` suffix applied, defaults to `.kibana`). */
  defaultIndex: string;
}

export const deleteUnknownTypeObjects = async ({
  esClient,
  typeRegistry,
  kibanaVersion,
  defaultIndex,
}: DeleteUnknownTypesOptions) => {
  const knownTypes = getKnownTypes(typeRegistry);
  const targetIndices = getTargetIndices({ kibanaVersion, defaultIndex });
  const nonRegisteredTypesQuery = addExcludedTypesToBoolQuery(knownTypes);

  await esClient.asInternalUser.deleteByQuery({
    index: targetIndices,
    wait_for_completion: false,
    query: nonRegisteredTypesQuery,
    ignore_unavailable: true,
  });
};
