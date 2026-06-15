"use client";

import { useEffect, useMemo, useState } from "react";

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s]+|(?:facebook|fb|m\.facebook|instagram|tiktok)\.com\/[^\s]+)/gi;
const TRAILING_URL_PUNCTUATION_REGEX = /[).,!?:;\]}]+$/;

type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  imageCandidates?: string[];
  siteName?: string;
};

type FallbackPreviewMeta = {
  siteName: string;
  title: string;
  description: string;
};

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url);
}

function normalizeUrl(url: string) {
  try {
    const trimmedUrl = url.trim().replace(TRAILING_URL_PUNCTUATION_REGEX, "");
    const withProtocol = /^(https?:)?\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    return new URL(withProtocol).toString();
  } catch {
    return url;
  }
}

function extractUrls(text: string) {
  const matches = text.match(URL_REGEX) || [];
  return Array.from(new Set(matches.map(normalizeUrl).filter(Boolean)));
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function getFallbackPreviewMeta(url: string): FallbackPreviewMeta {
  const hostname = getHostname(url);

  if (hostname.includes("facebook.com") || hostname.includes("fb.com")) {
    if (url.toLowerCase().includes("marketplace")) {
      return {
        siteName: "Facebook Marketplace",
        title: "Open Facebook Marketplace listing",
        description:
          "Tap to view this Marketplace post. Some Facebook listings do not expose a full preview image or description.",
      };
    }

    return {
      siteName: "Facebook",
      title: "Open Facebook link",
      description:
        "Tap to view this Facebook post. Facebook sometimes limits the preview details available to other apps.",
    };
  }

  if (hostname.includes("instagram.com")) {
    return {
      siteName: "Instagram",
      title: "Open Instagram link",
      description:
        "Tap to view this Instagram post. Instagram may hide preview details from external apps.",
    };
  }

  if (hostname.includes("tiktok.com")) {
    return {
      siteName: "TikTok",
      title: "Open TikTok link",
      description: "Tap to view this TikTok post in a new tab.",
    };
  }

  return {
    siteName: hostname || "Link",
    title: "Open shared link",
    description: "Tap to open this link in a new tab.",
  };
}

export default function PostContentWithPreview({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const urls = useMemo(() => {
    return extractUrls(text);
  }, [text]);

  const firstUrl = urls[0];
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const fallbackMeta = useMemo(
    () => (firstUrl ? getFallbackPreviewMeta(firstUrl) : null),
    [firstUrl],
  );
  const previewImages = useMemo(() => {
    const candidates = preview?.imageCandidates?.filter(Boolean) || [];
    const primary = preview?.image ? [preview.image] : [];
    return Array.from(new Set([...primary, ...candidates]));
  }, [preview]);
  const activePreviewImage = previewImages[Math.min(previewImageIndex, Math.max(previewImages.length - 1, 0))] || "";
  const proxiedPreviewImage = useMemo(() => {
    if (!activePreviewImage) return "";
    return `/api/link-preview/image?url=${encodeURIComponent(activePreviewImage)}`;
  }, [activePreviewImage]);

  useEffect(() => {
    let ignore = false;

    async function loadPreview() {
      if (!firstUrl || isImageUrl(firstUrl)) {
        setPreview(null);
        return;
      }

      try {
        console.log("[PostPreview] fetching preview for:", firstUrl);
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(firstUrl)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          console.warn("[PostPreview] API error", response.status, "for", firstUrl);
          if (!ignore) {
            setPreview({ url: firstUrl });
          }
          return;
        }
        const data = (await response.json()) as LinkPreviewData;
        console.log("[PostPreview] API response:", { url: data.url, title: data.title, description: data.description, image: data.image, candidates: data.imageCandidates?.length });
        if (!ignore) {
          setPreview(data?.url ? data : null);
        }
      } catch (err) {
        console.error("[PostPreview] fetch threw:", err);
        if (!ignore) {
          setPreview({ url: firstUrl });
        }
      }
    }

    loadPreview();
    return () => {
      ignore = true;
    };
  }, [firstUrl]);

  const parts = useMemo(() => {
    const result: Array<{ type: "text" | "link"; value: string }> = [];
    let lastIndex = 0;
    for (const match of text.matchAll(URL_REGEX)) {
      const originalUrl = match[0];
      const normalizedUrl = normalizeUrl(originalUrl);
      const index = match.index ?? 0;
      if (index > lastIndex) {
        result.push({ type: "text", value: text.slice(lastIndex, index) });
      }
      result.push({ type: "link", value: normalizedUrl });
      lastIndex = index + originalUrl.length;
    }
    if (lastIndex < text.length) {
      result.push({ type: "text", value: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  return (
    <div>
      <div className={className}>
        {parts.map((part, index) =>
          part.type === "link" ? (
            <a
              key={`${part.value}-${index}`}
              href={part.value}
              target="_blank"
              rel="noreferrer"
              className="text-pink-600 underline break-all hover:text-pink-700 dark:text-pink-300 dark:hover:text-pink-200"
            >
              {part.value}
            </a>
          ) : (
            <span key={`text-${index}`} className="whitespace-pre-line">
              {part.value}
            </span>
          ),
        )}
      </div>

      {firstUrl && isImageUrl(firstUrl) && (
        <a
          href={firstUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
        >
          <img
            src={firstUrl}
            alt="Shared link preview"
            className="w-full max-h-[28rem] object-contain bg-zinc-50 dark:bg-zinc-950"
          />
        </a>
      )}

      {firstUrl && !isImageUrl(firstUrl) && preview && (
        <a
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors"
        >
          {activePreviewImage ? (
            <img
              src={proxiedPreviewImage}
              alt={preview.title || "Link preview"}
              className="w-full max-h-[28rem] object-contain bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800"
              onError={() => {
                setPreviewImageIndex((currentIndex) => {
                  if (currentIndex + 1 < previewImages.length) {
                    return currentIndex + 1;
                  }
                  return currentIndex;
                });
              }}
            />
          ) : (
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-950/40 dark:to-rose-950/30 px-4 py-3">
              <div className="text-sm font-semibold text-pink-700 dark:text-pink-200">
                {fallbackMeta?.siteName || preview.siteName || "Shared Link"}
              </div>
            </div>
          )}
          <div className="p-4">
            <div className="text-xs uppercase tracking-wide text-pink-600 dark:text-pink-300 mb-1">
              {preview.siteName || fallbackMeta?.siteName || getHostname(preview.url)}
            </div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-50">
              {preview.title || fallbackMeta?.title || preview.url}
            </div>
            {(preview.description || fallbackMeta?.description) && (
              <div className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-3">
                {preview.description || fallbackMeta?.description}
              </div>
            )}
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 break-all">
              {preview.url}
            </div>
          </div>
        </a>
      )}
    </div>
  );
}
