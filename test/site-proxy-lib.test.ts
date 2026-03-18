import { describe, expect, test } from "bun:test";
import { createSiteProxyConfig, resolveSiteProxyTarget } from "../scripts/site-proxy-lib";

const config = createSiteProxyConfig();

describe("resolveSiteProxyTarget", () => {
  test("routes docs paths to the docs target", () => {
    expect(resolveSiteProxyTarget("/docs", {}, config)).toBe("docs");
    expect(resolveSiteProxyTarget("/docs/overview", {}, config)).toBe("docs");
  });

  test("routes docs-owned asset prefixes to the docs target", () => {
    expect(resolveSiteProxyTarget("/_astro/app.js", {}, config)).toBe("docs");
    expect(resolveSiteProxyTarget("/pagefind/pagefind.js", {}, config)).toBe("docs");
  });

  test("routes docs artifacts to the docs target", () => {
    expect(resolveSiteProxyTarget("/llms.txt", {}, config)).toBe("docs");
    expect(resolveSiteProxyTarget("/install.md", {}, config)).toBe("docs");
  });

  test("keeps Next assets on the site target", () => {
    expect(resolveSiteProxyTarget("/_next/static/chunk.js", {}, config)).toBe("site");
  });

  test("uses the referer to keep docs page assets on the docs target", () => {
    expect(
      resolveSiteProxyTarget(
        "/fonts/geist.woff2",
        { referer: "http://127.0.0.1:3100/docs/overview" },
        config,
      ),
    ).toBe("docs");
  });

  test("defaults to the site target for non-doc routes", () => {
    expect(resolveSiteProxyTarget("/", {}, config)).toBe("site");
    expect(resolveSiteProxyTarget("/blog", {}, config)).toBe("site");
  });
});
