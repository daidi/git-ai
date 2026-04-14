export default {
  async fetch(request, env, ctx) {
    const targetUrl = "https://api.github.com/repos/daidi/git-ai/releases/latest";
    
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;
    
    let response = await cache.match(cacheKey);
    
    if (!response) {
      // Fetch from GitHub
      const ghResponse = await fetch(targetUrl, {
        headers: {
          "User-Agent": "git-ai-update-proxy",
          "Accept": "application/vnd.github.v3+json"
        }
      });
      
      // Reconstruct the response with cache headers
      response = new Response(ghResponse.body, ghResponse);
      
      // Cache for 1 hour to prevent GitHub rate limits and improve latency
      response.headers.set("Cache-Control", "s-maxage=3600");
      
      // Open CORS
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET");
      
      if (ghResponse.status === 200) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
    }
    
    return response;
  }
};
