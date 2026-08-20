/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { KibanaFeature } from '@kbn/features-plugin/server';
import { featuresPluginMock } from '@kbn/features-plugin/server/mocks';
import { loggerMock } from '@kbn/logging-mocks';

import { transformElasticsearchRoleToRole } from './elasticsearch_role';
import { APPLICATION_PREFIX } from '../../../common/constants';
import { transformPutPayloadToElasticsearchRole } from '../../routes/authorization/roles/model';

// Two Kibana instances against ONE Elasticsearch cluster, differing only by `kibana.index`.
const STAGING_INDEX = '.kibana-staging';
const RELEASE_INDEX = '.kibana-release';

const stagingApp = `${APPLICATION_PREFIX}${STAGING_INDEX}`; // kibana-.kibana-staging
const releaseApp = `${APPLICATION_PREFIX}${RELEASE_INDEX}`; // kibana-.kibana-release

const features: KibanaFeature[] = [];
const logger = loggerMock.create();
const { subFeaturePrivilegeIterator } = featuresPluginMock.createSetup();

const readBack = (esRole: { applications: any[] }, application: string) =>
  transformElasticsearchRoleToRole({
    features,
    elasticsearchRole: {
      cluster: [],
      remote_cluster: [],
      indices: [],
      remote_indices: [],
      run_as: [],
      metadata: {},
      transient_metadata: { enabled: true },
      ...esRole,
    } as any,
    name: 'app-user',
    application,
    logger,
    subFeaturePrivilegeIterator,
  });

describe('staging vs release Kibana isolation via kibana.index', () => {
  it('derives a distinct ES application name per kibana.index', () => {
    expect(stagingApp).toBe('kibana-.kibana-staging');
    expect(releaseApp).toBe('kibana-.kibana-release');
    expect(stagingApp).not.toBe(releaseApp);
  });

  it('lets one role name carry read-write on staging and read-only on release', () => {
    // 1. Admin on the STAGING Kibana grants `all` to role "app-user".
    const afterStagingWrite = transformPutPayloadToElasticsearchRole(
      { kibana: [{ spaces: ['*'], base: ['all'], feature: {} }] } as any,
      stagingApp,
      [] // role does not exist yet
    );

    expect(afterStagingWrite.applications).toEqual([
      { application: stagingApp, privileges: ['all'], resources: ['*'] },
    ]);

    // 2. Admin on the RELEASE Kibana grants `read` to the SAME role name.
    //    The release instance reads the existing ES role and writes its own app entry.
    const afterReleaseWrite = transformPutPayloadToElasticsearchRole(
      { kibana: [{ spaces: ['*'], base: ['read'], feature: {} }] } as any,
      releaseApp,
      afterStagingWrite.applications // existing state in ES
    );

    // PROOF A: both entries coexist — the release write did NOT clobber staging.
    expect(afterReleaseWrite.applications).toEqual(
      expect.arrayContaining([
        { application: stagingApp, privileges: ['all'], resources: ['*'] },
        { application: releaseApp, privileges: ['read'], resources: ['*'] },
      ])
    );
    expect(afterReleaseWrite.applications).toHaveLength(2);

    // PROOF B: each instance reads back ONLY its own privileges.
    const asSeenByStaging = readBack(afterReleaseWrite, stagingApp);
    const asSeenByRelease = readBack(afterReleaseWrite, releaseApp);

    expect(asSeenByStaging.kibana).toEqual([{ spaces: ['*'], base: ['all'], feature: {} }]);
    expect(asSeenByRelease.kibana).toEqual([{ spaces: ['*'], base: ['read'], feature: {} }]);

    // PROOF C: the other instance's privileges are not silently merged in;
    // they surface as foreign applications, not as effective privileges.
    expect(asSeenByStaging._unrecognized_applications).toEqual([releaseApp]);
    expect(asSeenByRelease._unrecognized_applications).toEqual([stagingApp]);
  });

  it('re-editing on staging preserves the release grant (and vice versa)', () => {
    const existing = [
      { application: stagingApp, privileges: ['all'], resources: ['*'] },
      { application: releaseApp, privileges: ['read'], resources: ['*'] },
    ];

    // Staging admin downgrades staging to `read`; release entry must survive untouched.
    const edited = transformPutPayloadToElasticsearchRole(
      { kibana: [{ spaces: ['*'], base: ['read'], feature: {} }] } as any,
      stagingApp,
      existing
    );

    expect(edited.applications).toEqual(
      expect.arrayContaining([{ application: releaseApp, privileges: ['read'], resources: ['*'] }])
    );
    expect(readBack(edited, releaseApp).kibana).toEqual([
      { spaces: ['*'], base: ['read'], feature: {} },
    ]);
  });

  it('removing all Kibana privileges on release does not revoke them on staging', () => {
    const existing = [
      { application: stagingApp, privileges: ['all'], resources: ['*'] },
      { application: releaseApp, privileges: ['read'], resources: ['*'] },
    ];

    const revokedOnRelease = transformPutPayloadToElasticsearchRole(
      { kibana: [] } as any,
      releaseApp,
      existing
    );

    expect(revokedOnRelease.applications).toEqual([
      { application: stagingApp, privileges: ['all'], resources: ['*'] },
    ]);
    expect(readBack(revokedOnRelease, stagingApp).kibana).toEqual([
      { spaces: ['*'], base: ['all'], feature: {} },
    ]);
    expect(readBack(revokedOnRelease, releaseApp).kibana).toEqual([]);
  });
});
