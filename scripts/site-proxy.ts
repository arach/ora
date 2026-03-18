import { createSiteProxyConfig, resolveSiteProxyTarget } from "./site-proxy-lib";

const config = createSiteProxyConfig({
  siteOrigin: process.env.SITE_TARGET,
  docsOrigin: process.env.DOCS_TARGET,
});

const port = Number(process.env.PROXY_PORT ?? "3100");

function getUpstreamOrigin(target: "site" | "docs") {
  return target === "docs" ? config.docsOrigin : config.siteOrigin;
}

function createProxyError(upstream: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return new Response(`Proxy upstream unavailable: ${upstream}\n${message}\n`, {
    status: 502,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const target = resolveSiteProxyTarget(requestUrl.pathname, request.headers, config);
    const upstreamOrigin = getUpstreamOrigin(target);
    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, upstreamOrigin);

    try {
      const headers = new Headers(request.headers);
      headers.set("host", new URL(upstreamOrigin).host);
      headers.set("x-forwarded-host", requestUrl.host);
      headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));
      headers.set("x-forwarded-prefix", target === "docs" ? "/docs" : "/");

      return await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
      });
    } catch (error) {
      return createProxyError(upstreamOrigin, error);
    }
  },
});

console.log(`site proxy listening on http://localhost:${server.port}`);
console.log(`  /      -> ${config.siteOrigin}`);
console.log(`  /docs  -> ${config.docsOrigin}`);
