#!/usr/bin/env node
/**
 * Option A: Merge figma-to-code-starter template into this project.
 * Copies config, docs, and Supabase layout; merges package.json and .env.example.
 * Does NOT overwrite src/ (your app code).
 *
 * Usage:
 *   node scripts/merge-from-template.js [path-to-template]
 *   TEMPLATE_REF=../figma-to-code-starter node scripts/merge-from-template.js
 *
 * Default path: .template-ref (clone the template into repo root first).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const templatePath = path.resolve(
  projectRoot,
  process.env.TEMPLATE_REF || process.argv[2] || ".template-ref"
);

function exists(p) {
  return fs.existsSync(p);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function mergeEnvExample(ours, theirs) {
  const keys = new Set();
  const lines = [];
  for (const block of [ours, theirs]) {
    if (!block) continue;
    for (const line of block.split(/\r?\n/)) {
      const trimmed = line.trim();
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
      if (match && !keys.has(match[1])) {
        keys.add(match[1]);
        lines.push(line);
      } else if (!match && (trimmed.startsWith("#") || trimmed === "")) {
        if (!lines.some((l) => l.trim() === trimmed)) lines.push(line);
      }
    }
  }
  return lines.join("\n");
}

function mergePackageJson(ours, theirs) {
  const merged = { ...ours };
  for (const key of ["dependencies", "devDependencies"]) {
    if (!theirs[key]) continue;
    merged[key] = { ...(merged[key] || {}), ...theirs[key] };
  }
  return merged;
}

function copyRecursive(src, dest, skipExisting = false) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!exists(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name), skipExisting);
    }
  } else {
    if (skipExisting && exists(dest)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function main() {
  if (!exists(templatePath)) {
    console.error(
      `Template not found at: ${templatePath}\n` +
        "Clone it first, e.g.: git clone https://github.com/nester-dev-bot/figma-to-code-starter.git .template-ref"
    );
    process.exit(1);
  }

  const copied = [];
  const merged = [];

  // 1) Copy config/docs (overwrite)
  const copyFiles = [
    "BACKEND.md",
    "components.json",
    "eslint.config.js",
    "index.html",
  ];
  for (const name of copyFiles) {
    const src = path.join(templatePath, name);
    const dest = path.join(projectRoot, name);
    if (exists(src)) {
      fs.copyFileSync(src, dest);
      copied.push(name);
    }
  }

  // 2) Merge .env.example (keep both sets of vars)
  const envTemplate = path.join(templatePath, ".env.example");
  const envOurs = path.join(projectRoot, ".env.example");
  if (exists(envTemplate)) {
    const ours = exists(envOurs) ? fs.readFileSync(envOurs, "utf8") : "";
    const theirs = fs.readFileSync(envTemplate, "utf8");
    fs.writeFileSync(envOurs, mergeEnvExample(ours, theirs), "utf8");
    merged.push(".env.example");
  }

  // 3) Merge package.json (add template deps we don't have)
  const pkgTemplate = path.join(templatePath, "package.json");
  const pkgOurs = path.join(projectRoot, "package.json");
  if (exists(pkgTemplate)) {
    const ourPkg = readJson(pkgOurs);
    const theirPkg = readJson(pkgTemplate);
    const mergedPkg = mergePackageJson(ourPkg, theirPkg);
    writeJson(pkgOurs, mergedPkg);
    merged.push("package.json");
  }

  // 4) Copy supabase/ from template where we don't have files (no overwrite of our functions)
  const supabaseTemplate = path.join(templatePath, "supabase");
  const supabaseOurs = path.join(projectRoot, "supabase");
  if (exists(supabaseTemplate)) {
    const skipDirs = ["functions"]; // keep our github-push and any other functions
    function copySupabase(srcDir, destDir) {
      if (!exists(destDir)) fs.mkdirSync(destDir, { recursive: true });
      for (const name of fs.readdirSync(srcDir)) {
        const src = path.join(srcDir, name);
        const dest = path.join(destDir, name);
        if (fs.statSync(src).isDirectory()) {
          if (skipDirs.includes(name) && exists(dest)) continue;
          copySupabase(src, dest);
        } else {
          if (!exists(dest)) {
            fs.copyFileSync(src, dest);
            copied.push(`supabase/${path.relative(supabaseOurs, dest)}`);
          }
        }
      }
    }
    copySupabase(supabaseTemplate, supabaseOurs);
  }

  console.log("Merge from template complete.");
  if (copied.length) console.log("Copied (overwrite):", copied.join(", "));
  if (merged.length) console.log("Merged:", merged.join(", "));
  console.log("\nNext: run npm install, then npm run dev. Review BACKEND.md and .env.example.");
}

main();
