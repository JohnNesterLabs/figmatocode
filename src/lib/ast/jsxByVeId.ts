import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

export type VeJsxResult =
  | { ok: true; jsx: string }
  | { ok: false; reason: string };

export type VeReplaceResult =
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

export function extractJsxByVeId(tsxCode: string, veId: string): VeJsxResult {
  if (!veId) return { ok: false, reason: "Missing veId" };
  const ast = parse(tsxCode, { sourceType: "module", plugins: ["typescript", "jsx"] });
  let found: t.JSXElement | null = null;

  traverse(ast, {
    JSXElement(path) {
      if (found) return;
      const id = getAttrString(path.node.openingElement, "data-ve-id");
      if (id === veId) found = path.node;
    },
  });

  if (!found) return { ok: false, reason: "No JSX element found for veId" };
  return { ok: true, jsx: generate(found, { retainLines: true }).code };
}

function parseJsxElementFromString(jsx: string): t.JSXElement | null {
  const trimmed = jsx.trim();
  if (!trimmed) return null;
  // Parse as an expression by wrapping in parentheses
  const wrapped = `(${trimmed})`;
  const ast = parse(wrapped, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const stmt = ast.program.body[0];
  if (!stmt || !t.isExpressionStatement(stmt)) return null;
  const expr = stmt.expression;
  if (!t.isParenthesizedExpression(expr)) return null;
  const inner = expr.expression;
  return t.isJSXElement(inner) ? inner : null;
}

export function replaceJsxByVeId(tsxCode: string, veId: string, newJsx: string): VeReplaceResult {
  if (!veId) return { ok: false, reason: "Missing veId" };
  // Safety: ensure model preserved the veId.
  // This is a simple string guard before AST parse/replace.
  if (!newJsx.includes(`data-ve-id="${veId}"`) && !newJsx.includes(`data-ve-id='${veId}'`)) {
    return { ok: false, reason: "Model output removed or changed data-ve-id" };
  }
  const replacement = parseJsxElementFromString(newJsx);
  if (!replacement) return { ok: false, reason: "Model output is not a JSX element" };

  // Safety: ensure parsed JSX contains the same veId.
  const parsedId = getAttrString(replacement.openingElement, "data-ve-id");
  if (parsedId !== veId) {
    return { ok: false, reason: "Model output has mismatched data-ve-id" };
  }

  const ast = parse(tsxCode, { sourceType: "module", plugins: ["typescript", "jsx"] });
  let replaced = false;

  traverse(ast, {
    JSXElement(path) {
      if (replaced) return;
      const id = getAttrString(path.node.openingElement, "data-ve-id");
      if (id !== veId) return;
      path.replaceWith(replacement);
      replaced = true;
    },
  });

  if (!replaced) return { ok: false, reason: "No matching JSX element for veId" };
  return { ok: true, code: generate(ast, { retainLines: true }).code };
}

