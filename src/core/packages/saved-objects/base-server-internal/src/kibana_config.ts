/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { TypeOf } from '@kbn/config-schema';
import { schema } from '@kbn/config-schema';
import type { ServiceConfigDescriptor } from '@kbn/core-base-server-internal';
import { normalizeKibanaIndexSuffix } from '@kbn/core-saved-objects-server';

/**
 * Schema for the `kibana` config root.
 *
 * `kibana.index` was removed as a functional setting in 8.0 and rejected as an
 * unknown key from 8.8 onwards (once the single `.kibana` index was split into
 * several `.kibana*` indices). It is re-introduced here as a suffix appended
 * to every saved object index name, e.g. setting `kibana.index: -custom`
 * yields `.kibana-custom`, `.kibana_task_manager-custom`, and so on. The
 * `.kibana` prefix is always preserved (rather than replaced) so that
 * Elasticsearch's built-in `kibana_system` role, whose index privileges match
 * the `.kibana*` pattern, keeps working against the renamed indices.
 *
 * A few equivalent spellings of the suffix are accepted, normalized by
 * {@link normalizeKibanaIndexSuffix}: `-custom`, `.kibana-custom`,
 * `kibana-custom`, and the bare `custom` all resolve to the same `-custom`
 * suffix.
 */
const kibanaConfigSchema = schema.object({
  enabled: schema.boolean({ defaultValue: true }),
  index: schema.string({
    defaultValue: '',
    validate: (value: string) => {
      if (normalizeKibanaIndexSuffix(value) === null) {
        return (
          `"kibana.index" must resolve to a non-empty, unambiguous suffix. Use one of ` +
          `"-custom", ".kibana-custom", "kibana-custom", or the bare "custom".`
        );
      }
    },
  }),
});

export type KibanaConfigType = TypeOf<typeof kibanaConfigSchema>;

export const kibanaConfig: ServiceConfigDescriptor<KibanaConfigType> = {
  path: 'kibana',
  schema: kibanaConfigSchema,
};
