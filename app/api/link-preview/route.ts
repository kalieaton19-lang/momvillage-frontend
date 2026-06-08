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

function cleanExtractedText(value: string) {
  return decodeEscapedContent(value)
    .replace(/\\n|\\r|\n|\r/g, " ")
    .replace(/\\"/g, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
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

function decodeEscapedContent(value: string) {
  return value
    .replace(/\\u002F/gi, "/")
    .replace(/\\u003A/gi, ":")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003C/gi, "<")
    .replace(/\\u003E/gi, ">")
    .replace(/\\u002D/gi, "-")
    .replace(/\\u0025/gi, "%")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");
}

function extractHeuristicTitle(html: string) {
  const decodedHtml = decodeEscapedContent(html);
  const patterns = [
    /"marketplace_listing_title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"listing_title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"marketplace_product_title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"marketplace_listing_id"/i,
  ];

  for (const pattern of patterns) {
    const match = decodedHtml.match(pattern);
    const value = cleanExtractedText(match?.[1] || "");
    if (value && value.length > 3) {
      return value;
    }
  }

  return "";
}

function extractHeuristicDescription(html: string) {
  const decodedHtml = decodeEscapedContent(html);
  const priceMatch = decodedHtml.match(/"(?:formatted_)?price"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  const locationMatch = decodedHtml.match(/"location_text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);

  const parts = [cleanExtractedText(priceMatch?.[1] || ""), cleanExtractedText(locationMatch?.[1] || "")].filter(Boolean);
  return parts.join(" • ");
}

function isLikelyPreviewImage(url: string) {
  const lower = url.toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;
  if (
    lower.includes("sprite") ||
    lower.includes("emoji") ||
    lower.includes("icon") ||
    lower.includes("profile_pic") ||
    lower.includes("safe_image") ||
    lower.includes("static.xx")
  ) return false;
  return /(fbcdn\.net|scontent\.|cdninstagram|fbsbx\.com|images\.)/.test(lower);
}

function normalizeCandidateImage(value: string) {
  return cleanExtractedText(value).replace(/\\/g, "");
}

function collectMatches(html: string, patterns: RegExp[]) {
  const decodedHtml = decodeEscapedContent(html);
  const results: string[] = [];

  for (const pattern of patterns) {
    const matches = decodedHtml.matchAll(pattern);
    for (const match of matches) {
      const rawValue = match[1] || match[0] || "";
      const normalizedValue = normalizeCandidateImage(rawValue);
      const nestedUrlMatch = normalizedValue.match(/https?:\/\/[^\s"'<>\\]+/i);
      const candidate = nestedUrlMatch?.[0] || normalizedValue;
      if (candidate && isLikelyPreviewImage(candidate)) {
        results.push(candidate);
      }
    }
  }

  return results;
}

function collectMarketplaceSpecificImages(html: string) {
  const decodedHtml = decodeEscapedContent(html);
  const patterns = [
    /"primary_listing_photo"[\s\S]{0,1200}?"image"\s*:\s*\{[\s\S]{0,800}?"uri"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"listing_photos"\s*:\s*\[[\s\S]{0,2000}?"image"\s*:\s*\{[\s\S]{0,800}?"uri"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"cover_photo"[\s\S]{0,1200}?"image"\s*:\s*\{[\s\S]{0,800}?"uri"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"preferred_thumbnail"[\s\S]{0,1200}?"image"\s*:\s*\{[\s\S]{0,800}?"uri"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"listing_photo"[\s\S]{0,1200}?"image"\s*:\s*\{[\s\S]{0,800}?"uri"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"seo_image_url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"image_url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
  ];

  return collectMatches(decodedHtml, patterns);
}

function collectHeuristicImages(html: string) {
  const candidatePatterns = [
    /"listing_photos"\s*:\s*\[(.*?)\]/gi,
    /https?:\/\/[^\s"'<>\\]+(?:fbcdn\.net|fbsbx\.com|cdninstagram\.com)[^\s"'<>\\]*/gi,
    /https?:\/\/[^\s"'<>\\]+scontent[^\s"'<>\\]*/gi,
    /"image"\s*:\s*"(https?:[^"\\]+)"/gi,
    /"image_url"\s*:\s*"(https?:[^"\\]+)"/gi,
    /"uri"\s*:\s*"(https?:[^"\\]+)"/gi,
  ];

  return collectMatches(html, candidatePatterns);
}

function scoreImageCandidate(url: string) {
  const lower = url.toLowerCase();
  let score = 0;

  if (lower.includes("marketplace")) score += 30;
  if (lower.includes("listing")) score += 20;
  if (lower.includes("cover")) score += 10;
  if (lower.includes("thumbnail")) score += 5;
  if (lower.includes("scontent")) score += 15;
  if (lower.includes("fbcdn.net")) score += 10;
  if (/(p\d{3,4}x\d{3,4}|_\d{3,4}x\d{3,4})/.test(lower)) score += 10;
  if (/(p50x50|p64x64|p80x80|_50x50|_64x64)/.test(lower)) score -= 20;

  return score;
}
function rankImageCandidates(baseUrl: string, candidates: string[]) {
  return [...new Set(candidates.map((candidate) => absolutize(baseUrl, candidate)).filter(Boolean))]
    .filter(isLikelyPreviewImage)
    .sort((left, right) => scoreImageCandidate(right) - scoreImageCandidate(left))
    .slice(0, 6);
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
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        referer: "https://www.facebook.com/",
      },
      cache: "no-store",
      redirect: "follow",
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
      ]) || extractHeuristicTitle(html) || extractTitle(html);
    const description =
      extractFirstMeta(html, [
        { key: "og:description", attribute: "property" },
        { key: "twitter:description", attribute: "name" },
        { key: "description", attribute: "name" },
      ]) || extractItemProp(html, "description") || extractHeuristicDescription(html);
    const imageCandidates = [
      extractFirstMeta(html, [
        { key: "og:image", attribute: "property" },
        { key: "og:image:url", attribute: "property" },
        { key: "og:image:secure_url", attribute: "property" },
        { key: "twitter:image", attribute: "name" },
        { key: "twitter:image:src", attribute: "name" },
      ]),
      ...collectMarketplaceSpecificImages(html),
      extractItemProp(html, "image"),
      extractLinkTag(html, "image_src"),
      extractJsonLdImage(html),
      ...collectHeuristicImages(html),
    ].filter(Boolean);
    const rankedImageCandidates = rankImageCandidates(target.toString(), imageCandidates);
    const image = rankedImageCandidates[0] || "";
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
      imageCandidates: rankedImageCandidates,
      siteName,
      debug: {
        hasTitle: !!title,
        hasDescription: !!description,
        hasImage: !!image,
        imageCandidateCount: rankedImageCandidates.length,
      },
    });
  } catch {
    return NextResponse.json({ url: target.toString() });
  } finally {
    clearTimeout(timeout);
  }
}
