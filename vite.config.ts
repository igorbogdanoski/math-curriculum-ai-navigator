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
      },
      plugins: [
        tailwindcss(),
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['vite.svg'],
          manifest: {
            short_name: "Math Nav",
            name: "Math Curriculum AI Navigator",
            description: "Педагошки AI систем за наставници по математика (VI-IX одд.)",
            lang: "mk",
            dir: "ltr",
            icons: [
              {
                src: "/vite.svg",
                type: "image/svg+xml",
                sizes: "192x192 512x512",
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
            maximumFileSizeToCacheInBytes: 4000000, 
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
                urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'jsdelivr-cdn-cache',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        }),
        // Only add dev proxy when API key is available (dev mode)
        apiKey ? geminiDevProxy(apiKey) : undefined,
        // process.env.SENTRY_AUTH_TOKEN ? sentryVitePlugin({
        //   org: 'math-nav-org', // placeholder, configures auth token locally
        //   project: 'math-nav',
        //   authToken: process.env.SENTRY_AUTH_TOKEN,
        // }) : undefined,
      ].filter(Boolean) as Plugin[],
      // NOTE: API key is NO LONGER injected into the client bundle.
      // In production, requests go through /api/gemini (Vercel serverless function).
      // In development, requests go through the Vite dev middleware above.
      build: {
        // sourcemap: true, // commented out to test build crashes
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-firebase-app': ['firebase/app'],
              'vendor-firebase-auth': ['firebase/auth'],
              'vendor-firebase-firestore': ['firebase/firestore'],
              'vendor-firebase-storage': ['firebase/storage'],
              'vendor-zod': ['zod'],
              'vendor-pdf': ['@react-pdf/renderer'],
              'vendor-docx': ['docx']
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
