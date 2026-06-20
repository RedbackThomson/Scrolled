import { describe, expect, it } from 'vitest';
import { resolveAppConfig } from './index';

describe('resolveAppConfig', () => {
  it('defaults to the generic profile when no env is set', () => {
    const config = resolveAppConfig({});
    expect(config.deploymentProfile).toBe('generic');
    expect(config.features).toEqual({ enableUserImport: true, enableHostedDataset: false });
    expect(config.fixedDataset).toBeUndefined();
  });

  it('treats an unknown profile value as generic', () => {
    const config = resolveAppConfig({ VITE_DEPLOYMENT_PROFILE: 'something-else' });
    expect(config.deploymentProfile).toBe('generic');
  });

  it('resolves the fixed-hosted-dataset profile with defaults', () => {
    const config = resolveAppConfig({
      VITE_DEPLOYMENT_PROFILE: 'fixed-hosted-dataset',
      VITE_DATASET_FAMILY: 'example',
    });
    expect(config.deploymentProfile).toBe('fixed-hosted-dataset');
    expect(config.features).toEqual({ enableUserImport: false, enableHostedDataset: true });
    expect(config.fixedDataset).toEqual({
      family: 'example',
      channel: 'latest',
      repositoryBaseUrl: '/datasets',
    });
  });

  it('honors explicit channel and repository base url, trimming trailing slashes', () => {
    const config = resolveAppConfig({
      VITE_DEPLOYMENT_PROFILE: 'fixed-hosted-dataset',
      VITE_DATASET_FAMILY: 'example',
      VITE_DATASET_CHANNEL: 'stable',
      VITE_DATASET_REPO_URL: 'https://cdn.example.com/datasets/',
    });
    expect(config.fixedDataset).toEqual({
      family: 'example',
      channel: 'stable',
      repositoryBaseUrl: 'https://cdn.example.com/datasets',
    });
  });

  it('throws when a fixed build omits the dataset family', () => {
    expect(() => resolveAppConfig({ VITE_DEPLOYMENT_PROFILE: 'fixed-hosted-dataset' })).toThrow(
      /VITE_DATASET_FAMILY/,
    );
  });
});
