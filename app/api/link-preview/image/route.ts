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

  if (!['http:', 'https:'].includes(target.protocol) || isPrivateHostname(target.hostname)) {
    return NextResponse.json({ error: "Blocked url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.facebook.com/",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid image content" }, { status: 415 });
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}