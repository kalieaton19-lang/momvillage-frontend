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

function getContentTypeFromUrl(url: URL) {
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return "";
}

function sniffImageContentType(buffer: Uint8Array) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    buffer[8] === 0x61 &&
    buffer[9] === 0x76 &&
    buffer[10] === 0x69 &&
    buffer[11] === 0x66
  ) {
    return "image/avif";
  }
  const textSample = new TextDecoder("utf-8").decode(buffer.slice(0, 256)).trim().toLowerCase();
  if (textSample.startsWith("<svg") || textSample.includes("<svg")) {
    return "image/svg+xml";
  }
  return "";
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

    const imageBuffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    const headerContentType = response.headers.get("content-type") || "";
    const inferredContentType =
      (headerContentType.startsWith("image/") ? headerContentType : "") ||
      sniffImageContentType(imageBytes) ||
      getContentTypeFromUrl(target);

    if (!inferredContentType.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid image content" }, { status: 415 });
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "content-type": inferredContentType,
        "cache-control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}