import { describe, expect, it } from "vitest";
import { buildRepoPath, normalizeRepoDirectory } from "./repoPath";

describe("normalizeRepoDirectory", () => {
  it("normalizes standard relative paths", () => {
    expect(normalizeRepoDirectory("./src//components")).toBe("src/components");
  });

  it("rejects unsafe paths", () => {
    expect(normalizeRepoDirectory("../src/components")).toBeNull();
    expect(normalizeRepoDirectory("/src/components")).toBeNull();
  });
});

describe("buildRepoPath", () => {
  it("creates safe commit paths", () => {
    expect(buildRepoPath("src/components", "Button.tsx")).toBe("src/components/Button.tsx");
  });

  it("rejects invalid file names", () => {
    expect(buildRepoPath("src/components", "../Button.tsx")).toBeNull();
    expect(buildRepoPath("src/components", "nested/Button.tsx")).toBeNull();
  });
});
