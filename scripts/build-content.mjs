// scripts/build-content.mjs
// Builds content script as a single IIFE bundle (no imports/exports)
// This is required because Chrome content scripts are classic scripts, not ES modules

import { build } from "esbuild";

await build({
  entryPoints: ["src/content/index.ts"],
  outfile: "dist/content.js",
  bundle: true,
  format: "iife",                          // Classic script; no imports
  platform: "browser",
  target: ["chrome114"],
  sourcemap: true,
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
});

console.log("[build-content] Content script built as IIFE bundle");
