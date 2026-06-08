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

function extractFirstMeta(html: string, candidates: Array<{ key: string; attribute: "property" | "name" }>) {
  for (const candidate of candidates) {
    const value = extractMeta(html, candidate.key, candidate.attribute);
    if (value) return value;
  }
  return "";
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || "";
}

function extractLinkTag(html: string, rel: string) {
  const pattern = new RegExp(
    `<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']*)["'][^>]*>|<link[^>]+href=["']([^"']*)["'][^>]+rel=["']${rel}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] || match?.[2] || "";
}

function extractItemProp(html: string, itemProp: string) {
  const pattern = new RegExp(
    `<meta[^>]+itemprop=["']${itemProp}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+itemprop=["']${itemProp}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] || match?.[2] || "";
}

function extractJsonLdImage(html: string) {
  const scriptMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const scriptTag of scriptMatches) {
    const contentMatch = scriptTag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const jsonText = contentMatch?.[1]?.trim();
    if (!jsonText) continue;

    try {
      const parsed = JSON.parse(jsonText);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;

        const image = (current as { image?: unknown }).image;
        if (typeof image === "string" && image) return image;
        if (Array.isArray(image)) {
          const stringImage = image.find((entry) => typeof entry === "string");
          if (typeof stringImage === "string" && stringImage) return stringImage;
          const objectImage = image.find((entry) => entry && typeof entry === "object");
          if (objectImage && typeof objectImage === "object" && "url" in objectImage) {
            const url = (objectImage as { url?: unknown }).url;
            if (typeof url === "string" && url) return url;
          }
        }
        if (image && typeof image === "object" && "url" in image) {
          const url = (image as { url?: unknown }).url;
          if (typeof url === "string" && url) return url;
        }

        for (const value of Object.values(current)) {
          if (value && typeof value === "object") {
            if (Array.isArray(value)) queue.push(...value);
            else queue.push(value);
          }
        }
      }
    } catch {
      continue;
    }
  }

  return "";
}

function getFallbackSiteName(target: URL) {
  const hostname = target.hostname.replace(/^www\./i, "").toLowerCase();
  if (hostname.includes("facebook.com") || hostname.includes("fb.com")) {
    return target.toString().toLowerCase().includes("marketplace") ? "Facebook Marketplace" : "Facebook";
  }
  if (hostname.includes("instagram.com")) return "Instagram";
  if (hostname.includes("tiktok.com")) return "TikTok";
  return target.hostname.replace(/^www\./i, "");
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
    const title =
      extractFirstMeta(html, [
        { key: "og:title", attribute: "property" },
        { key: "twitter:title", attribute: "name" },
      ]) || extractTitle(html);
    const description =
      extractFirstMeta(html, [
        { key: "og:description", attribute: "property" },
        { key: "twitter:description", attribute: "name" },
        { key: "description", attribute: "name" },
      ]) || extractItemProp(html, "description");
    const image = absolutize(
      target.toString(),
      extractFirstMeta(html, [
        { key: "og:image", attribute: "property" },
        { key: "og:image:url", attribute: "property" },
        { key: "og:image:secure_url", attribute: "property" },
        { key: "twitter:image", attribute: "name" },
        { key: "twitter:image:src", attribute: "name" },
      ]) || extractItemProp(html, "image") || extractLinkTag(html, "image_src") || extractJsonLdImage(html),
    );
    const siteName =
      extractFirstMeta(html, [
        { key: "og:site_name", attribute: "property" },
        { key: "application-name", attribute: "name" },
      ]) || getFallbackSiteName(target);

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
