/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Collect and centralize the names of the different saved object indices.
 * Note that all of them start with the '.kibana' prefix.
 * There are multiple places in the code that these indices have the form .kibana*.
 * However, beware that there are some system indices that have the same prefix
 * but are NOT used to store saved objects, e.g.: .kibana_security_session_1
 */
export const MAIN_SAVED_OBJECT_INDEX = '.kibana';
export const TASK_MANAGER_SAVED_OBJECT_INDEX = `${MAIN_SAVED_OBJECT_INDEX}_task_manager`;
export const INGEST_SAVED_OBJECT_INDEX = `${MAIN_SAVED_OBJECT_INDEX}_ingest`;
export const ALERTING_CASES_SAVED_OBJECT_INDEX = `${MAIN_SAVED_OBJECT_INDEX}_alerting_cases`;
export const SECURITY_SOLUTION_SAVED_OBJECT_INDEX = `${MAIN_SAVED_OBJECT_INDEX}_security_solution`;
export const ANALYTICS_SAVED_OBJECT_INDEX = `${MAIN_SAVED_OBJECT_INDEX}_analytics`;
export const USAGE_COUNTERS_SAVED_OBJECT_INDEX = `${MAIN_SAVED_OBJECT_INDEX}_usage_counters`;
export const SEARCH_SOLUTION_SAVED_OBJECT_INDEX = `${MAIN_SAVED_OBJECT_INDEX}_search_solution`;

export const ALL_SAVED_OBJECT_INDICES = [
  MAIN_SAVED_OBJECT_INDEX,
  TASK_MANAGER_SAVED_OBJECT_INDEX,
  ALERTING_CASES_SAVED_OBJECT_INDEX,
  INGEST_SAVED_OBJECT_INDEX,
  SECURITY_SOLUTION_SAVED_OBJECT_INDEX,
  ANALYTICS_SAVED_OBJECT_INDEX,
  USAGE_COUNTERS_SAVED_OBJECT_INDEX,
  SEARCH_SOLUTION_SAVED_OBJECT_INDEX,
];

/**
 * Extends a "canonical" saved object index name (one that uses the default
 * `.kibana` prefix, e.g. `.kibana`, `.kibana_task_manager`, `.kibana_analytics`)
 * with the custom suffix configured through `kibana.index`.
 *
 * The historical `kibana.index` setting (removed in 8.0, index split in 8.8)
 * allowed deployments to rename the saved object index. It's reintroduced here
 * as a suffix appended to the end of every canonical `.kibana*` name, rather
 * than a prefix substitution:
 *
 * ```
 * applySavedObjectIndexSuffix('.kibana', '.kibana-custom')                // '.kibana-custom'
 * applySavedObjectIndexSuffix('.kibana_task_manager', '.kibana-custom')   // '.kibana_task_manager-custom'
 * ```
 *
 * Keeping `.kibana` as a literal, unmodified prefix (instead of replacing it,
 * as a naive port of the legacy setting would) matters operationally:
 * Elasticsearch's built-in `kibana_system` role grants its index privileges by
 * matching the `.kibana*` pattern, so a suffixed name is still covered by that
 * role out of the box, while a fully custom prefix would not be.
 *
 * @param canonicalIndex the default-prefixed index name to extend, e.g. one of
 * the constants in this file.
 * @param resolvedDefaultIndex the already-resolved main saved object index,
 * i.e. {@link MAIN_SAVED_OBJECT_INDEX} with the configured suffix applied (as
 * returned by `SavedObjectsServiceStart#getDefaultIndex()`). Must be exactly
 * `.kibana` (no suffix configured) or start with `.kibana-`; any other shape
 * is treated as malformed and ignored (the canonical index is returned
 * untouched) rather than silently producing an unseparated, ambiguous name.
 */
export const applySavedObjectIndexSuffix = (
  canonicalIndex: string,
  resolvedDefaultIndex?: string
): string => {
  if (!resolvedDefaultIndex || resolvedDefaultIndex === MAIN_SAVED_OBJECT_INDEX) {
    return canonicalIndex;
  }
  const isKibanaFamily =
    canonicalIndex === MAIN_SAVED_OBJECT_INDEX ||
    canonicalIndex.startsWith(`${MAIN_SAVED_OBJECT_INDEX}_`);
  const isValidResolvedIndex = resolvedDefaultIndex.startsWith(`${MAIN_SAVED_OBJECT_INDEX}-`);
  if (!isKibanaFamily || !isValidResolvedIndex) {
    return canonicalIndex;
  }
  const suffix = resolvedDefaultIndex.slice(MAIN_SAVED_OBJECT_INDEX.length);
  return `${canonicalIndex}${suffix}`;
};

/**
 * A valid, non-empty `kibana.index` suffix, e.g. `-custom`: a leading dash
 * followed by one or more lowercase letters, digits, underscores or dashes.
 */
const KIBANA_INDEX_SUFFIX_PATTERN = /^-[a-z0-9][a-z0-9_-]*$/;

/**
 * Normalizes a raw `kibana.index` config value into the suffix that should be
 * appended to {@link MAIN_SAVED_OBJECT_INDEX}, accepting a few equivalent
 * spellings so operators don't have to remember the exact required shape:
 *
 * - unset / empty string -> `''` (no suffix, `.kibana` is used as-is)
 * - `-custom`             -> `-custom` (already a suffix)
 * - `.kibana-custom`      -> `-custom` (a complete index name; the redundant
 *                            `.kibana` literal is stripped)
 * - `kibana-custom`       -> `-custom` (same as above, without the leading dot)
 * - `custom`              -> `-custom` (a bare word; the separator is implied)
 *
 * Returns `null` if the value doesn't resolve to a valid, unambiguous suffix
 * (e.g. `-`, `kibana-`, `.kibana-` alone, with nothing following the dash).
 */
export const normalizeKibanaIndexSuffix = (rawValue: string): string | null => {
  if (!rawValue) {
    return '';
  }
  let suffix: string;
  if (rawValue.startsWith(`${MAIN_SAVED_OBJECT_INDEX}-`)) {
    suffix = rawValue.slice(MAIN_SAVED_OBJECT_INDEX.length);
  } else if (rawValue.startsWith('kibana-')) {
    suffix = rawValue.slice('kibana'.length);
  } else if (rawValue.startsWith('-')) {
    suffix = rawValue;
  } else {
    suffix = `-${rawValue}`;
  }
  return KIBANA_INDEX_SUFFIX_PATTERN.test(suffix) ? suffix : null;
};
