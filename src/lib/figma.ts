export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string | null;
}

export interface FigmaFileMeta {
  fileKey: string;
  nodeId: string | null;
  name: string;
  lastModified: string;
  version: string;
}

export interface FigmaNodeSummary {
  fileKey: string;
  nodeId: string | null;
  componentName: string;
  variantLabels: string[];
}

interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  children?: FigmaNode[];
}

export const parseFigmaUrl = (input: string): ParsedFigmaUrl | null => {
  try {
    const url = new URL(input.trim());
    if (!/figma\.com$/i.test(url.hostname) && !/\.figma\.com$/i.test(url.hostname)) {
      return null;
    }

    const match = url.pathname.match(/^\/(?:file|design)\/([a-zA-Z0-9]+)(?:\/|$)/);
    if (!match) return null;

    return {
      fileKey: match[1],
      nodeId: url.searchParams.get("node-id"),
    };
  } catch {
    return null;
  }
};

export const toComponentName = (raw: string): string => {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/[-_ ]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
  return cleaned || "MyComponent";
};

const normalizeNodeIdForApi = (nodeId: string): string => nodeId.replace(/-/g, ":");

const pickPreferredNode = (node: FigmaNode | undefined): FigmaNode | null => {
  if (!node) return null;

  const preferred = new Set(["COMPONENT_SET", "COMPONENT", "FRAME", "INSTANCE"]);
  const queue: FigmaNode[] = [node];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current.type && preferred.has(current.type) && current.name) {
      return current;
    }
    if (current.children?.length) {
      queue.push(...current.children);
    }
  }

  return node.name ? node : null;
};

const cleanVariantLabel = (raw: string): string => {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return "Default";
  const short = value.split("/").at(-1)?.trim() || value;
  return short || "Default";
};

const extractVariantLabels = (node: FigmaNode | null): string[] => {
  if (!node) return ["Default"];
  if (node.type === "COMPONENT_SET" && node.children?.length) {
    const labels = node.children.map((child) => cleanVariantLabel(child.name || "Default")).filter(Boolean);
    return Array.from(new Set(labels)).slice(0, 6);
  }
  return ["Default"];
};

export const extractComponentNameFromUrl = (url: string): string => {
  const parsed = parseFigmaUrl(url);
  if (!parsed) return "MyComponent";
  return toComponentName(parsed.fileKey);
};

export const fetchFigmaNodeData = async (figmaUrl: string, token: string): Promise<any> => {
  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) {
    throw new Error("Invalid Figma URL. Use a figma.com/file/... or figma.com/design/... link.");
  }

  const headers = { "X-Figma-Token": token };

  if (parsed.nodeId) {
    const nodeId = normalizeNodeIdForApi(parsed.nodeId);
    const response = await fetch(
      `https://api.figma.com/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
      { headers },
    );
    const data = await response.json();
    if (!response.ok) {
      const message = typeof data?.message === "string" ? data.message : "Unable to fetch Figma node.";
      throw new Error(`Figma API error (${response.status}): ${message}`);
    }
    return (data?.nodes?.[nodeId]?.document as FigmaNode | undefined) ?? null;
  } else {
    const response = await fetch(`https://api.figma.com/v1/files/${parsed.fileKey}?depth=2`, { headers });
    const data = await response.json();
    if (!response.ok) {
      const message = typeof data?.message === "string" ? data.message : "Unable to fetch Figma file.";
      throw new Error(`Figma API error (${response.status}): ${message}`);
    }
    return (data?.document as FigmaNode | undefined) ?? null;
  }
};

/** Build summary from an already-fetched root (avoids duplicate Figma API calls). */
export const buildFigmaNodeSummaryFromRoot = (
  figmaUrl: string,
  rootNode: FigmaNode | null | undefined
): FigmaNodeSummary => {
  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) {
    throw new Error("Invalid Figma URL.");
  }
  const selectedNode = pickPreferredNode(rootNode ?? undefined);
  if (!selectedNode?.name) {
    throw new Error("Could not find a usable component node from the selected Figma design.");
  }

  return {
    fileKey: parsed.fileKey,
    nodeId: parsed.nodeId,
    componentName: toComponentName(selectedNode.name),
    variantLabels: extractVariantLabels(selectedNode),
  };
};

export const fetchFigmaNodeSummary = async (figmaUrl: string, token: string): Promise<FigmaNodeSummary> => {
  const rootNode = await fetchFigmaNodeData(figmaUrl, token);
  return buildFigmaNodeSummaryFromRoot(figmaUrl, rootNode);
};

/** Keys that help codegen; everything else is dropped to save LLM context. */
const LLM_NODE_KEYS: readonly string[] = [
  "name",
  "type",
  "visible",
  "opacity",
  "layoutMode",
  "layoutWrap",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "itemSpacing",
  "counterAxisSpacing",
  "layoutAlign",
  "layoutGrow",
  "layoutPositioning",
  "fills",
  "strokes",
  "strokeWeight",
  "strokeAlign",
  "strokeCap",
  "strokeJoin",
  "cornerRadius",
  "rectangleCornerRadii",
  "absoluteBoundingBox",
  "constraints",
  "characters",
  "style",
  "effects",
  "background",
  "backgroundColor",
  "clipsContent",
  "componentId",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "children",
];

export interface SimplifyFigmaForLLMOptions {
  /** Max nesting depth (default 28). */
  maxDepth?: number;
  /** Max total nodes visited (default 900). */
  maxNodes?: number;
  /** Max characters per TEXT node (default 400). */
  maxTextChars?: number;
  /** Max children per parent (default 60). */
  maxChildrenPerNode?: number;
}

const defaultSimplifyOpts: Required<SimplifyFigmaForLLMOptions> = {
  maxDepth: 24,
  maxNodes: 650,
  maxTextChars: 350,
  maxChildrenPerNode: 50,
};

function clampFillOrStroke(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["type", "visible", "opacity", "blendMode", "color"]) {
    if (entry[k] !== undefined) out[k] = entry[k];
  }
  if (Array.isArray(entry.gradientStops) && entry.gradientStops.length) {
    out.gradientStops = (entry.gradientStops as unknown[]).slice(0, 12);
  }
  if (entry.imageRef !== undefined) out.imageRef = "[image]";
  return out;
}

function simplifyFigmaValue(key: string, val: unknown, depth: number, opts: Required<SimplifyFigmaForLLMOptions>, state: { nodes: number; truncated: boolean }): unknown {
  if (val === null || val === undefined) return val;

  if (key === "characters" && typeof val === "string") {
    if (val.length <= opts.maxTextChars) return val;
    return val.slice(0, opts.maxTextChars) + "…";
  }

  if ((key === "fills" || key === "strokes") && Array.isArray(val)) {
    return (val as unknown[]).slice(0, 24).map((item) =>
      item && typeof item === "object" ? clampFillOrStroke(item as Record<string, unknown>) : item
    );
  }

  if (key === "effects" && Array.isArray(val)) {
    return (val as unknown[]).slice(0, 8).map((e) =>
      e && typeof e === "object"
        ? Object.fromEntries(
            Object.entries(e as Record<string, unknown>).filter(([k]) =>
              ["type", "visible", "radius", "color", "spread", "offset", "blur", "opacity"].includes(k)
            )
          )
        : e
    );
  }

  if (key === "style" && val && typeof val === "object") {
    const s = val as Record<string, unknown>;
    const keep = [
      "fontFamily",
      "fontPostScriptName",
      "fontWeight",
      "fontSize",
      "lineHeightPx",
      "letterSpacing",
      "textAlignHorizontal",
      "textAlignVertical",
      "textAutoResize",
      "textCase",
      "fills",
    ];
    const sub: Record<string, unknown> = {};
    for (const k of keep) {
      if (s[k] !== undefined) {
        sub[k] = simplifyFigmaValue(k, s[k], depth, opts, state);
      }
    }
    return sub;
  }

  if (key === "absoluteBoundingBox" && val && typeof val === "object") {
    const b = val as Record<string, unknown>;
    return {
      width: b.width,
      height: b.height,
    };
  }

  return val;
}

function simplifyFigmaNodeInner(
  node: unknown,
  depth: number,
  opts: Required<SimplifyFigmaForLLMOptions>,
  state: { nodes: number; truncated: boolean }
): unknown {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return node;
  }

  if (state.nodes >= opts.maxNodes) {
    state.truncated = true;
    return { type: "OMITTED", reason: "context budget: node limit" };
  }

  const n = node as Record<string, unknown>;

  if (depth > opts.maxDepth) {
    state.truncated = true;
    return {
      type: n.type,
      name: n.name,
      _truncated: true,
      _reason: "max depth",
    };
  }

  state.nodes += 1;
  const out: Record<string, unknown> = {};

  for (const key of LLM_NODE_KEYS) {
    if (key === "children") continue;
    if (!(key in n) || n[key] === undefined) continue;
    out[key] = simplifyFigmaValue(key, n[key], depth, opts, state);
  }

  const rawChildren = n.children;
  if (Array.isArray(rawChildren) && rawChildren.length > 0) {
    const cap = opts.maxChildrenPerNode;
    const slice = rawChildren.slice(0, cap);
    out.children = slice.map((child) => simplifyFigmaNodeInner(child, depth + 1, opts, state));
    if (rawChildren.length > cap) {
      state.truncated = true;
      (out.children as unknown[]).push({
        type: "TRUNCATED",
        omittedSiblingCount: rawChildren.length - cap,
      });
    }
  }

  return out;
}

/**
 * Shrinks Figma REST JSON so it fits LLM context (e.g. DeepSeek ~131k tokens).
 * Drops irrelevant fields and caps depth / node count / text length.
 */
export function simplifyFigmaForLLM(node: unknown, options: SimplifyFigmaForLLMOptions = {}): unknown {
  const opts = { ...defaultSimplifyOpts, ...options };
  const state = { nodes: 0, truncated: false };
  const simplified = simplifyFigmaNodeInner(node, 0, opts, state);
  if (state.truncated && simplified && typeof simplified === "object" && !Array.isArray(simplified)) {
    return {
      _figmaNote: "Tree trimmed for model context. Prefer a Figma URL with ?node-id=… on the exact frame or component for best detail.",
      ...simplified,
    };
  }
  return simplified;
}

/** Preferred component/frame for codegen (same heuristic as summary). */
export function getPreferredFigmaNode(root: FigmaNode | null | undefined): FigmaNode | null {
  return pickPreferredNode(root ?? undefined);
}

export const fetchFigmaFileMeta = async (figmaUrl: string, token: string): Promise<FigmaFileMeta> => {
  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) {
    throw new Error("Invalid Figma URL. Use a figma.com/file/... or figma.com/design/... link.");
  }

  const response = await fetch(`https://api.figma.com/v1/files/${parsed.fileKey}`, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Unable to fetch Figma file.";
    throw new Error(`Figma API error (${response.status}): ${message}`);
  }

  return {
    fileKey: parsed.fileKey,
    nodeId: parsed.nodeId,
    name: typeof data?.name === "string" ? data.name : parsed.fileKey,
    lastModified: typeof data?.lastModified === "string" ? data.lastModified : "",
    version: typeof data?.version === "string" ? data.version : "",
  };
};
