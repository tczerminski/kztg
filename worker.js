const RADIO_UPSTREAM_DEFAULT = "https://s3.free-shoutcast.com/stream/18132";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const radioUpstream = env.RADIO_STREAM_URL || RADIO_UPSTREAM_DEFAULT;

    if (path === "/radio-status") {
      try {
        const res = await fetch(radioUpstream, { method: "HEAD", signal: AbortSignal.timeout(4000) });
        return new Response(JSON.stringify({ online: res.ok }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      } catch {
        return new Response(JSON.stringify({ online: false }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
    }

    if (path === "/stream") {
      const upstream = new Request(radioUpstream, {
        headers: request.headers,
        method: request.method,
      });
      return fetch(upstream);
    }

    if (path === "/" || path === "/index.html") {
      const r2Html = await env.BUCKET.get("site/index.html").catch(() => null);
      const htmlRes = r2Html
        ? new Response(r2Html.body, { headers: { "Content-Type": "text/html;charset=UTF-8" } })
        : await env.ASSETS.fetch(new URL("/index.html", url).toString());

      const htmlHeaders = new Headers(htmlRes.headers);
      htmlHeaders.set("Cache-Control", "no-cache");
      return new Response(htmlRes.body, { status: htmlRes.status, headers: htmlHeaders });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    if (path.startsWith("/videos/")) {
      headers.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    } else if (path.match(/\.js$/)) {
      headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    } else if (path.match(/\.css$/)) {
      headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    } else if (path.match(/\.(woff2?|ttf|otf)$/)) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (path.match(/\.(jpg|jpeg|webp|png|gif|svg|ico)$/)) {
      headers.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    }

    return new Response(response.body, { status: response.status, headers });
  },
};
