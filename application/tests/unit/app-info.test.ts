/// <reference types="mocha" />
import { assert } from '../common.ts';
import { appInfo } from '../../src/lib/app-info.ts';

describe('appInfo', () => {
  it('reads the values the Dockerfile copies from its build args', () => {
    const info = appInfo({
      APP_VERSION: '2.9.1',
      APP_REVISION: 'abc123',
      APP_BUILD_DATE: '2026-11-24T10:00:00Z',
      APP_REPOSITORY_URL: 'https://example.test/repo',
    });
    assert.deepEqual(info, {
      name: 'netviz',
      version: 'v2.9.1',
      revision: 'abc123',
      buildDate: '2026-11-24T10:00:00Z',
      repositoryUrl: 'https://example.test/repo',
    });
  });

  it('says dev, with nothing invented, outside a real image', () => {
    const info = appInfo({ APP_VERSION: '0.0.0-dev', APP_REVISION: 'unknown' });
    assert.equal(info.version, 'dev');
    assert.equal(info.revision, '');
    assert.equal(info.buildDate, '');
  });
});
