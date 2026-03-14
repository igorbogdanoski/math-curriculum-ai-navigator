import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VertexAI } from "@google-cloud/vertexai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

// Helper for Google Cloud Auth from Base64 String
const getCredentials = () => {
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (!b64) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_BASE64');
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
};

let vertexAIInstance: VertexAI | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return;

  const { model, contents } = validated;

  try {
    if (!vertexAIInstance) {
      const credentials = getCredentials();
      vertexAIInstance = new VertexAI({
        project: credentials.project_id,
        location: 'us-central1',
        googleAuthOptions: {
          credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
          }
        }
      });
    }

    const modelInstance = vertexAIInstance.getGenerativeModel({ 
      model: model || 'text-embedding-004' 
    });
    
    // Vertex AI expectation: array of content parts
    // Cast to any to bypass TS error if the SDK version has a discrepancy in type definitions
    const result = await (modelInstance as any).embedContent({
      content: { role: 'user', parts: contents as any[] }
    });
    
    return res.status(200).json({ embeddings: result.embeddings[0] });
  } catch (error: any) {
    console.error('[/api/gemini-embed] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
