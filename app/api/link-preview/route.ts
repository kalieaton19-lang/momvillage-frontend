import { NextRequest, NextResponse } from "next/server";

function isPrivateHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") {
    return true;
  }
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function extractMeta(html: string, key: string, attribute: "property" | "name") {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+${attribute}=["']${key}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] || match?.[2] || "";
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || "";
}

function absolutize(baseUrl: string, maybeRelative: string) {
  if (!maybeRelative) return "";
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(target.protocol) || isPrivateHostname(target.hostname)) {
    return NextResponse.json({ error: "Blocked url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "MomVillage Link Preview Bot",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) {
      return NextResponse.json({ url: target.toString() });
    }

    const html = await response.text();
    const title = extractMeta(html, "og:title", "property") || extractTitle(html);
    const description =
      extractMeta(html, "og:description", "property") ||
      extractMeta(html, "description", "name");
    const image = absolutize(
      target.toString(),
      extractMeta(html, "og:image", "property"),
    );
    const siteName = extractMeta(html, "og:site_name", "property");

    return NextResponse.json({
      url: target.toString(),
      title,
      description,
      image,
      siteName,
    });
  } catch {
    return NextResponse.json({ url: target.toString() });
  } finally {
    clearTimeout(timeout);
  }
}
