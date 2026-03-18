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
      return tw ? `bg-${tw}` : null;
    }
    case 'color': {
      const tw = colorToTailwind(value);
      return tw ? `text-${tw}` : null;
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
      return tw === '' ? 'rounded' : tw ? `rounded-${tw}` : null;
    }
    case 'padding': {
      const tw = pxToTailwindUnit(value);
      return tw ? `p-${tw}` : null;
    }
    case 'paddingTop': {
      const tw = pxToTailwindUnit(value);
      return tw ? `pt-${tw}` : null;
    }
    case 'paddingRight': {
      const tw = pxToTailwindUnit(value);
      return tw ? `pr-${tw}` : null;
    }
    case 'paddingBottom': {
      const tw = pxToTailwindUnit(value);
      return tw ? `pb-${tw}` : null;
    }
    case 'paddingLeft': {
      const tw = pxToTailwindUnit(value);
      return tw ? `pl-${tw}` : null;
    }
    case 'margin': {
      const tw = pxToTailwindUnit(value);
      return tw ? `m-${tw}` : null;
    }
    case 'marginTop': {
      const tw = pxToTailwindUnit(value);
      return tw ? `mt-${tw}` : null;
    }
    case 'marginRight': {
      const tw = pxToTailwindUnit(value);
      return tw ? `mr-${tw}` : null;
    }
    case 'marginBottom': {
      const tw = pxToTailwindUnit(value);
      return tw ? `mb-${tw}` : null;
    }
    case 'marginLeft': {
      const tw = pxToTailwindUnit(value);
      return tw ? `ml-${tw}` : null;
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
  backgroundColor: /\bbg-[\w/[\]]+/g,
  color: /\btext-(?!sm\b|xs\b|base\b|lg\b|xl\b|2xl\b|3xl\b|4xl\b|5xl\b|6xl\b|7xl\b|8xl\b|9xl\b)[\w/[\]]+/g,
  fontSize: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
  fontWeight: /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g,
  borderRadius: /\brounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?\b/g,
  padding: /\bp-\d+\b/g,
  paddingTop: /\bpt-\d+\b/g,
  paddingRight: /\bpr-\d+\b/g,
  paddingBottom: /\bpb-\d+\b/g,
  paddingLeft: /\bpl-\d+\b/g,
  margin: /\bm-\d+\b/g,
  marginTop: /\bmt-\d+\b/g,
  marginRight: /\bmr-\d+\b/g,
  marginBottom: /\bmb-\d+\b/g,
  marginLeft: /\bml-\d+\b/g,
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

  const twClass = cssToTailwindClass(prop, value);

  // ── Strategy 1: Tailwind className replacement ──
  if (twClass && usesTailwind(code)) {
    // Match className="..." or className={`...`} — prioritize tag if given
    const tag = tagName || '[a-zA-Z][a-zA-Z0-9.]*';
    // Match opening tags with className
    const classNameRegex = new RegExp(
      `(<${tag}[^>]*?\\s)className=(?:"([^"]*?)"|'([^']*?)'|\`([^\`]*?)\`)`,
      'gs'
    );
    let count = 0;
    let didChange = false;
    const patchedCode = code.replace(classNameRegex, (match, pre, dq, sq, bt) => {
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
  }

  // ── Strategy 2: Inline style={{ }} ──
  if (usesInlineStyles(code)) {
    // Find style={{ prop: oldValue }} and replace the value
    const camelProp = prop; // already camelCase
    // Match: propName: "value" or propName: value or propName: 'value'
    const inlineStyleRegex = new RegExp(
      `(style=\\{\\{[^}]*?)\\b(${camelProp})\\s*:\\s*(?:"[^"]*"|'[^']*'|[^,}]+)`,
      's'
    );
    if (inlineStyleRegex.test(code)) {
      return code.replace(inlineStyleRegex, (match, prefix) => {
        return `${prefix}${camelProp}: "${value}"`;
      });
    }
    // Append property to first style={{ ... }} found
    const appendRegex = /(style=\{\{)([^}]*?)(\}\})/s;
    return code.replace(appendRegex, (match, open, body, close) => {
      const sep = body.trim().endsWith(',') || body.trim() === '' ? ' ' : ', ';
      return `${open}${body}${sep}${camelProp}: "${value}" ${close}`;
    });
  }

  // ── Strategy 3: Append overriding CSS at the bottom ──
  const cssPropName = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  const selector = opts.selector || (tagName || '*');
  const cssRule = `${selector} { ${cssPropName}: ${value}; }`;

  // IMPORTANT: Do NOT append raw CSS into TS/TSX (it breaks parsing).
  // Instead, inject/append CSS into a runtime <style> tag.
  const cleaned = code
    // Clean up any older buggy raw-CSS insertions from previous versions.
    .replace(/\n\/\*\s*Visual Edit override\s*\*\/\n[^\n]*\{[^\n]*\}\n?/g, "\n");

  const injection = [
    "",
    "/* Visual Edit override */",
    "if (typeof document !== \"undefined\") {",
    "  const __veStyleId = \"__ve_style_overrides__\";",
    "  let __veEl = document.getElementById(__veStyleId) as HTMLStyleElement | null;",
    "  if (!__veEl) {",
    "    __veEl = document.createElement(\"style\");",
    "    __veEl.id = __veStyleId;",
    "    document.head.appendChild(__veEl);",
    "  }",
    `  const __veRule = ${JSON.stringify(`\n${cssRule}\n`)};`,
    "  // Avoid unbounded duplicates for identical rules",
    "  if (!__veEl.textContent?.includes(__veRule)) {",
    "    __veEl.appendChild(document.createTextNode(__veRule));",
    "  }",
    "}",
    "",
  ].join("\n");

  return cleaned + injection;
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
