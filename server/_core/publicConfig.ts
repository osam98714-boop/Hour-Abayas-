// Only browser-safe map configuration reaches the storefront. Never serialize process.env.
export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  const externalVercelBuild = env.VERCEL === "1" || env.VERCEL_BUILD === "1";
  return {
    apiUrl: externalVercelBuild ? "" : env.MANUS_API_URL ?? "",
    apiBrowserKey: externalVercelBuild ? "" : env.MANUS_API_BROWSER_KEY ?? "",
  };
}

export function publicPlatformScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}
