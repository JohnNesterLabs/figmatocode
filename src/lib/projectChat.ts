import { getDeepSeekToken } from "./tokenStorage";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  filesChanged?: string[];
}

export interface ProjectChatResult {
  message: string;
  fileUpdates: Record<string, string>;
}

/**
 * Chat with AI to modify the project. Sends user instruction + project files,
 * returns AI response and file updates to apply.
 */
export async function chatWithProject(
  userMessage: string,
  files: { name: string; content: string }[],
  componentName: string | null
): Promise<ProjectChatResult> {
  const token = getDeepSeekToken().trim();
  if (!token) throw new Error("DeepSeek API Key is missing. Add it in Profile/Settings.");

  const primaryFile = componentName
    ? files.find((f) => f.name.includes(componentName) && (f.name.endsWith(".tsx") || f.name.endsWith(".jsx")))
    : files.find((f) => f.name.endsWith(".tsx") || f.name.endsWith(".jsx"));
  const appFile = files.find((f) => f.name === "src/App.tsx");

  const fileContext = files
    .filter((f) => f.name.endsWith(".tsx") || f.name.endsWith(".jsx") || f.name.endsWith(".css"))
    .slice(0, 6)
    .map((f) => `### ${f.name}\n\`\`\`\n${f.content.slice(0, 3000)}${f.content.length > 3000 ? "\n... (truncated)" : ""}\n\`\`\``)
    .join("\n\n");

  const systemPrompt = `You are an expert React/TypeScript developer. The user is editing a project and will give you instructions.

You MUST respond in this exact format:
1. First, a brief explanation (1-2 sentences) of what you changed.
2. Then, one or more blocks in this format:
FILE: <exact file path>
\`\`\`tsx
<full file content>
\`\`\`

Rules:
- Return ONLY the files you modified. Use the exact paths (e.g. src/components/Button.tsx, src/App.tsx).
- Preserve data-ve-id attributes if present.
- Use Tailwind CSS for styling.
- Return valid, complete file contents.`;

  const userPrompt = `CURRENT PROJECT FILES:
${fileContext}

USER INSTRUCTION: ${userMessage}

Respond with your explanation, then FILE: blocks for each modified file.`;

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `DeepSeek API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let text = data.choices?.[0]?.message?.content ?? "";

  const fileUpdates: Record<string, string> = {};
  const fileBlockRegex = /FILE:\s*([^\s\n]+)\s*```(?:tsx|ts|jsx|js|css)?\n([\s\S]*?)```/gi;
  let match;
  while ((match = fileBlockRegex.exec(text)) !== null) {
    const path = match[1].trim();
    const content = match[2].trim();
    if (path && content) fileUpdates[path] = content;
  }

  const explanation = text
    .replace(/FILE:[\s\S]*/i, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim()
    .slice(0, 500);

  return {
    message: explanation || "Changes applied.",
    fileUpdates,
  };
}
