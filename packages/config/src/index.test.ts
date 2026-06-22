import { describe, expect, it } from 'vitest';
import { resolveAppConfig, resolveIdentity, resolveSync } from './index';

const CLOUD_ENV = {
  VITE_IDENTITY_MODE: 'cloud',
  VITE_SUPABASE_URL: 'https://proj.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
};

describe('resolveAppConfig', () => {
  it('defaults to the generic profile when no env is set', () => {
    const config = resolveAppConfig({});
    expect(config.deploymentProfile).toBe('generic');
    expect(config.features).toEqual({
      enableUserImport: true,
      enableHostedDataset: false,
      enableAccounts: false,
      accountMenu: false,
      sync: false,
    });
    expect(config.fixedDataset).toBeUndefined();
    expect(config.identity).toEqual({ mode: 'anonymous' });
    expect(config.sync).toEqual({ mode: 'off' });
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
    expect(config.features).toEqual({
      enableUserImport: false,
      enableHostedDataset: true,
      enableAccounts: false,
      accountMenu: false,
      sync: false,
    });
    expect(config.fixedDataset).toEqual({
      family: 'example',
      channel: 'latest',
      repositoryBaseUrl: '/datasets',
    });
    expect(config.identity).toEqual({ mode: 'anonymous' });
  });

  it('enables account features when identity is cloud, independent of profile', () => {
    const config = resolveAppConfig({
      VITE_IDENTITY_MODE: 'cloud',
      VITE_SUPABASE_URL: 'https://proj.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
    });
    expect(config.deploymentProfile).toBe('generic');
    expect(config.features.enableAccounts).toBe(true);
    expect(config.features.accountMenu).toBe(true);
    expect(config.identity).toEqual({
      mode: 'cloud',
      cloud: {
        supabaseUrl: 'https://proj.supabase.co',
        supabaseKey: 'sb_publishable_key',
        oauthProviders: ['google'],
      },
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

describe('resolveIdentity', () => {
  it('defaults to anonymous when no env is set', () => {
    expect(resolveIdentity({})).toEqual({ mode: 'anonymous' });
  });

  it('treats an unknown identity mode as anonymous', () => {
    expect(resolveIdentity({ VITE_IDENTITY_MODE: 'something-else' })).toEqual({ mode: 'anonymous' });
  });

  it('resolves the cloud mode with the publishable key', () => {
    expect(
      resolveIdentity({
        VITE_IDENTITY_MODE: 'cloud',
        VITE_SUPABASE_URL: 'https://proj.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
      }),
    ).toEqual({
      mode: 'cloud',
      cloud: {
        supabaseUrl: 'https://proj.supabase.co',
        supabaseKey: 'sb_publishable_key',
        oauthProviders: ['google'],
      },
    });
  });

  it('falls back to the legacy anon key when no publishable key is set', () => {
    const identity = resolveIdentity({
      VITE_IDENTITY_MODE: 'cloud',
      VITE_SUPABASE_URL: 'https://proj.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'legacy-anon-key',
    });
    expect(identity.cloud?.supabaseKey).toBe('legacy-anon-key');
  });

  it('prefers the publishable key over a legacy anon key when both are set', () => {
    const identity = resolveIdentity({
      VITE_IDENTITY_MODE: 'cloud',
      VITE_SUPABASE_URL: 'https://proj.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
      VITE_SUPABASE_ANON_KEY: 'legacy-anon-key',
    });
    expect(identity.cloud?.supabaseKey).toBe('sb_publishable_key');
  });

  it('parses an explicit comma-separated OAuth provider list', () => {
    const identity = resolveIdentity({
      VITE_IDENTITY_MODE: 'cloud',
      VITE_SUPABASE_URL: 'https://proj.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
      VITE_SUPABASE_OAUTH_PROVIDERS: 'google, github ,',
    });
    expect(identity.cloud?.oauthProviders).toEqual(['google', 'github']);
  });

  it('throws when a cloud build omits the Supabase URL', () => {
    expect(() =>
      resolveIdentity({ VITE_IDENTITY_MODE: 'cloud', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key' }),
    ).toThrow(/VITE_SUPABASE_URL/);
  });

  it('throws when a cloud build omits any Supabase key', () => {
    expect(() =>
      resolveIdentity({ VITE_IDENTITY_MODE: 'cloud', VITE_SUPABASE_URL: 'https://proj.supabase.co' }),
    ).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });
});

describe('resolveSync', () => {
  const cloudIdentity = resolveIdentity(CLOUD_ENV);

  it('defaults to off when no env is set', () => {
    expect(resolveSync({}, { mode: 'anonymous' })).toEqual({ mode: 'off' });
  });

  it('treats an unknown sync mode as off', () => {
    expect(resolveSync({ VITE_SYNC_MODE: 'something-else' }, cloudIdentity)).toEqual({ mode: 'off' });
  });

  it('resolves supabase sync when identity is cloud', () => {
    expect(resolveSync({ VITE_SYNC_MODE: 'supabase' }, cloudIdentity)).toEqual({ mode: 'supabase' });
  });

  it('throws when supabase sync is requested without cloud identity', () => {
    expect(() => resolveSync({ VITE_SYNC_MODE: 'supabase' }, { mode: 'anonymous' })).toThrow(
      /VITE_IDENTITY_MODE=cloud/,
    );
  });
});

describe('resolveAppConfig — sync', () => {
  it('leaves sync off and the feature flag false by default', () => {
    const config = resolveAppConfig(CLOUD_ENV);
    expect(config.sync).toEqual({ mode: 'off' });
    expect(config.features.sync).toBe(false);
  });

  it('enables sync and the feature flag with cloud identity + supabase sync', () => {
    const config = resolveAppConfig({ ...CLOUD_ENV, VITE_SYNC_MODE: 'supabase' });
    expect(config.sync).toEqual({ mode: 'supabase' });
    expect(config.features.sync).toBe(true);
  });

  it('throws when supabase sync is configured without cloud identity', () => {
    expect(() => resolveAppConfig({ VITE_SYNC_MODE: 'supabase' })).toThrow(/VITE_IDENTITY_MODE=cloud/);
  });
});
