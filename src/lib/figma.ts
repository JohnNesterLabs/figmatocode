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

export const fetchFigmaNodeSummary = async (figmaUrl: string, token: string): Promise<FigmaNodeSummary> => {
  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) {
    throw new Error("Invalid Figma URL. Use a figma.com/file/... or figma.com/design/... link.");
  }

  const headers = { "X-Figma-Token": token };
  let rootNode: FigmaNode | null = null;

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
    rootNode = (data?.nodes?.[nodeId]?.document as FigmaNode | undefined) ?? null;
  } else {
    const response = await fetch(`https://api.figma.com/v1/files/${parsed.fileKey}?depth=2`, { headers });
    const data = await response.json();
    if (!response.ok) {
      const message = typeof data?.message === "string" ? data.message : "Unable to fetch Figma file.";
      throw new Error(`Figma API error (${response.status}): ${message}`);
    }
    rootNode = (data?.document as FigmaNode | undefined) ?? null;
  }

  const selectedNode = pickPreferredNode(rootNode);
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
