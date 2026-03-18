export type SiteProxyTarget = "site" | "docs";

export type SiteProxyConfig = {
  siteOrigin: string;
  docsOrigin: string;
  docsPrefixes: string[];
  docsAssetPrefixes: string[];
  sitePrefixes: string[];
  docsArtifactPaths: string[];
};

const DEFAULT_DOCS_PREFIXES = ["/docs"];
const DEFAULT_DOCS_ASSET_PREFIXES = ["/_astro", "/pagefind"];
const DEFAULT_SITE_PREFIXES = ["/_next"];
const DEFAULT_DOCS_ARTIFACT_PATHS = [
  "/AGENTS.md",
  "/docs.json",
  "/install.md",
  "/llms.txt",
  "/llms-full.txt",
];

export function createSiteProxyConfig(overrides: Partial<SiteProxyConfig> = {}): SiteProxyConfig {
  return {
    siteOrigin: overrides.siteOrigin ?? "http://localhost:3000",
    docsOrigin: overrides.docsOrigin ?? "http://localhost:4321",
    docsPrefixes: overrides.docsPrefixes ?? DEFAULT_DOCS_PREFIXES,
    docsAssetPrefixes: overrides.docsAssetPrefixes ?? DEFAULT_DOCS_ASSET_PREFIXES,
    sitePrefixes: overrides.sitePrefixes ?? DEFAULT_SITE_PREFIXES,
    docsArtifactPaths: overrides.docsArtifactPaths ?? DEFAULT_DOCS_ARTIFACT_PATHS,
  };
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getRefererPathname(referer: string | null | undefined) {
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).pathname;
  } catch {
    return null;
  }
}

export function resolveSiteProxyTarget(
  pathname: string,
  headers: Headers | Record<string, string | undefined>,
  config: SiteProxyConfig = createSiteProxyConfig(),
): SiteProxyTarget {
  const referer =
    headers instanceof Headers ? headers.get("referer") : headers.referer;

  if (startsWithAny(pathname, config.sitePrefixes)) {
    return "site";
  }

  if (
    startsWithAny(pathname, config.docsPrefixes) ||
    startsWithAny(pathname, config.docsAssetPrefixes) ||
    config.docsArtifactPaths.includes(pathname)
  ) {
    return "docs";
  }

  const refererPathname = getRefererPathname(referer);

  if (
    refererPathname &&
    startsWithAny(refererPathname, config.docsPrefixes) &&
    !startsWithAny(pathname, config.sitePrefixes)
  ) {
    return "docs";
  }

  return "site";
}
