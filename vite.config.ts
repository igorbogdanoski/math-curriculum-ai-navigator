import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import type { IncomingMessage, NextFunction } from 'connect';
import type { ServerResponse } from 'http';

/** Extracts a safe display message from an unknown caught error. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Vite plugin: Dev middleware for Gemini API proxy.
 * In development, handles /api/gemini and /api/gemini-stream requests
 * using the SDK directly so `vite dev` works without Vercel CLI.
 * In production, Vercel serverless functions handle these routes.
 */
function geminiDevProxy(apiKey: string): Plugin {
  return {
    name: 'gemini-dev-proxy',
    configureServer(server) {
      // Helper to read POST body
      const readBody = (req: IncomingMessage): Promise<Record<string, unknown>> => new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
        req.on('error', reject);
      });

      // The client sends a flat `config` object (temperature/topP/maxOutputTokens/
      // responseMimeType alongside systemInstruction/safetySettings) — the Gemini SDK
      // requires those generation params nested under `generationConfig`, not spread at
      // the top level of the request (matches api/gemini.ts's prod-side handling).
      const splitConfig = (config: Record<string, unknown> | undefined, contents: unknown) => {
        const { systemInstruction, safetySettings, ...generationConfig } = config || {};
        const mergedContents = contents;
        if (systemInstruction && typeof systemInstruction === 'string' && Array.isArray(mergedContents) && mergedContents.length > 0) {
          const first = mergedContents[0] as { parts?: Array<{ text?: string }> };
          if (first?.parts?.[0]) {
            first.parts[0].text = `[SYSTEM INSTRUCTIONS]\n${systemInstruction}\n\n[USER REQUEST]\n${first.parts[0].text || ''}`;
          }
        }
        return { generationConfig, safetySettings, contents: mergedContents };
      };

      // Non-streaming proxy
      server.middlewares.use('/api/gemini-stream', async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const { model, contents, config } = await readBody(req) as {
            model: string; contents: unknown; config?: Record<string, unknown>;
          };
          const { generationConfig, safetySettings, contents: mergedContents } = splitConfig(config, contents);

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          const modelInstance = genAI.getGenerativeModel({ model, safetySettings } as Parameters<typeof genAI.getGenerativeModel>[0], { apiVersion: 'v1beta' });
          const result = await modelInstance.generateContentStream({
            contents: mergedContents,
            generationConfig,
          } as Parameters<typeof modelInstance.generateContentStream>[0]);

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (error: unknown) {
          const message = errMessage(error);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
          } else {
            res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
            res.end();
          }
        }
      });

      server.middlewares.use('/api/embed', async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const { model, contents } = await readBody(req) as { model?: string; contents: unknown };

          const modelInstance = genAI.getGenerativeModel({ model: model || 'gemini-embedding-2-preview' });
          const embedText = typeof contents === 'string' ? contents : (contents as Array<{ parts: Array<{ text?: string }> }>)[0]?.parts[0]?.text ?? '';
          const result = await modelInstance.embedContent(embedText);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          const responseShape = req.url?.includes('responseShape=embeddings') ? 'embeddings' : 'embedding';
          res.end(JSON.stringify(responseShape === 'embeddings' ? { embeddings: result.embedding } : { embedding: result.embedding }));
        } catch (error: unknown) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errMessage(error) }));
        }
      });

      server.middlewares.use('/api/gemini', async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const { model, contents, config } = await readBody(req) as {
            model: string; contents: unknown; config?: Record<string, unknown>;
          };
          const { generationConfig, safetySettings, contents: mergedContents } = splitConfig(config, contents);

          const modelInstance = genAI.getGenerativeModel({ model, safetySettings } as Parameters<typeof genAI.getGenerativeModel>[0], { apiVersion: 'v1beta' });
          const result = await modelInstance.generateContent({
            contents: mergedContents,
            generationConfig,
          } as Parameters<typeof modelInstance.generateContent>[0]);
          const response = await result.response;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            text: response.text() || '',
            candidates: response.candidates
          }));
        } catch (error: unknown) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errMessage(error) }));
        }
      });

      server.middlewares.use('/api/imagen', async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        const sendJson = (statusCode: number, body: object) => {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };

        try {
          const { contents } = await readBody(req) as { contents: unknown };
          const prompt = typeof contents === 'string' ? contents : (contents as Array<{ parts: Array<{ text?: string }> }>)[0]?.parts[0]?.text || '';

          if (!prompt) { sendJson(400, { error: 'Missing prompt' }); return; }

          // Mirrors api/imagen.ts's tryGeminiImageGen candidate list — kept in sync so local
          // dev exercises the same models as prod (Imagen 3 :predict / gemini-2.0-flash-*
          // are retired, this list previously went stale and always failed locally).
          let imageResult: { mimeType: string; data: string } | null = null;
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          for (const modelName of ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview']) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
              type ImageGenRequest = Parameters<typeof model.generateContent>[0] & { generationConfig?: { responseModalities?: string[] } };
              const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
              } as ImageGenRequest);
              type ImagePart = { inlineData?: { mimeType?: string; data: string } };
              const parts: ImagePart[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
              const imgPart = parts.find((p) => p.inlineData?.data);
              if (imgPart?.inlineData) {
                imageResult = { mimeType: imgPart.inlineData.mimeType || 'image/png', data: imgPart.inlineData.data };
                console.log(`[dev-imagen] succeeded with: ${modelName}`);
                break;
              }
              console.warn(`[dev-imagen] ${modelName}: no image parts in response`);
            } catch (e: unknown) { console.error(`[dev-imagen] ${modelName} error:`, errMessage(e)); }
          }

          if (imageResult) {
            sendJson(200, { inlineData: imageResult });
          } else {
            sendJson(500, { error: 'AI did not return image data from any strategy (see dev server logs)' });
          }
        } catch (error: unknown) {
          sendJson(500, { error: errMessage(error) });
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Support both VITE_ and standard prefix for API key
    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: {
          clientPort: 3000,
        },
      },
      plugins: [
        tailwindcss(),
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon-192.svg', 'icon-512.svg', 'offline.html'],
          manifest: {
            short_name: "Math Nav",
            name: "Math Curriculum AI Navigator",
            description: "Педагошки AI систем за наставници по математика (VI-IX одд.)",
            lang: "mk",
            dir: "ltr",
            icons: [
              {
                src: "/icon-192.svg",
                type: "image/svg+xml",
                sizes: "192x192",
                purpose: "any"
              },
              {
                src: "/icon-512.svg",
                type: "image/svg+xml",
                sizes: "512x512",
                purpose: "any maskable"
              }
            ],
            start_url: "/?source=pwa",
            scope: "/",
            display: "standalone",
            orientation: "portrait-primary",
            theme_color: "#0D47A1",
            background_color: "#F9FAFB"
          },
          workbox: {
            // skipWaiting: immediately activate new SW without waiting for
            // the user to close all tabs. Ensures updates are visible on next reload.
            skipWaiting: true,
            clientsClaim: true,
            maximumFileSizeToCacheInBytes: 5000000,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            // Exclude large on-demand data chunks from precache — they are loaded
            // lazily and cached at runtime via NetworkFirst. Precaching them adds
            // ~3MB to the SW install download (bad for rural/3G connections).
            globIgnores: [
              'assets/data-matura-*.js',
              'assets/data-secondary-curriculum-*.js',
              'assets/data-curriculum-*.js',
              // Export-only libraries — loaded on-demand, not needed on first visit
              'assets/vendor-mammoth-*.js',   // DOCX import (mammoth)
              'assets/vendor-pdf-*.js',        // @react-pdf
              'assets/vendor-mathlive-*.js',   // MathLive editor
              'assets/vendor-capture-*.js',    // html2canvas + jspdf
              'assets/vendor-pptx-*.js',       // pptxgenjs — PPTX export only
              'assets/vendor-xlsx-*.js',       // xlsx — Excel export only
              'assets/vendor-docx-*.js',       // docx — Word export only
              'assets/vendor-konva-*.js',      // konva/react-konva — DrawingCanvas only
            ],
            // Show offline page when navigation request fails
            navigateFallback: '/offline.html',
            // onedrive-redirect.html must reach the network for real (its own scoped CSP in
            // vercel.json, and the ?oauth=... query the OneDrive picker appends) — otherwise
            // Workbox silently swaps in offline.html for this and any other uncached navigation.
            navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/onedrive-redirect\.html/],
            runtimeCaching: [
              {
                // Large on-demand chunks (matura data, mammoth, mathlive, pdf)
                // are excluded from precache. Cache them at runtime on first use
                // so subsequent offline visits still work.
                urlPattern: /\/assets\/(data-matura|data-curriculum|data-secondary-curriculum|vendor-mammoth|vendor-pdf|vendor-mathlive|vendor-capture|vendor-pptx|vendor-xlsx|vendor-docx|vendor-konva)-[^/]+\.js$/,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'large-chunks-cache',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 30,
                  },
                  cacheableResponse: { statuses: [200] },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                // CacheFirst for versioned CDN assets (KaTeX, MathJax, etc.)
                // fetchOptions.mode:'cors' prevents opaque responses — the SW was
                // caching status-0 (opaque) responses and then returning them for
                // non-no-cors requests, causing "opaque response" network errors.
                urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'jsdelivr-cdn-cache',
                  fetchOptions: {
                    mode: 'cors',
                    credentials: 'omit',
                  },
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [200]
                  }
                }
              }
            ]
          }
        }),
        // Only add dev proxy when API key is available (dev mode)
        apiKey ? geminiDevProxy(apiKey) : undefined,
        process.env.SENTRY_AUTH_TOKEN ? sentryVitePlugin({
          org: process.env.SENTRY_ORG || 'math-nav-org',
          project: process.env.SENTRY_PROJECT || 'math-nav',
          authToken: process.env.SENTRY_AUTH_TOKEN,
          // SEC-1: explicit release tag — keeps runtime Sentry.init({release})
          // aligned with the source-map upload, deduping issues across deploys.
          release: {
            name: process.env.VERCEL_GIT_COMMIT_SHA
              ?? process.env.VITE_VERCEL_GIT_COMMIT_SHA
              ?? `local-${Date.now()}`,
          },
        }) : undefined,
      ].filter(Boolean) as Plugin[],
      // SEC-1: Expose git SHA to client for Sentry release tagging.
      // Vercel injects VERCEL_GIT_COMMIT_SHA at build time (system env var).
      define: {
        'import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA': JSON.stringify(
          process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VITE_VERCEL_GIT_COMMIT_SHA ?? 'local'
        ),
      },

      // NOTE: API key is NO LONGER injected into the client bundle.
      // In production, requests go through /api/gemini (Vercel serverless function).
      // In development, requests go through the Vite dev middleware above.
      build: {
        sourcemap: !!process.env.SENTRY_AUTH_TOKEN, // Enable source maps when Sentry is configured
        chunkSizeWarningLimit: 2600, // data-matura (~2.5MB) and vendor fallback (~2.1MB) are expected large chunks
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            // Standalone entry for public/msal-redirect.html (MSAL popup auth's redirect
            // bridge — see msalRedirectBridge.ts's doc comment). Needs a stable, predictable
            // filename since that static HTML page (unprocessed by Vite) references it by a
            // hardcoded <script src>, unlike the main app's hashed chunks.
            'msal-redirect-bridge': path.resolve(__dirname, 'msalRedirectBridge.ts'),
          },
          output: {
            entryFileNames: (chunkInfo) =>
              chunkInfo.name === 'msal-redirect-bridge' ? 'msal-redirect-bridge.js' : 'assets/[name]-[hash].js',
            // manualChunks — targeted vendor splitting for large libraries.
            //
            // View-based manual grouping remains disabled to avoid TDZ runtime errors
            // when circular imports appear across views and shared modules.
            //
            // Strategy:
            // 1) Keep React core in a dedicated stable chunk.
            // 2) Split known heavy libraries into dedicated chunks.
            // 3) Leave small/medium deps in a generic vendor fallback chunk.
            manualChunks: (id) => {
              // Split large curriculum data into their own chunks so the
              // root entry doesn't eagerly parse 600+ kB of JSON-like data
              // when many services statically import them.
              const normalized = id.replace(/\\/g, '/');
              if (normalized.includes('/data/secondaryCurriculum')) return 'data-secondary-curriculum';
              if (normalized.includes('/data/curriculum')) return 'data-curriculum';
              if (normalized.includes('/data/matura/')) return 'data-matura';
              if (!id.includes('node_modules')) return undefined;
              // Keep React core in generic vendor chunk to avoid vendor <-> react-core
              // circular runtime references (TDZ in production).
              if (id.includes('@react-pdf')) return 'vendor-pdf';     // has its own React copy
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('mammoth')) return 'vendor-mammoth';   // 884KB, only used in docx-upload views
              if (id.includes('pptxgenjs')) return 'vendor-pptx';
              if (id.includes('mathjs')) return 'vendor-mathjs';
              if (id.includes('@cortex-js/compute-engine')) return 'vendor-compute-engine';
              // Dedicated bucket (not the generic 'vendor' catch-all below) — the lightweight
              // msal-redirect-bridge entry only needs this small slice of code and must not
              // pull in the much larger shared vendor chunk just to broadcast one message.
              if (id.includes('@azure/msal-browser') || id.includes('@azure/msal-common')) return 'vendor-msal';
              if (id.includes('mathlive')) return 'vendor-mathlive';
              if (id.includes('docx')) return 'vendor-docx';
              if (id.includes('/xlsx/') || id.includes('\\xlsx\\')) return 'vendor-xlsx';
              if (id.includes('recharts')) return 'vendor-charts';
              if (id.includes('/d3-') || id.includes('\\d3-') || id.includes('d3-array') || id.includes('d3-scale') || id.includes('d3-shape') || id.includes('d3-color')) return 'vendor-d3';
              if (id.includes('konva') || id.includes('react-konva')) return 'vendor-konva';
              // three.js: not in dependencies — rule removed
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('@tanstack/react-query')) return 'vendor-query';
              if (id.includes('@dnd-kit') || id.includes('react-joyride') || id.includes('react-router-dom') || id.includes('zustand')) return 'vendor-react-ui';
              if (id.includes('@sentry')) return 'vendor-sentry';
              if (id.includes('html2canvas') || id.includes('jspdf')) return 'vendor-capture';
              if (id.includes('dompurify')) return 'vendor-sanitize';
              if (id.includes('zod')) return 'vendor-zod';
              if (id.includes('idb')) return 'vendor-storage';
              // Keep Sentry in the generic vendor chunk to avoid TDZ runtime errors
              // from circular dependencies between vendor-react-core/vendor chunks.
              if (id.includes('qrcode.react') || id.includes('react-qr-code')) return 'vendor-qr';
              if (id.includes('canvas-confetti')) return 'vendor-effects';
              if (id.includes('file-saver')) return 'vendor-files';
              if (id.includes('@google/generative-ai')) return 'vendor-gemini-client';
              if (id.includes('satori') || id.includes('@resvg')) return 'vendor-svg';
              if (id.includes('katex')) return 'vendor-katex';
              if (id.includes('marked') || id.includes('remark') || id.includes('rehype') || id.includes('unified') || id.includes('mdast') || id.includes('micromark')) return 'vendor-markdown';
              if (id.includes('date-fns') || id.includes('dayjs')) return 'vendor-dates';
              // framer-motion: not in dependencies — rule removed
              // NOTE: do not split React core / react-dom — proven TDZ runtime errors with cyclic vendor imports.
              return 'vendor';
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
