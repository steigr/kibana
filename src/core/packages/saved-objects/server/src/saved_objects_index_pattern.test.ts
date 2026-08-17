/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  ALL_SAVED_OBJECT_INDICES,
  MAIN_SAVED_OBJECT_INDEX,
  TASK_MANAGER_SAVED_OBJECT_INDEX,
  applySavedObjectIndexSuffix,
  normalizeKibanaIndexSuffix,
} from './saved_objects_index_pattern';

describe('applySavedObjectIndexSuffix', () => {
  it('is a no-op when no resolved default index is provided', () => {
    expect(applySavedObjectIndexSuffix(TASK_MANAGER_SAVED_OBJECT_INDEX)).toEqual(
      TASK_MANAGER_SAVED_OBJECT_INDEX
    );
    expect(applySavedObjectIndexSuffix(TASK_MANAGER_SAVED_OBJECT_INDEX, '')).toEqual(
      TASK_MANAGER_SAVED_OBJECT_INDEX
    );
  });

  it('is a no-op when the resolved default index equals the plain `.kibana` default', () => {
    for (const index of ALL_SAVED_OBJECT_INDICES) {
      expect(applySavedObjectIndexSuffix(index, MAIN_SAVED_OBJECT_INDEX)).toEqual(index);
    }
  });

  it('extends the main index with the configured suffix', () => {
    expect(applySavedObjectIndexSuffix(MAIN_SAVED_OBJECT_INDEX, '.kibana-custom')).toEqual(
      '.kibana-custom'
    );
  });

  it('extends derived indices with the same suffix, preserving the `.kibana` prefix', () => {
    expect(applySavedObjectIndexSuffix('.kibana_task_manager', '.kibana-custom')).toEqual(
      '.kibana_task_manager-custom'
    );
    expect(applySavedObjectIndexSuffix('.kibana_analytics', '.kibana-custom')).toEqual(
      '.kibana_analytics-custom'
    );
  });

  it('extends every known saved object index', () => {
    const suffixed = ALL_SAVED_OBJECT_INDICES.map((index) =>
      applySavedObjectIndexSuffix(index, '.kibana-custom')
    );
    expect(suffixed).toEqual([
      '.kibana-custom',
      '.kibana_task_manager-custom',
      '.kibana_alerting_cases-custom',
      '.kibana_ingest-custom',
      '.kibana_security_solution-custom',
      '.kibana_analytics-custom',
      '.kibana_usage_counters-custom',
      '.kibana_search_solution-custom',
    ]);
  });

  it('leaves unrelated index names untouched', () => {
    // A system index that shares the `.kibana` prefix but is not a saved object index
    // (only exact `.kibana` or `.kibana_*` names are extended).
    expect(applySavedObjectIndexSuffix('.kibana-event-log', '.kibana-custom')).toEqual(
      '.kibana-event-log'
    );
    // A plugin-registered index pattern unrelated to the `.kibana` family (e.g. Beats).
    expect(applySavedObjectIndexSuffix('custom-plugin-index', '.kibana-custom')).toEqual(
      'custom-plugin-index'
    );
  });

  it('is a no-op if the resolved default index is malformed (not `.kibana` and not `.kibana-*`)', () => {
    // Missing the required "-" separator after ".kibana" — ambiguous, must be rejected.
    expect(applySavedObjectIndexSuffix(TASK_MANAGER_SAVED_OBJECT_INDEX, '.kibanacustom')).toEqual(
      TASK_MANAGER_SAVED_OBJECT_INDEX
    );
    // Does not start with ".kibana" at all.
    expect(applySavedObjectIndexSuffix(TASK_MANAGER_SAVED_OBJECT_INDEX, '.not-kibana')).toEqual(
      TASK_MANAGER_SAVED_OBJECT_INDEX
    );
  });
});

describe('normalizeKibanaIndexSuffix', () => {
  it('returns an empty suffix when unset', () => {
    expect(normalizeKibanaIndexSuffix('')).toEqual('');
  });

  it('accepts an explicit suffix (leading dash)', () => {
    expect(normalizeKibanaIndexSuffix('-custom')).toEqual('-custom');
    expect(normalizeKibanaIndexSuffix('-a')).toEqual('-a');
  });

  it('accepts a complete index name (".kibana-" prefix) and strips the redundant literal', () => {
    expect(normalizeKibanaIndexSuffix('.kibana-custom')).toEqual('-custom');
    expect(normalizeKibanaIndexSuffix('.kibana-hello')).toEqual('-hello');
  });

  it('accepts a complete index name without the leading dot ("kibana-" prefix)', () => {
    expect(normalizeKibanaIndexSuffix('kibana-custom')).toEqual('-custom');
    expect(normalizeKibanaIndexSuffix('kibana-world')).toEqual('-world');
  });

  it('accepts a bare word and treats it as an implicit suffix', () => {
    expect(normalizeKibanaIndexSuffix('custom')).toEqual('-custom');
    expect(normalizeKibanaIndexSuffix('bar')).toEqual('-bar');
  });

  it('rejects a suffix with nothing after the dash', () => {
    expect(normalizeKibanaIndexSuffix('-')).toBeNull();
    expect(normalizeKibanaIndexSuffix('.kibana-')).toBeNull();
    expect(normalizeKibanaIndexSuffix('kibana-')).toBeNull();
  });

  it('rejects values with invalid index-name characters', () => {
    expect(normalizeKibanaIndexSuffix('Custom')).toBeNull();
    expect(normalizeKibanaIndexSuffix('.kibana-Custom')).toBeNull();
    expect(normalizeKibanaIndexSuffix('kibana-cus tom')).toBeNull();
    expect(normalizeKibanaIndexSuffix('cus*tom')).toBeNull();
  });

  it('every accepted spelling of the same suffix normalizes identically', () => {
    const spellings = ['-custom', '.kibana-custom', 'kibana-custom', 'custom'];
    const normalized = spellings.map(normalizeKibanaIndexSuffix);
    expect(normalized).toEqual(['-custom', '-custom', '-custom', '-custom']);
  });
});
