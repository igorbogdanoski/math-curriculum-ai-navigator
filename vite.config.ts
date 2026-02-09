import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });
          const { model, contents, config } = await readBody(req);

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          const stream = await ai.models.generateContentStream({ model, contents, config });
          for await (const chunk of stream) {
            if (chunk.text) {
              res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
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
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });
          const { model, contents, config } = await readBody(req);

          const response = await ai.models.generateContent({ model, contents, config });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ text: response.text || '', candidates: response.candidates }));
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
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        tailwindcss(),
        react(),
        // Only add dev proxy when GEMINI_API_KEY is available (dev mode)
        env.GEMINI_API_KEY ? geminiDevProxy(env.GEMINI_API_KEY) : undefined,
      ].filter(Boolean),
      // NOTE: API key is NO LONGER injected into the client bundle.
      // In production, requests go through /api/gemini (Vercel serverless function).
      // In development, requests go through the Vite dev middleware above.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
