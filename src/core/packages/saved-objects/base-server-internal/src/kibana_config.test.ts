/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { kibanaConfig } from './kibana_config';

const validate = (index: string) => kibanaConfig.schema.validate({ index });

describe('kibanaConfigSchema', () => {
  describe('index', () => {
    it('defaults to an empty string', () => {
      expect(kibanaConfig.schema.validate({})).toEqual({ enabled: true, index: '' });
    });

    it('accepts an empty string', () => {
      expect(() => validate('')).not.toThrow();
    });

    it('accepts an explicit suffix (leading dash)', () => {
      expect(() => validate('-custom')).not.toThrow();
    });

    it('accepts a complete index name, with or without the leading dot', () => {
      expect(() => validate('.kibana-custom')).not.toThrow();
      expect(() => validate('kibana-custom')).not.toThrow();
    });

    it('accepts a bare word as an implicit suffix', () => {
      expect(() => validate('custom')).not.toThrow();
    });

    it('rejects a suffix with nothing after the dash', () => {
      expect(() => validate('-')).toThrowErrorMatchingInlineSnapshot(
        `"[index]: \\"kibana.index\\" must resolve to a non-empty, unambiguous suffix. Use one of \\"-custom\\", \\".kibana-custom\\", \\"kibana-custom\\", or the bare \\"custom\\"."`
      );
      expect(() => validate('.kibana-')).toThrow();
      expect(() => validate('kibana-')).toThrow();
    });

    it('rejects values with invalid index-name characters', () => {
      expect(() => validate('Custom')).toThrow();
      expect(() => validate('cus tom')).toThrow();
      expect(() => validate('cus*tom')).toThrow();
    });
  });
});
