import { NextResponse } from "next/server";
import { IIJ_VIDEO_ORIGIN, rewriteIijPlayerHtml } from "@/lib/video-proxy";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const passthroughHeaders = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

function buildUpstreamUrl(pathSegments: string[], requestUrl: string) {
  const upstreamUrl = new URL(`${IIJ_VIDEO_ORIGIN}/${pathSegments.join("/")}`);
  const incoming = new URL(requestUrl);
  incoming.searchParams.delete("returnTo");
  upstreamUrl.search = incoming.search;
  return upstreamUrl;
}

function buildRequestHeaders(req: Request) {
  const headers = new Headers();
  const range = req.headers.get("range");
  const accept = req.headers.get("accept");

  if (range) headers.set("range", range);
  if (accept) headers.set("accept", accept);

  return headers;
}

function buildResponseHeaders(upstream: Response, contentLength?: string | null) {
  const headers = new Headers();

  passthroughHeaders.forEach((headerName) => {
    const value = headerName === "content-length" ? contentLength : upstream.headers.get(headerName);
    if (value) headers.set(headerName, value);
  });

  return headers;
}

export async function GET(req: Request, context: RouteContext) {
  const { path = [] } = await context.params;
  if (path.length === 0) {
    return NextResponse.json({ error: "Path is required." }, { status: 400 });
  }

  const upstreamUrl = buildUpstreamUrl(path, req.url);
  const upstream = await fetch(upstreamUrl, {
    headers: buildRequestHeaders(req),
  });

  const contentType = upstream.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    const html = await upstream.text();
    const incoming = new URL(req.url);
    const rewritten = rewriteIijPlayerHtml(html, incoming.searchParams.get("returnTo") ?? "/videos");
    return new Response(rewritten, {
      status: upstream.status,
      headers: buildResponseHeaders(upstream, null),
    });
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: buildResponseHeaders(upstream, String(body.byteLength)),
  });
}
