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
