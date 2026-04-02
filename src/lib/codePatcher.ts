/**
 * codePatcher.ts
 *
 * Utilities to apply visual edits back to React component source code.
 * Uses string/regex-based patching (pragmatic, no AST dependency).
 *
 * Strategy per property type:
 * - If file uses Tailwind: map CSS props → Tailwind classes, update className string.
 * - If file uses inline styles: update style={{ }} object.
 * - Falls back to appending a <style> block at the bottom of the file.
 */

// ─── Tailwind class maps ──────────────────────────────────────────────────────

const TAILWIND_COLOR_MAP: Record<string, string> = {
  'rgb(239, 68, 68)': 'red-500',
  'rgb(220, 38, 38)': 'red-600',
  'rgb(34, 197, 94)': 'green-500',
  'rgb(59, 130, 246)': 'blue-500',
  'rgb(99, 102, 241)': 'indigo-500',
  'rgb(168, 85, 247)': 'purple-500',
  'rgb(234, 179, 8)': 'yellow-500',
  'rgb(249, 115, 22)': 'orange-500',
  'rgb(255, 255, 255)': 'white',
  'rgb(0, 0, 0)': 'black',
  'rgb(15, 23, 42)': 'slate-900',
  'rgb(30, 41, 59)': 'slate-800',
  'rgb(30, 30, 30)': 'zinc-900',
  'rgb(9, 9, 11)': 'zinc-950',
  'rgba(0, 0, 0, 0)': 'transparent',
};

/** Convert a hex color (#rrggbb or #rgb) to rgb() string for lookup */
function hexToRgb(hex: string): string | null {
  const full = hex.length === 4
    ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbToHex(rgb: string): string | null {
  const m = rgb.trim().match(/^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if ([r, g, b].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeColorForArbitrary(color: string): { kind: "hex"; value: string } | { kind: "raw"; value: string } | null {
  const norm = (color || "").trim();
  if (!norm) return null;
  if (norm.startsWith("#")) {
    const rgb = hexToRgb(norm);
    const hex = rgb ? rgbToHex(rgb) : null;
    return hex ? { kind: "hex", value: hex } : null;
  }
  if (/^rgb\(/i.test(norm)) {
    const hex = rgbToHex(norm);
    return hex ? { kind: "hex", value: hex } : { kind: "raw", value: norm };
  }
  if (/^rgba\(/i.test(norm)) {
    // Keep rgba as raw; Tailwind arbitrary values can accept it inside brackets.
    return { kind: "raw", value: norm };
  }
  if (norm === "transparent") return { kind: "raw", value: "transparent" };
  return null;
}

/** Convert any color string to closest Tailwind class suffix, or null */
function colorToTailwind(color: string): string | null {
  const norm = color.trim();
  // Direct lookup
  if (TAILWIND_COLOR_MAP[norm]) return TAILWIND_COLOR_MAP[norm];
  // Try hex conversion
  if (norm.startsWith('#')) {
    const rgb = hexToRgb(norm);
    if (rgb && TAILWIND_COLOR_MAP[rgb]) return TAILWIND_COLOR_MAP[rgb];
  }
  return null;
}

// ─── Detection helpers ────────────────────────────────────────────────────────

/** Check if a TSX file predominantly uses Tailwind classes */
export function usesTailwind(code: string): boolean {
  return code.includes('className=') && (
    /className=["'`][^"'`]*(?:px-|py-|p-|m-|text-|bg-|rounded|flex|grid|border|font-|w-|h-)[^"'`]*["'`]/.test(code)
  );
}

/** Check if a TSX file uses inline style={{ }} objects */
export function usesInlineStyles(code: string): boolean {
  return /style=\{\{/.test(code);
}

function removeLegacyVisualEditInjections(code: string): string {
  // Remove the older runtime injection block we previously appended to TS/TSX files.
  // We key off the comment + style id to be reasonably precise.
  const rx = /\n\/\*\s*Visual Edit override\s*\*\/\nif\s*\(typeof\s+document\s*!==\s*"undefined"\)\s*\{\n[\s\S]*?__ve_style_overrides__[\s\S]*?\n\}\n?/g;
  return code.replace(rx, "\n");
}

// ─── CSS property ↔ Tailwind prefix ──────────────────────────────────────────

const PROP_TO_TW_PREFIX: Record<string, string> = {
  backgroundColor: 'bg',
  color: 'text',
  fontSize: 'text',
  fontWeight: 'font',
  borderRadius: 'rounded',
  paddingTop: 'pt',
  paddingRight: 'pr',
  paddingBottom: 'pb',
  paddingLeft: 'pl',
  padding: 'p',
  marginTop: 'mt',
  marginRight: 'mr',
  marginBottom: 'mb',
  marginLeft: 'ml',
  margin: 'm',
  borderColor: 'border',
  opacity: 'opacity',
  display: 'flex', // special cased
};

/** Map a px value like "16px" to Tailwind spacing unit (4px = 1 unit) */
function pxToTailwindUnit(px: string): string | null {
  const num = parseFloat(px);
  if (isNaN(num)) return null;
  const unit = num / 4;
  // Common spacings: 0,1,2,3,4,5,6,8,10,12,16,20,24,32,40,48,64
  const valid = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
  if (valid.includes(unit)) return String(unit);
  return null;
}

/** Map fontSize px to Tailwind text size */
function fontSizeToTailwind(px: string): string | null {
  const num = parseFloat(px);
  if (isNaN(num)) return null;
  if (num <= 12) return 'xs';
  if (num <= 14) return 'sm';
  if (num <= 16) return 'base';
  if (num <= 18) return 'lg';
  if (num <= 20) return 'xl';
  if (num <= 24) return '2xl';
  if (num <= 30) return '3xl';
  if (num <= 36) return '4xl';
  if (num <= 48) return '6xl';
  return '8xl';
}

/** Map fontWeight to Tailwind font weight */
function fontWeightToTailwind(weight: string): string | null {
  const num = parseInt(weight);
  const map: Record<number, string> = {
    100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal',
    500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black',
  };
  return map[num] || null;
}

/** Map borderRadius to Tailwind rounded */
function borderRadiusToTailwind(px: string): string | null {
  const num = parseFloat(px);
  if (isNaN(num)) return null;
  if (num === 0) return 'none';
  if (num <= 2) return 'sm';
  if (num <= 4) return '';       // just 'rounded'
  if (num <= 6) return 'md';
  if (num <= 8) return 'lg';
  if (num <= 12) return 'xl';
  if (num <= 16) return '2xl';
  if (num <= 24) return '3xl';
  return 'full';
}

/** Get the Tailwind class string for a given CSS prop + value, or null */
function cssToTailwindClass(prop: string, value: string): string | null {
  switch (prop) {
    case 'backgroundColor': {
      const tw = colorToTailwind(value);
      if (tw) return `bg-${tw}`;
      const norm = normalizeColorForArbitrary(value);
      if (!norm) return null;
      return norm.kind === "hex" ? `bg-[${norm.value}]` : `bg-[${norm.value}]`;
    }
    case 'color': {
      const tw = colorToTailwind(value);
      if (tw) return `text-${tw}`;
      const norm = normalizeColorForArbitrary(value);
      if (!norm) return null;
      return norm.kind === "hex" ? `text-[${norm.value}]` : `text-[${norm.value}]`;
    }
    case 'borderColor': {
      const tw = colorToTailwind(value);
      if (tw) return `border-${tw}`;
      const norm = normalizeColorForArbitrary(value);
      if (!norm) return null;
      return norm.kind === "hex" ? `border-[${norm.value}]` : `border-[${norm.value}]`;
    }
    case 'fontSize': {
      const tw = fontSizeToTailwind(value);
      return tw ? `text-${tw}` : null;
    }
    case 'fontWeight': {
      const tw = fontWeightToTailwind(value);
      return tw ? `font-${tw}` : null;
    }
    case 'borderRadius': {
      const tw = borderRadiusToTailwind(value);
      if (tw === '') return 'rounded';
      if (tw) return `rounded-${tw}`;
      // Arbitrary border radius
      const v = (value || "").trim();
      if (!v) return null;
      return `rounded-[${v}]`;
    }
    case 'padding': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `p-${tw}`;
      const v = (value || "").trim();
      return v ? `p-[${v}]` : null;
    }
    case 'paddingTop': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `pt-${tw}`;
      const v = (value || "").trim();
      return v ? `pt-[${v}]` : null;
    }
    case 'paddingRight': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `pr-${tw}`;
      const v = (value || "").trim();
      return v ? `pr-[${v}]` : null;
    }
    case 'paddingBottom': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `pb-${tw}`;
      const v = (value || "").trim();
      return v ? `pb-[${v}]` : null;
    }
    case 'paddingLeft': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `pl-${tw}`;
      const v = (value || "").trim();
      return v ? `pl-[${v}]` : null;
    }
    case 'margin': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `m-${tw}`;
      const v = (value || "").trim();
      return v ? `m-[${v}]` : null;
    }
    case 'marginTop': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `mt-${tw}`;
      const v = (value || "").trim();
      return v ? `mt-[${v}]` : null;
    }
    case 'marginRight': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `mr-${tw}`;
      const v = (value || "").trim();
      return v ? `mr-[${v}]` : null;
    }
    case 'marginBottom': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `mb-${tw}`;
      const v = (value || "").trim();
      return v ? `mb-[${v}]` : null;
    }
    case 'marginLeft': {
      const tw = pxToTailwindUnit(value);
      if (tw) return `ml-${tw}`;
      const v = (value || "").trim();
      return v ? `ml-[${v}]` : null;
    }
    case 'display': {
      if (value === 'flex') return 'flex';
      if (value === 'grid') return 'grid';
      if (value === 'block') return 'block';
      if (value === 'inline') return 'inline';
      if (value === 'inline-flex') return 'inline-flex';
      if (value === 'hidden' || value === 'none') return 'hidden';
      return null;
    }
    default:
      return null;
  }
}

// ─── Tailwind class replacement ───────────────────────────────────────────────

/** Tailwind class prefixes that correspond to a CSS property */
const TW_CLASS_PATTERN_FOR_PROP: Record<string, RegExp> = {
  backgroundColor: /\bbg-(?:\[[^\]]+\]|[\w/]+)/g,
  // Avoid clobbering text size utilities; also support arbitrary values (text-[#...], text-[rgba(...)])
  color: /\btext-(?:\[[^\]]+\]|(?!sm\b|xs\b|base\b|lg\b|xl\b|2xl\b|3xl\b|4xl\b|5xl\b|6xl\b|7xl\b|8xl\b|9xl\b)[\w/]+)/g,
  fontSize: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
  fontWeight: /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g,
  borderRadius: /\brounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?\b/g,
  padding: /\bp-(?:\d+|\[[^\]]+\])\b/g,
  paddingTop: /\bpt-(?:\d+|\[[^\]]+\])\b/g,
  paddingRight: /\bpr-(?:\d+|\[[^\]]+\])\b/g,
  paddingBottom: /\bpb-(?:\d+|\[[^\]]+\])\b/g,
  paddingLeft: /\bpl-(?:\d+|\[[^\]]+\])\b/g,
  margin: /\bm-(?:\d+|\[[^\]]+\])\b/g,
  marginTop: /\bmt-(?:\d+|\[[^\]]+\])\b/g,
  marginRight: /\bmr-(?:\d+|\[[^\]]+\])\b/g,
  marginBottom: /\bmb-(?:\d+|\[[^\]]+\])\b/g,
  marginLeft: /\bml-(?:\d+|\[[^\]]+\])\b/g,
  borderColor: /\bborder-(?:\[[^\]]+\]|[\w/]+)/g,
  display: /\b(?:flex|grid|block|inline|inline-flex|hidden)\b/g,
};

/**
 * Patch a Tailwind className string to update a CSS property.
 * Replaces existing Tailwind class for the property or appends the new class.
 */
function patchTailwindClass(classStr: string, prop: string, newTwClass: string): string {
  const pattern = TW_CLASS_PATTERN_FOR_PROP[prop];
  if (pattern) {
    pattern.lastIndex = 0;
    if (pattern.test(classStr)) {
      pattern.lastIndex = 0;
      return classStr.replace(pattern, newTwClass);
    }
  }
  // Append if not found
  return classStr + ' ' + newTwClass;
}

function findMatchingBrace(code: string, openBraceIndex: number): number | null {
  // `openBraceIndex` points to the "{"
  let i = openBraceIndex;
  if (code[i] !== "{") return null;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let templateExprDepth = 0;

  for (; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : "";

    // Handle string/template boundaries (skip escaped quotes)
    if (!inDouble && !inTemplate && ch === "'" && prev !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === `"` && prev !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`" && prev !== "\\") {
      inTemplate = !inTemplate;
      continue;
    }

    // If inside normal quotes, ignore all braces
    if (inSingle || inDouble) continue;

    // Inside template literal: braces only matter when in ${ ... }
    if (inTemplate) {
      const next = i + 1 < code.length ? code[i + 1] : "";
      if (ch === "$" && next === "{") {
        templateExprDepth++;
        i++; // skip "{"
        continue;
      }
      if (templateExprDepth > 0) {
        if (ch === "{") templateExprDepth++;
        else if (ch === "}") templateExprDepth--;
      }
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return null;
}

function patchTailwindInsideExpression(expr: string, prop: string, newTwClass: string): { expr: string; changed: boolean } {
  // Find patchable string literals inside expression.
  // We avoid template literals that contain ${...}.
  const literalMatches: Array<{ start: number; end: number; quote: string; content: string }> = [];

  const rx = /(["'`])([\s\S]*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(expr))) {
    const quote = m[1];
    const content = m[2];
    if (quote === "`" && content.includes("${")) continue;
    literalMatches.push({ start: m.index, end: m.index + m[0].length, quote, content });
  }

  if (literalMatches.length === 0) return { expr, changed: false };

  const pattern = TW_CLASS_PATTERN_FOR_PROP[prop];
  const idxWithProp =
    pattern
      ? literalMatches.findIndex((lm) => {
          pattern.lastIndex = 0;
          return pattern.test(lm.content);
        })
      : -1;

  const targetIdx = idxWithProp >= 0 ? idxWithProp : 0;
  const target = literalMatches[targetIdx];
  const patchedClassStr = patchTailwindClass(target.content, prop, newTwClass);

  if (patchedClassStr === target.content) return { expr, changed: false };
  const replacement = `${target.quote}${patchedClassStr}${target.quote}`;
  const nextExpr = expr.slice(0, target.start) + replacement + expr.slice(target.end);
  return { expr: nextExpr, changed: true };
}

function patchTailwindClassNameExpression(
  code: string,
  prop: string,
  newTwClass: string,
  opts: PatchOptions
): { code: string; changed: boolean } {
  const { tagName = "", occurrence = 1 } = opts;
  const tag = tagName || "[a-zA-Z][a-zA-Z0-9.]*";

  // Match `<tag ... className={`
  const re = new RegExp(`(<${tag}[^>]*?\\s)className=\\{`, "gs");
  let count = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(code))) {
    // `re.lastIndex` is after `className={` (because `{` is consumed)
    count++;
    if (count !== occurrence) continue;

    const openBraceIndex = re.lastIndex - 1; // points at "{"
    const closeBraceIndex = findMatchingBrace(code, openBraceIndex);
    if (closeBraceIndex == null) return { code, changed: false };

    const expr = code.slice(openBraceIndex + 1, closeBraceIndex);
    const { expr: patchedExpr, changed } = patchTailwindInsideExpression(expr, prop, newTwClass);
    if (!changed) return { code, changed: false };

    const patchedCode =
      code.slice(0, openBraceIndex + 1) + patchedExpr + code.slice(closeBraceIndex);
    return { code: patchedCode, changed: true };
  }

  return { code, changed: false };
}

// ─── Main patch functions ─────────────────────────────────────────────────────

export interface PatchOptions {
  /** The element selector path (used as hint for which className to target) */
  selector?: string;
  /** Target only elements matching this tag name (e.g. "button", "div") */
  tagName?: string;
  /** Attempt to match the nth occurrence of the className match (1-indexed). Default: 1 */
  occurrence?: number;
}

/**
 * Patch a component's style for a given CSS property + value.
 * Tries Tailwind patch first, then inline style, then appends CSS override.
 */
export function patchComponentStyle(
  code: string,
  prop: string,
  value: string,
  opts: PatchOptions = {}
): string {
  const { tagName = '', occurrence = 1 } = opts;

  // Always strip any legacy injected overrides before patching.
  // If we can apply a real Tailwind/inline edit, this keeps files clean.
  const baseCode = removeLegacyVisualEditInjections(code);

  const twClass = cssToTailwindClass(prop, value);

  // ── Strategy 1: Tailwind className replacement ──
  if (twClass && usesTailwind(baseCode)) {
    // Match className="..." or className={`...`} — prioritize tag if given
    const tag = tagName || '[a-zA-Z][a-zA-Z0-9.]*';
    // Match opening tags with className
    const classNameRegex = new RegExp(
      `(<${tag}[^>]*?\\s)className=(?:"([^"]*?)"|'([^']*?)'|\`([^\`]*?)\`)`,
      'gs'
    );
    let count = 0;
    let didChange = false;
    const patchedCode = baseCode.replace(classNameRegex, (match, pre, dq, sq, bt) => {
      count++;
      if (count !== occurrence) return match;
      const existing = dq ?? sq ?? bt ?? '';
      const patched = patchTailwindClass(existing, prop, twClass);
      const quote = dq !== undefined ? '"' : sq !== undefined ? "'" : '`';
      didChange = true;
      return `${pre}className=${quote}${patched}${quote}`;
    });
    // If we couldn't patch (e.g. className is an expression like {cn(...)}),
    // fall through to inline-style / CSS override strategies instead of returning a no-op.
    if (didChange) return patchedCode;

    // Try patching className={...} expressions (cn/clsx, arrays, ternaries, etc.)
    const exprPatched = patchTailwindClassNameExpression(baseCode, prop, twClass, opts);
    if (exprPatched.changed) return exprPatched.code;
  }

  // ── Strategy 2: Inline style={{ }} ──
  if (usesInlineStyles(baseCode)) {
    // Find style={{ prop: oldValue }} and replace the value
    const camelProp = prop; // already camelCase
    // Match: propName: "value" or propName: value or propName: 'value'
    const inlineStyleRegex = new RegExp(
      `(style=\\{\\{[^}]*?)\\b(${camelProp})\\s*:\\s*(?:"[^"]*"|'[^']*'|[^,}]+)`,
      's'
    );
    if (inlineStyleRegex.test(baseCode)) {
      return baseCode.replace(inlineStyleRegex, (match, prefix) => {
        return `${prefix}${camelProp}: "${value}"`;
      });
    }
    // Append property to first style={{ ... }} found
    const appendRegex = /(style=\{\{)([^}]*?)(\}\})/s;
    return baseCode.replace(appendRegex, (match, open, body, close) => {
      const sep = body.trim().endsWith(',') || body.trim() === '' ? ' ' : ', ';
      return `${open}${body}${sep}${camelProp}: "${value}" ${close}`;
    });
  }

  // ── Strategy 3: Append overriding CSS at the bottom ──
  const cssPropName = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  const selector = opts.selector || (tagName || '*');
  const cssRule = `${selector} { ${cssPropName}: ${value}; }`;

  // IMPORTANT: Do not inject TS snippets into component files.
  // Return unchanged so the caller can apply the override in a dedicated CSS file instead.
  return baseCode;
}

/**
 * Patch the text content of an element.
 * Finds JSX text content between opening and closing tags.
 */
export function patchComponentText(
  code: string,
  tagName: string,
  newText: string,
  opts: PatchOptions = {}
): string {
  const { occurrence = 1 } = opts;
  const rawTag = (tagName || '').trim().toLowerCase();

  // Special-case form controls where "text" is usually an attribute, not a text node.
  if (rawTag === 'input' || rawTag === 'textarea') {
    const attrToPatch = rawTag === 'input' ? 'placeholder' : 'placeholder';
    const openTagRegex = new RegExp(`(<${rawTag}\\b[^>]*)(\\/?>)`, 'gis');
    let count = 0;
    let didChange = false;

    const patched = code.replace(openTagRegex, (match, beforeClose, close) => {
      count++;
      if (count !== occurrence) return match;

      const hasAttr = new RegExp(`\\b${attrToPatch}\\s*=`, 'i').test(beforeClose);
      didChange = true;

      if (hasAttr) {
        // Replace placeholder="...", placeholder='...', placeholder={"..."} or placeholder={`...`}
        const attrRegex = new RegExp(
          `\\b${attrToPatch}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{\\s*"[^"]*"\\s*\\}|\\{\\s*'[^']*'\\s*\\}|\\{\\s*\\\`[^\\\`]*\\\`\\s*\\})`,
          'i'
        );
        return `${beforeClose.replace(attrRegex, `${attrToPatch}="${newText}"`)}${close}`;
      }

      // Insert placeholder before tag close
      return `${beforeClose} ${attrToPatch}="${newText}"${close}`;
    });

    return didChange ? patched : code;
  }

  const tag = rawTag || 'span|p|h[1-6]|button|div|label|a';
  // Match: <tagName ...>text content</tagName> (simple, non-nested)
  const textRegex = new RegExp(
    `(<(?:${tag})(?:\\s[^>]*)?>)([^<{]*?)(<\\/(?:${tag})>)`,
    'gs'
  );
  let count = 0;
  return code.replace(textRegex, (match, open, content, close) => {
    // Only replace pure text (no JSX expressions)
    if (content.includes('{') || content.includes('}')) return match;
    count++;
    if (count !== occurrence) return match;
    return `${open}${newText}${close}`;
  });
}

/**
 * Fallback text patching for cases where "text" is not a JSX text node:
 * - strings in props/objects: message: "..."
 * - string literals in JSX props: placeholder="..."
 *
 * Replaces the first (or nth) string literal that contains `oldText`.
 * This is intentionally heuristic (no AST).
 */
export function patchTextInStringLiterals(
  code: string,
  oldText: string,
  newText: string,
  opts: PatchOptions = {}
): string {
  const needle = (oldText ?? "").trim();
  if (!needle) return code;
  const { occurrence = 1 } = opts;

  // Match JS/TS string literals: "...", '...', or `...` (very permissive; ignores correctness of escapes).
  const strRegex = /(["'`])([\s\S]*?)\1/g;
  let count = 0;
  let didChange = false;

  const patched = code.replace(strRegex, (match, quote: string, content: string) => {
    if (!content.includes(needle)) return match;
    count++;
    if (count !== occurrence) return match;

    // Avoid stomping template literals with expressions; still allow plain `...`.
    if (quote === "`" && content.includes("${")) return match;

    didChange = true;
    const replaced = content.replace(needle, newText);
    return `${quote}${replaced}${quote}`;
  });

  return didChange ? patched : code;
}

/**
 * Apply an AI-generated full file replacement.
 * The AI returns the complete updated component code.
 */
export function applyAIEdit(newCode: string): string {
  // Strip any accidental markdown code fences
  return newCode
    .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

/**
 * Patch multiple style properties at once.
 */
export function patchMultipleStyles(
  code: string,
  edits: Array<{ prop: string; value: string }>,
  opts: PatchOptions = {}
): string {
  let result = code;
  for (const { prop, value } of edits) {
    if (value !== undefined && value !== null && value !== '') {
      result = patchComponentStyle(result, prop, value, opts);
    }
  }
  return result;
}

export function patchCssFileOverride(
  cssCode: string,
  selector: string,
  prop: string,
  value: string
): string {
  const cssPropName = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
  const rule = `${selector} { ${cssPropName}: ${value}; }`;
  const marker = "/* Visual Edit overrides */";
  const block = `\n${marker}\n${rule}\n`;

  // De-dupe exact rule.
  if (cssCode.includes(rule)) return cssCode;
  if (cssCode.includes(marker)) return cssCode + `\n${rule}\n`;
  return cssCode + block;
}
