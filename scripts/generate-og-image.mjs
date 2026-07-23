// Generates the social-share OG image (public/og-image.png, 1200×630).
// index.html references /og-image.png for og:image/twitter:image, but the file did not
// exist (2026-07-23 audit) so every social share rendered a broken image. This uses the
// already-installed satori (HTML/CSS → SVG) + @resvg/resvg-wasm (SVG → PNG) pipeline.
//
// Text is Latin-only on purpose ("MisMath AI" + English tagline + domain) so a single
// Latin subset of Inter is sufficient — no Cyrillic font needed for the share card.
//
// Usage: node scripts/generate-og-image.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'og-image.png');
const W = 1200;
const H = 630;

// Latin-700 Inter, tried in order (CDN mirrors). Any one succeeding is enough.
const FONT_URLS = [
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-800-normal.ttf',
  'https://raw.githubusercontent.com/vercel/satori/main/test/assets/Roboto-Regular.ttf',
];

async function loadFont() {
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.arrayBuffer();
      if (data.byteLength > 10_000) return data;
    } catch {
      // try next mirror
    }
  }
  throw new Error('Could not download a font for OG image generation (offline?).');
}

// satori is flexbox-based; every container needs display:'flex'.
function template() {
  return createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '90px',
        background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 55%, #0A3470 100%)',
        color: 'white',
        fontFamily: 'Inter',
        position: 'relative',
      },
    },
    // top accent bar (brand yellow)
    createElement('div', {
      style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '16px', background: '#FFD600', display: 'flex' },
    }),
    // AI badge
    createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', marginBottom: '28px' } },
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '78px',
            height: '78px',
            borderRadius: '39px',
            background: '#FFD600',
            color: '#0D47A1',
            fontSize: '34px',
            fontWeight: 800,
          },
        },
        'AI',
      ),
    ),
    createElement('div', { style: { display: 'flex', fontSize: '112px', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-3px' } }, 'MisMath AI'),
    createElement(
      'div',
      { style: { display: 'flex', fontSize: '42px', fontWeight: 500, color: '#BBDEFB', marginTop: '22px' } },
      'AI-powered platform for mathematics teachers',
    ),
    createElement('div', { style: { display: 'flex', fontSize: '32px', fontWeight: 700, color: '#FFD600', marginTop: '46px' } }, 'ai.mismath.net'),
  );
}

async function main() {
  const fontData = await loadFont();

  const svg = await satori(template(), {
    width: W,
    height: H,
    fonts: [{ name: 'Inter', data: fontData, weight: 700, style: 'normal' }],
  });

  const wasmPath = join(root, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
  await initWasm(readFileSync(wasmPath));
  const resvg = new Resvg(svg, { background: '#0D47A1', fitTo: { mode: 'width', value: W } });
  const png = Buffer.from(resvg.render().asPng());

  writeFileSync(OUT, png);
  console.log(`✓ OG image written: ${OUT} (${(png.length / 1024).toFixed(1)} kB, ${W}×${H})`);
}

main().catch((err) => {
  console.error('OG image generation failed:', err);
  process.exit(1);
});
