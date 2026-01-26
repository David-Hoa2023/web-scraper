#!/usr/bin/env node
/**
 * Post-build script to fix content script for Chrome extension compatibility
 * - Removes import.meta.url references (not allowed in non-module scripts)
 * - Removes ES module export statements
 * - Copies manifest.json and icons to dist
 */

import { readFileSync, writeFileSync, copyFileSync, cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

console.log('[post-build] Fixing content script for Chrome extension...');

// Fix content.js
const contentPath = join(distDir, 'content.js');
if (existsSync(contentPath)) {
  let content = readFileSync(contentPath, 'utf-8');

  // Remove import.meta.url references
  const importMetaCount = (content.match(/import\.meta\.url/g) || []).length;
  content = content.replace(/import\.meta\.url/g, '""');

  // Remove ES module exports
  const exportCount = (content.match(/export\{[^}]*\};/g) || []).length;
  content = content.replace(/export\{[^}]*\};/g, '');

  writeFileSync(contentPath, content);
  console.log(`[post-build] Fixed content.js: removed ${importMetaCount} import.meta refs, ${exportCount} exports`);
}

// Copy manifest.json
const manifestSrc = join(rootDir, 'src', 'manifest.json');
const manifestDest = join(distDir, 'manifest.json');
copyFileSync(manifestSrc, manifestDest);
console.log('[post-build] Copied manifest.json');

// Copy icons
const iconsSrc = join(rootDir, 'src', 'icons');
const iconsDest = join(distDir, 'icons');
if (existsSync(iconsSrc)) {
  cpSync(iconsSrc, iconsDest, { recursive: true });
  console.log('[post-build] Copied icons/');
}

console.log('[post-build] Done!');
