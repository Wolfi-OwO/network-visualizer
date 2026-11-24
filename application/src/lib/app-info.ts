// Build metadata for GET /api/info: the same fields and names every app of the stack answers (name, version,
// revision, buildDate, repositoryUrl). The Dockerfile copies its build args into these variables; outside a real image
// the version is "dev" and the rest is empty.
export interface AppInfo {
  name: string;
  version: string;
  revision: string;
  buildDate: string;
  repositoryUrl: string;
}

export function appInfo(env: NodeJS.ProcessEnv = process.env): AppInfo {
  const raw = env.APP_VERSION && env.APP_VERSION !== '0.0.0-dev' ? env.APP_VERSION : 'dev';
  return {
    name: 'netviz',
    // Release tags read v2.9.1 everywhere else; the image build arg is the bare number.
    version: /^\d/.test(raw) ? `v${raw}` : raw,
    revision: env.APP_REVISION && env.APP_REVISION !== 'unknown' ? env.APP_REVISION : '',
    buildDate: env.APP_BUILD_DATE ?? '',
    repositoryUrl: env.APP_REPOSITORY_URL ?? 'https://github.com/Wolfi-OwO/network-visualizer',
  };
}
