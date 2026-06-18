export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    const path = url.pathname;

    const headers = new Headers(response.headers);

    if (path.startsWith("/videos/")) {
      headers.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    } else if (path.match(/\.(js|css)$/) ) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (path.match(/\.(woff2?|ttf|otf)$/)) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (path.match(/\.(jpg|jpeg|webp|png|gif|svg|ico)$/)) {
      headers.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
