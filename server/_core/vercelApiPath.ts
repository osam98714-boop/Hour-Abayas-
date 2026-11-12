const REWRITE_PATH_PARAMETER = "__hour_abayas_original_api_path";

export function restoreVercelApiRequestUrl(requestUrl: string): string {
  const rewrittenUrl = new URL(requestUrl, "https://vercel.invalid");
  const paths = rewrittenUrl.searchParams.getAll(REWRITE_PATH_PARAMETER);
  const originalPath = paths.at(-1);

  if (!originalPath) return requestUrl;
  if (!originalPath.startsWith("/api/") || originalPath.includes("\\") || originalPath.includes("\0")) {
    throw new Error("Invalid rewritten API path");
  }
  if (originalPath.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid rewritten API path");
  }

  rewrittenUrl.searchParams.delete(REWRITE_PATH_PARAMETER);
  const query = rewrittenUrl.searchParams.toString();
  return `${originalPath}${query ? `?${query}` : ""}`;
}
