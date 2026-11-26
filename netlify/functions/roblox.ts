import { Config, Context } from "@netlify/functions";

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH"]);
const ALLOWED_PATHS = [
  /^\/cloud\/v2\/universes\/\d+$/,
  /^\/developer-products\/v2\/universes\/\d+\/developer-products(?:\/creator|\/\d+)?$/,
  /^\/game-passes\/v1\/universes\/\d+\/game-passes(?:\/creator|\/\d+)?$/,
  /^\/assets\/v1\/assets(?:\/\d+)?$/,
  /^\/assets\/v1\/operations\/[A-Za-z0-9_-]+$/,
];

function isAllowedPath(path: string, method: string, search: string): boolean {
  if (!ALLOWED_PATHS.some((pattern) => pattern.test(path))) return false;
  if (/^\/cloud\//.test(path)) return method === "GET" && !search;
  if (path.includes("/operations/")) return method === "GET" && !search;
  if (path.endsWith("/creator")) return method === "GET" && /^\?pageSize=100(?:&pageToken=[A-Za-z0-9._~%=-]+)?$/.test(search);
  if (/^\/assets\/v1\/assets\/\d+$/.test(path)) {
    return (method === "GET" && !search) || (method === "PATCH" && /^\?updateMask=description%2CdisplayName$/i.test(search));
  }
  if (path === "/assets/v1/assets") return method === "POST" && !search;
  if (path.endsWith("/developer-products") || path.endsWith("/game-passes")) return method === "POST" && !search;
  if (/\/(?:developer-products|game-passes)\/\d+$/.test(path)) return method === "PATCH" && !search;
  return false;
}

export default async (req: Request, context: Context) => {
  // Extract path to forward
  const url = new URL(req.url);
  const robloxPath = url.pathname.replace(/^\/api\/roblox/, "");
  const origin = req.headers.get("origin");
  let allowedOrigin = false;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      allowedOrigin = originUrl.host === url.host || ["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname);
    } catch {
      allowedOrigin = false;
    }
  }

  // Always return broad CORS headers, especially for OPTIONS preflight
  const corsHeaders: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "x-api-key, content-type, boundary",
    "Cache-Control": "no-store",
  };
  if (allowedOrigin && origin) corsHeaders["Access-Control-Allow-Origin"] = origin;

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (!ALLOWED_METHODS.has(req.method) || !isAllowedPath(robloxPath, req.method, url.search)) {
    return new Response(JSON.stringify({ error: "Roblox route or method is not supported" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Request body exceeds the 6 MB limit" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Construct target URL
  const targetUrl = `https://apis.roblox.com${robloxPath}${url.search}`;

  try {
    const headers = new Headers();
    const apiKey = req.headers.get("x-api-key");
    if (apiKey) {
      headers.set("x-api-key", apiKey);
    }
    
    // We must forward content-type since it includes the multipart boundary
    const contentType = req.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }

    const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;
    if (body && body.byteLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Request body exceeds the 6 MB limit" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const robloxReq = new Request(targetUrl, {
      method: req.method,
      headers,
      body,
      duplex: 'half'
    } as RequestInit & { duplex?: string });

    const response = await fetch(robloxReq);

    const outHeaders = new Headers(corsHeaders);
    // Forward Roblox's headers except transfer-encoding to avoid edge issues
    response.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== "transfer-encoding" && lowerKey !== "content-encoding") {
        outHeaders.set(key, val);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: outHeaders,
    });
  } catch (error) {
    console.error("Roblox Proxy Error:", error);
    return new Response(JSON.stringify({ error: "Failed to proxy request" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/roblox/*",
};
