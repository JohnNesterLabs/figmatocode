import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

export interface InstrumentVeIdsResult {
  code: string;
  addedCount: number;
}

/**
 * Adds `data-ve-id="ve_<n>"` attributes to JSX opening elements, in traversal order.
 * This is intended for the WebContainer preview project only (not persisted output).
 */
export function instrumentVeIds(tsxCode: string, startIndex = 1): InstrumentVeIdsResult {
  const ast = parse(tsxCode, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  let nextId = startIndex;
  let addedCount = 0;

  traverse(ast, {
    JSXOpeningElement(path) {
      const attrs = path.node.attributes;
      const already = attrs.some(
        (a) =>
          t.isJSXAttribute(a) &&
          t.isJSXIdentifier(a.name) &&
          a.name.name === "data-ve-id"
      );
      if (already) return;

      const id = `ve_${nextId++}`;
      const attr = t.jsxAttribute(t.jsxIdentifier("data-ve-id"), t.stringLiteral(id));
      attrs.push(attr);
      addedCount++;
    },
  });

  const out = generate(ast, { retainLines: true }).code;
  return { code: out, addedCount };
}

