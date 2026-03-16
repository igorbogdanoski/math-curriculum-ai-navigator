import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
      const readBody = (req: any): Promise<any> => new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
        req.on('error', reject);
      });

      // Non-streaming proxy
      server.middlewares.use('/api/gemini-stream', async (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const { model, contents, config } = await readBody(req);

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          const modelInstance = genAI.getGenerativeModel({ model }, { apiVersion: 'v1beta' });
          const result = await modelInstance.generateContentStream({
            contents,
            ...config,
          });
          
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (error: any) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
          }
        }
      });

      server.middlewares.use('/api/gemini-embed', async (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const { model, contents } = await readBody(req);

          const modelInstance = genAI.getGenerativeModel({ model: model || 'gemini-embedding-2-preview' });
          const result = await modelInstance.embedContent({
            content: { role: 'user', parts: contents as any[] }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ embeddings: result.embedding }));
        } catch (error: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

      server.middlewares.use('/api/gemini', async (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const { model, contents, config } = await readBody(req);

          const modelInstance = genAI.getGenerativeModel({ model }, { apiVersion: 'v1beta' });
          const result = await modelInstance.generateContent({
            contents,
            ...config,
          });
          const response = await result.response;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            text: response.text() || '', 
            candidates: response.candidates 
          }));
        } catch (error: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

      server.middlewares.use('/api/imagen', async (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
        if (req.method !== 'POST') return next();

        const sendJson = (statusCode: number, body: object) => {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };

        try {
          const { contents } = await readBody(req);
          const prompt = typeof contents === 'string' ? contents : (contents as any[])[0]?.parts[0]?.text || '';

          if (!prompt) { sendJson(400, { error: 'Missing prompt' }); return; }

          let imageResult: { mimeType: string; data: string } | null = null;

          // Strategy 1: Imagen 3 via :predict (Vertex-compatible endpoint)
          try {
            const predictUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
            const predictRes = await fetch(predictUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1, aspectRatio: '16:9', safetyFilterLevel: 'block_some', personGeneration: 'dont_allow' },
              }),
            });
            if (predictRes.ok) {
              const d = await predictRes.json();
              const p = d.predictions?.[0];
              if (p?.bytesBase64Encoded) imageResult = { mimeType: p.mimeType || 'image/png', data: p.bytesBase64Encoded };
            } else {
              const errBody = await predictRes.text().catch(() => '');
              console.error(`[dev-imagen] Strategy 1 failed [${predictRes.status}]:`, errBody);
            }
          } catch (e: any) { console.error('[dev-imagen] Strategy 1 error:', e.message); }

          // Strategy 2: Gemini Flash image generation (tries two model aliases)
          if (!imageResult) {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            for (const modelName of ['gemini-2.0-flash-preview-image-generation', 'gemini-2.0-flash-exp']) {
              try {
                const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
                const result = await (model as any).generateContent({
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  generationConfig: { responseModalities: ['IMAGE'] },
                });
                const parts: any[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
                const imgPart = parts.find((p: any) => p.inlineData?.data);
                if (imgPart?.inlineData) {
                  imageResult = { mimeType: imgPart.inlineData.mimeType || 'image/png', data: imgPart.inlineData.data };
                  console.log(`[dev-imagen] Strategy 2 succeeded with: ${modelName}`);
                  break;
                }
              } catch (e: any) { console.error(`[dev-imagen] Strategy 2 (${modelName}) error:`, e.message); }
            }
          }

          if (imageResult) {
            sendJson(200, { inlineData: imageResult });
          } else {
            sendJson(500, { error: 'AI did not return image data from any strategy (see dev server logs)' });
          }
        } catch (error: any) {
          sendJson(500, { error: error.message });
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
            maximumFileSizeToCacheInBytes: 5000000,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            // Show offline page when navigation request fails
            navigateFallback: '/offline.html',
            navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],
            runtimeCaching: [
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
        }) : undefined,
      ].filter(Boolean) as Plugin[],
      // NOTE: API key is NO LONGER injected into the client bundle.
      // In production, requests go through /api/gemini (Vercel serverless function).
      // In development, requests go through the Vite dev middleware above.
      build: {
        sourcemap: !!process.env.SENTRY_AUTH_TOKEN, // Enable source maps when Sentry is configured
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                // Specific packages FIRST — before the broad 'react' check,
                // because '@react-pdf' and 'lucide-react' contain "react" in their path
                // and would otherwise land in vendor-react, corrupting React's init order.
                if (id.includes('@react-pdf')) return 'vendor-pdf';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('docx')) return 'vendor-docx';
                if (id.includes('zod')) return 'vendor-zod';
                // Firebase modules
                if (id.includes('firebase/app')) return 'vendor-firebase-app';
                if (id.includes('firebase/auth')) return 'vendor-firebase-auth';
                if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
                if (id.includes('firebase/storage')) return 'vendor-firebase-storage';
                // React (broad check is safe now that specific packages are handled above)
                if (id.includes('react-dom') || id.includes('react-router-dom') || /[/\\]react[/\\]/.test(id)) {
                  return 'vendor-react';
                }
                return 'vendor';
              }
              if (id.includes('views/')) {
                if (id.includes('StudentPlayView') || id.includes('StudentProgressView') || id.includes('StudentLiveView') || id.includes('StudentTutorView') || id.includes('StudentPortfolioView')) {
                  return 'view-student-core';
                }
                if (id.includes('MaterialsGeneratorView') || id.includes('AnnualPlanGeneratorView') || id.includes('LessonPlanEditorView')) {
                  return 'view-teacher-generator';
                }
                if (id.includes('TeacherAnalyticsView') || id.includes('CurriculumGraphView')) {
                  return 'view-teacher-insights';
                }
                if (id.includes('SystemAdminView') || id.includes('SchoolAdminView') || id.includes('CurriculumEditorView')) {
                  return 'view-admin';
                }
                return 'view-other';
              }
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
