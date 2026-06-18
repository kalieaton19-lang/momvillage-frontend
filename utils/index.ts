export * from "./getPostsCount";
export * from "./getVillageCount";
export const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

export const formatTimeAgo = (iso: string) => {
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) return "just now";

  const elapsedMs = Math.max(0, Date.now() - createdAt.getTime());
  const minutes = Math.floor(elapsedMs / (1000 * 60));

  if (minutes < 60) {
    const count = Math.max(1, minutes);
    return `${count} minute${count === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  if (days < 365) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};

export const formatFirstNameLastInitial = (name?: string | null, fallback = "Mom") => {
  const normalized = (name || "").trim();
  if (!normalized) return fallback;

  const emailLocalPart = normalized.includes("@")
    ? normalized.split("@")[0]
    : normalized;

  const cleaned = emailLocalPart
    .replace(/[._-]+/g, " ")
    .replace(/[0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return fallback;

  const firstName = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  if (words.length === 1) return firstName;

  const lastInitial = words[words.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

export const safeJsonParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const storagePublicUrl = (path?: string) => {
  if (!path) return undefined;
  return path;
};
