import { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const robloxPath = url.pathname.replace(/^\/api\/games/, "");
  const origin = req.headers.get("origin");
  const originHost = origin ? new URL(origin).host : "";
  const allowOrigin =
    origin && (originHost === url.host || originHost.startsWith("localhost:") || originHost.startsWith("127.0.0.1:"))
      ? origin
      : `https://${url.host}`;

  const corsHeaders = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const targetUrl = `https://games.roblox.com${robloxPath}${url.search}`;

  try {
    const response = await fetch(targetUrl);
    const outHeaders = new Headers(corsHeaders);
    if (response.headers.get("content-type")) {
      outHeaders.set("Content-Type", response.headers.get("content-type")!);
    }
    return new Response(response.body, {
      status: response.status,
      headers: outHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to proxy request" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/games/*",
};
