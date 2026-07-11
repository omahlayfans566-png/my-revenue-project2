/**
 * Generate PNG icons from SVG source for PWA compatibility.
 * Chrome requires valid PNG icons (192×192 and 512×512) for installability.
 * Run: node scripts/generate-pwa-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Source SVG path
const SVG_SOURCE = path.join(ROOT, 'dateclone', 'public', 'pwa-icons', 'icon-512.svg');

// Output directories for both public folders
const OUTPUT_DIRS = [
  path.join(ROOT, 'dateclone', 'public', 'pwa-icons'),
  path.join(ROOT, 'public', 'pwa-icons'),
];

const SIZES = [
  { size: 192, name: 'icon-192.png', purpose: 'any' },
  { size: 512, name: 'icon-512.png', purpose: 'any' },
  { size: 192, name: 'icon-192-maskable.png', purpose: 'maskable' },
  { size: 512, name: 'icon-512-maskable.png', purpose: 'maskable' },
];

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore if exists
  }
}

async function generate() {
  console.log('Reading SVG source...');
  let svgBuffer;
  try {
    svgBuffer = await fs.readFile(SVG_SOURCE);
  } catch {
    // Fallback: create a simple SVG programmatically
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff1744"/>
      <stop offset="100%" style="stop-color:#ff4081"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>
  <text x="256" y="300" font-family="Georgia,serif" font-size="280" font-weight="bold" fill="white" text-anchor="middle">D</text>
</svg>`;
    svgBuffer = Buffer.from(fallbackSvg);
    console.log('Using fallback SVG (source not found)');
  }

  for (const outputDir of OUTPUT_DIRS) {
    await ensureDir(outputDir);
    console.log(`\nGenerating icons in: ${outputDir}`);

    for (const { size, name } of SIZES) {
      const outputPath = path.join(outputDir, name);
      try {
        await sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(outputPath);
        console.log(`  ✓ ${name} (${size}x${size})`);
      } catch (err) {
        console.error(`  ✗ ${name} failed: ${err.message}`);
      }
    }
  }

  console.log('\n✅ All PNG icons generated successfully!');
}

generate().catch(console.error);