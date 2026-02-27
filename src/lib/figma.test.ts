import { describe, expect, it } from "vitest";
import { parseFigmaUrl, toComponentName } from "./figma";

describe("parseFigmaUrl", () => {
  it("parses file links with node ids", () => {
    const parsed = parseFigmaUrl("https://www.figma.com/file/AbCdEf123456/My-File?node-id=1-2");
    expect(parsed).toEqual({
      fileKey: "AbCdEf123456",
      nodeId: "1-2",
    });
  });

  it("parses design links without node ids", () => {
    const parsed = parseFigmaUrl("https://www.figma.com/design/xyz987654321/Design-System");
    expect(parsed).toEqual({
      fileKey: "xyz987654321",
      nodeId: null,
    });
  });

  it("rejects non-figma links", () => {
    expect(parseFigmaUrl("https://example.com/file/abc")).toBeNull();
  });
});

describe("toComponentName", () => {
  it("normalizes names into a component identifier", () => {
    expect(toComponentName("primary button / default")).toBe("PrimaryButtonDefault");
  });
});
