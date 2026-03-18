import { getDeepSeekToken } from "./tokenStorage";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT = `
You are an expert Frontend Engineer. You specialize in React, TypeScript, and Tailwind CSS.
Your goal is to convert Figma design data into high-quality, production-ready React components.

Guidelines:
1. Use React 18 with functional components and hooks.
2. Use Tailwind CSS for all styling.
3. Ensure the code is clean, accessible, and responsive.
4. Return ONLY the code for the main component. Do not include markdown block markers like \`\`\`tsx unless requested.
5. Use standard Lucide icons if you need icons.

TypeScript rules (must follow exactly):
- Use "type" for type aliases: e.g. \`type MyType = 'a' | 'b';\` not \`MyType = 'a' | 'b';\`
- Use "interface" for object shapes: e.g. \`interface MyProps { ... }\` — spell "interface" correctly, never "face" or similar.
- File must be valid .tsx: use proper imports like \`import React from "react";\` and type annotations only where valid.
`;

export const generateComponentWithDeepSeek = async (
  componentName: string,
  figmaData: unknown
): Promise<string> => {
  const token = getDeepSeekToken().trim();
  if (!token) throw new Error("DeepSeek API Key is missing. Please add it in Settings.");

  const prompt = `
Generate a React component named "${componentName}" based on this Figma JSON data:
${JSON.stringify(figmaData, null, 2)}

Requirements:
- Target: React 18 + TypeScript + Tailwind CSS. Output must be valid TypeScript that compiles (use \`type\` and \`interface\` keywords correctly).
- Include variants if applicable based on the Figma properties.
- Make it look premium and modern.
`;

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
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

  text = text.replace(/```tsx\n?/, "").replace(/```\n?/, "").trim();
  return text;
};

/**
 * Edit a specific element in a React component using AI.
 * Returns the complete updated component code.
 */
export const editElementWithAI = async (
  prompt: string,
  elementInfo: { selector: string; tagName: string; innerHTML: string; computedStyles: Record<string, string> },
  componentCode: string
): Promise<string> => {
  const token = getDeepSeekToken().trim();
  if (!token) throw new Error("DeepSeek API Key is missing. Please add it in Settings.");

  const userPrompt = `You are editing a specific element in a React component.

ELEMENT INFO:
- Tag: ${elementInfo.tagName}
- CSS Selector: ${elementInfo.selector}
- Current HTML: ${elementInfo.innerHTML.slice(0, 500)}
- Current Styles: ${JSON.stringify(elementInfo.computedStyles, null, 2)}

USER INSTRUCTION: "${prompt}"

CURRENT COMPONENT CODE:
\`\`\`tsx
${componentCode}
\`\`\`

Return the COMPLETE updated component code with the requested change applied to the described element.
Rules:
- Return ONLY the raw TypeScript/React code. No markdown fences, no explanation.
- Keep all existing functionality intact.
- Apply the change only to the element described above.
- Use Tailwind CSS for styling if the code already uses Tailwind; otherwise use inline styles.`;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are an expert React/TypeScript developer. You modify React components precisely as instructed. Return ONLY raw code, no markdown." },
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
  text = text.replace(/```(?:tsx?|jsx?|typescript|javascript)?\n?/, "").replace(/```\n?/, "").trim();
  return text;
};
