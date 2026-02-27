const FIGMA_TOKEN_KEY = "figma_token";
const GITHUB_TOKEN_KEY = "github_token";

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

export const getFigmaToken = (): string => getStorage()?.getItem(FIGMA_TOKEN_KEY) ?? "";

export const setFigmaToken = (token: string): void => {
  const storage = getStorage();
  if (!storage) return;
  if (token.trim()) {
    storage.setItem(FIGMA_TOKEN_KEY, token.trim());
    return;
  }
  storage.removeItem(FIGMA_TOKEN_KEY);
};

export const getGitHubToken = (): string => getStorage()?.getItem(GITHUB_TOKEN_KEY) ?? "";

export const setGitHubToken = (token: string): void => {
  const storage = getStorage();
  if (!storage) return;
  if (token.trim()) {
    storage.setItem(GITHUB_TOKEN_KEY, token.trim());
    return;
  }
  storage.removeItem(GITHUB_TOKEN_KEY);
};
