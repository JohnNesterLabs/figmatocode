import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

export type VePatchResult =
  | { ok: true; code: string }
  | { ok: false; reason: string };

function getAttrString(opening: t.JSXOpeningElement, name: string): string | null {
  for (const a of opening.attributes) {
    if (!t.isJSXAttribute(a)) continue;
    if (!t.isJSXIdentifier(a.name) || a.name.name !== name) continue;
    const v = a.value;
    if (!v) return "";
    if (t.isStringLiteral(v)) return v.value;
    return null;
  }
  return null;
}

function setClassNameOnOpening(opening: t.JSXOpeningElement, newClass: string) {
  const attrIdx = opening.attributes.findIndex(
    (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "className"
  );
  const attr = t.jsxAttribute(t.jsxIdentifier("className"), t.stringLiteral(newClass));
  if (attrIdx >= 0) opening.attributes[attrIdx] = attr;
  else opening.attributes.push(attr);
}

function extractClassNameValue(attr: t.JSXAttribute): { kind: "string"; value: string } | { kind: "unsupported" } {
  if (!attr.value) return { kind: "string", value: "" };
  if (t.isStringLiteral(attr.value)) return { kind: "string", value: attr.value.value };
  if (t.isJSXExpressionContainer(attr.value)) {
    const e = attr.value.expression;
    if (t.isStringLiteral(e)) return { kind: "string", value: e.value };
    if (t.isTemplateLiteral(e) && e.expressions.length === 0) {
      return { kind: "string", value: e.quasis.map((q) => q.value.cooked ?? "").join("") };
    }
  }
  return { kind: "unsupported" };
}

function isCnLikeCallee(callee: t.Expression | t.V8IntrinsicIdentifier): boolean {
  if (t.isIdentifier(callee)) return callee.name === "cn" || callee.name === "clsx";
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    return callee.property.name === "cn" || callee.property.name === "clsx";
  }
  return false;
}

function patchCnLikeExpression(expr: t.Expression, pattern: RegExp, newToken: string): boolean {
  if (!t.isCallExpression(expr)) return false;
  if (!isCnLikeCallee(expr.callee)) return false;

  const patchStringLiteralNode = (node: t.StringLiteral): boolean => {
    const next = replaceOrAppendTw(node.value, pattern, newToken);
    if (next === node.value) return false;
    node.value = next;
    return true;
  };

  const patchTemplateLiteralNode = (node: t.TemplateLiteral): boolean => {
    if (node.expressions.length > 0) return false;
    const raw = node.quasis.map((q) => q.value.cooked ?? "").join("");
    const next = replaceOrAppendTw(raw, pattern, newToken);
    if (next === raw) return false;
    node.quasis = [t.templateElement({ raw: next, cooked: next }, true)];
    return true;
  };

  // Prefer replacing an existing token in any literal argument.
  let didPatchExisting = false;
  const tryPatchExisting = (arg: t.CallExpression["arguments"][number]) => {
    if (didPatchExisting) return;
    if (t.isSpreadElement(arg) || t.isJSXNamespacedName(arg) || t.isArgumentPlaceholder(arg)) return;

    if (t.isStringLiteral(arg)) {
      pattern.lastIndex = 0;
      if (pattern.test(arg.value)) didPatchExisting = patchStringLiteralNode(arg) || didPatchExisting;
      return;
    }
    if (t.isTemplateLiteral(arg)) {
      if (arg.expressions.length > 0) return;
      const raw = arg.quasis.map((q) => q.value.cooked ?? "").join("");
      if (!raw) return;
      pattern.lastIndex = 0;
      if (pattern.test(raw)) didPatchExisting = patchTemplateLiteralNode(arg) || didPatchExisting;
      return;
    }
    if (t.isArrayExpression(arg)) {
      for (const el of arg.elements) {
        if (!el || didPatchExisting) continue;
        if (t.isStringLiteral(el)) {
          pattern.lastIndex = 0;
          if (pattern.test(el.value)) didPatchExisting = patchStringLiteralNode(el) || didPatchExisting;
        } else if (t.isTemplateLiteral(el)) {
          if (el.expressions.length > 0) continue;
          const raw = el.quasis.map((q) => q.value.cooked ?? "").join("");
          if (!raw) continue;
          pattern.lastIndex = 0;
          if (pattern.test(raw)) didPatchExisting = patchTemplateLiteralNode(el) || didPatchExisting;
        }
      }
    }
  };

  for (const arg of expr.arguments) tryPatchExisting(arg);
  if (didPatchExisting) return true;

  // Otherwise append to the first patchable literal argument.
  for (const arg of expr.arguments) {
    if (t.isSpreadElement(arg) || t.isJSXNamespacedName(arg) || t.isArgumentPlaceholder(arg)) continue;
    if (t.isStringLiteral(arg)) return patchStringLiteralNode(arg);
    if (t.isTemplateLiteral(arg)) return patchTemplateLiteralNode(arg);
    if (t.isArrayExpression(arg)) {
      for (const el of arg.elements) {
        if (!el) continue;
        if (t.isStringLiteral(el)) return patchStringLiteralNode(el);
        if (t.isTemplateLiteral(el)) return patchTemplateLiteralNode(el);
      }
    }
  }

  return false;
}

function replaceOrAppendTw(classStr: string, pattern: RegExp, newToken: string): string {
  pattern.lastIndex = 0;
  if (pattern.test(classStr)) {
    pattern.lastIndex = 0;
    return classStr.replace(pattern, newToken);
  }
  return (classStr + " " + newToken).trim().replace(/\s+/g, " ");
}

function twTokenForStyle(prop: string, value: string): { token: string; pattern: RegExp } | null {
  const p = prop;
  const v = (value || "").trim();
  if (!v) return null;

  switch (p) {
    case "backgroundColor":
      return { token: `bg-[${v}]`, pattern: /\bbg-(?:\[[^\]]+\]|[\w/]+)/g };
    case "color":
      return { token: `text-[${v}]`, pattern: /\btext-(?:\[[^\]]+\]|(?!sm\b|xs\b|base\b|lg\b|xl\b|2xl\b|3xl\b|4xl\b|5xl\b|6xl\b|7xl\b|8xl\b|9xl\b)[\w/]+)/g };
    case "borderColor":
      return { token: `border-[${v}]`, pattern: /\bborder-(?:\[[^\]]+\]|[\w/]+)/g };
    case "borderRadius":
      return { token: `rounded-[${v}]`, pattern: /\brounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?\b/g };
    default:
      return null;
  }
}

/**
 * Patch a style change onto the JSX element identified by `data-ve-id`.
 * For now, this focuses on `className` and uses Tailwind arbitrary values.
 * Falls back to adding/replacing `className` with a string literal.
 */
export function patchStyleByVeId(tsxCode: string, veId: string, prop: string, value: string): VePatchResult {
  if (!veId) return { ok: false, reason: "Missing veId" };
  const tw = twTokenForStyle(prop, value);
  if (!tw) return { ok: false, reason: `Unsupported style prop: ${prop}` };

  const ast = parse(tsxCode, { sourceType: "module", plugins: ["typescript", "jsx"] });
  let patched = false;

  traverse(ast, {
    JSXOpeningElement(path) {
      if (patched) return;
      const id = getAttrString(path.node, "data-ve-id");
      if (id !== veId) return;

      const clsAttr = path.node.attributes.find(
        (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "className"
      ) as t.JSXAttribute | undefined;

      if (!clsAttr) {
        setClassNameOnOpening(path.node, tw.token);
        patched = true;
        return;
      }

      const cls = extractClassNameValue(clsAttr);
      if (cls.kind === "string") {
        setClassNameOnOpening(path.node, replaceOrAppendTw(cls.value, tw.pattern, tw.token));
        patched = true;
        return;
      }

      // Try to preserve common className expressions like cn(...) / clsx(...).
      if (t.isJSXExpressionContainer(clsAttr.value)) {
        const expr = clsAttr.value.expression;
        if (t.isExpression(expr) && patchCnLikeExpression(expr, tw.pattern, tw.token)) {
          patched = true;
          return;
        }
      }

      // Fallback: overwrite dynamic className (last resort).
      setClassNameOnOpening(path.node, tw.token);
      patched = true;
    },
  });

  if (!patched) return { ok: false, reason: "No matching JSX element for veId" };
  return { ok: true, code: generate(ast, { retainLines: true }).code };
}

/**
 * Patch text content inside the JSX element identified by `data-ve-id`.
 * Updates the first literal JSXText or {"..."} child within the element.
 */
export function patchTextByVeId(tsxCode: string, veId: string, newText: string): VePatchResult {
  if (!veId) return { ok: false, reason: "Missing veId" };
  const ast = parse(tsxCode, { sourceType: "module", plugins: ["typescript", "jsx"] });

  let inTarget = false;
  let patched = false;

  traverse(ast, {
    JSXElement: {
      enter(path) {
        if (patched) return;
        const id = getAttrString(path.node.openingElement, "data-ve-id");
        inTarget = id === veId;
        if (!inTarget) return;

        // Try to patch first literal child
        for (const child of path.node.children) {
          if (t.isJSXText(child)) {
            child.value = newText;
            patched = true;
            return;
          }
          if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
            child.expression.value = newText;
            patched = true;
            return;
          }
        }
      },
      exit() {
        inTarget = false;
      },
    },
  });

  if (!patched) return { ok: false, reason: "No patchable literal text found for veId" };
  return { ok: true, code: generate(ast, { retainLines: true }).code };
}

