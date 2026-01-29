#!/usr/bin/env node
/**
 * Post-build script for Chrome extension
 * - Copies manifest.json and icons to dist
 *
 * Note: Content script is built separately by esbuild (build-content.mjs)
 * as a single IIFE bundle to avoid ES module import issues.
 */

import { copyFileSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

console.log('[post-build] Copying extension assets...');

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
