// Only browser-safe values reach the storefront. Google Maps browser keys are public credentials;
// restrict them by HTTP referrer and API in Google Cloud. Never serialize process.env.
export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  const externalVercelBuild = env.VERCEL === "1" || env.VERCEL_BUILD === "1";
  return {
    apiUrl: externalVercelBuild ? "" : env.MANUS_API_URL ?? "",
    apiBrowserKey: externalVercelBuild ? "" : env.MANUS_API_BROWSER_KEY ?? "",
    googleMapsBrowserKey: env.GOOGLE_MAPS_BROWSER_KEY ?? "",
  };
}

export function publicPlatformScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}
