const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export const normalizeRepoDirectory = (input: string): string | null => {
  const normalized = input.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\/+/, "");
  if (!normalized) return null;
  if (normalized.startsWith("/") || normalized.includes("..") || normalized.includes("\0")) {
    return null;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => !SAFE_SEGMENT.test(segment))) {
    return null;
  }

  return segments.join("/");
};

export const buildRepoPath = (directory: string, fileName: string): string | null => {
  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    return null;
  }
  if (!SAFE_SEGMENT.test(fileName)) return null;

  const safeDir = normalizeRepoDirectory(directory);
  if (!safeDir) return null;

  return `${safeDir}/${fileName}`;
};
