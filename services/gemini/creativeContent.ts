import {
  Type, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, sanitizePromptInput,
} from './core';
import { pedagogyAPI } from './pedagogy';
import type {
  TeachingProfile, MultiLangText, AIGeneratedStoryBook, AIGeneratedTechnicalInfographic,
  AIGeneratedTechnicalInfographicSection,
} from '../../types';

/**
 * Text is always generated pre-translated into all 4 app languages in one JSON call —
 * the image is generated exactly once (English-only visual description, explicitly
 * instructed to contain no text/words/labels at all) and reused across every
 * language, since no image-generation model (Gemini included) is reliable for dense,
 * correctly-spelled text — especially Cyrillic — baked into pixels. Switching the
 * displayed language is just picking a different key from this object; it never
 * regenerates the image.
 */
const MULTI_LANG_TEXT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    en: { type: Type.STRING },
    mk: { type: Type.STRING },
    sq: { type: Type.STRING },
    tr: { type: Type.STRING },
  },
  required: ['en', 'mk', 'sq', 'tr'],
};

const NO_TEXT_SUFFIX = 'No text, no words, no letters, no numbers, no labels, no captions, '
  + 'no watermark anywhere in the image — pure visual illustration only.';

interface StoryBookDraft {
  title: MultiLangText;
  pages: { sceneDescription: string; caption: MultiLangText }[];
}

interface InfographicDraft {
  title: MultiLangText;
  visualPrompt: string;
  sections: AIGeneratedTechnicalInfographicSection[];
}

export const creativeContentAPI = {

  async generateStoryBook(
    topic: string,
    ageRange: string,
    pageCount: number,
    profile?: TeachingProfile,
  ): Promise<AIGeneratedStoryBook> {
    const safeTopic = sanitizePromptInput(topic, 200);
    const clampedPageCount = Math.min(10, Math.max(4, Math.round(pageCount) || 6));

    const prompt = `You are a bestselling children's picture-book author and a math educator.
Write a ${clampedPageCount}-page illustrated math picture book for children aged ${ageRange},
teaching the concept: "${safeTopic}".

For EACH of the ${clampedPageCount} pages, provide:
- sceneDescription: an ENGLISH-ONLY visual description of the illustration for that page
  (characters, setting, action — describe ONLY what should be drawn, never any words/text
  that should appear in the image itself).
- caption: 1-2 short, warm, age-appropriate sentences narrating that page, translated into
  all 4 languages (en, mk, sq, tr). Macedonian/Albanian/Turkish must read as natural,
  correct translations written by a fluent speaker — not literal machine translation.

Also provide an overall book title, translated into all 4 languages.

Keep the story arc coherent across pages (beginning → middle → satisfying end) and make the
math concept concrete through the story's events, not just stated as a fact.

Return ONLY JSON, no markdown.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: MULTI_LANG_TEXT_SCHEMA,
        pages: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneDescription: { type: Type.STRING },
              caption: MULTI_LANG_TEXT_SCHEMA,
            },
            required: ['sceneDescription', 'caption'],
          },
        },
      },
      required: ['title', 'pages'],
    };

    const draft = await generateAndParseJSON<StoryBookDraft>(
      [{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined, profile?.tier,
    );

    const pages = await Promise.all(
      draft.pages.slice(0, clampedPageCount).map(async (page) => {
        const visualPrompt = `Children's picture-book illustration, warm and colorful, `
          + `friendly art style suitable for ages ${ageRange}: ${page.sceneDescription}. ${NO_TEXT_SUFFIX}`;
        const illustration = await pedagogyAPI.generateIllustration(visualPrompt);
        return { imageUrl: illustration.imageUrl, caption: page.caption };
      }),
    );

    return { title: draft.title, ageRange, pages };
  },

  async generateTechnicalInfographic(
    topic: string,
    profile?: TeachingProfile,
  ): Promise<AIGeneratedTechnicalInfographic> {
    const safeTopic = sanitizePromptInput(topic, 200);

    const prompt = `You are a technical writer and engineering-textbook illustrator creating an
educational infographic about: "${safeTopic}" (a math/science concept, tool, instrument, or
geometric object).

Provide:
- title: a short, clear title, translated into all 4 languages (en, mk, sq, tr).
- visualPrompt: an ENGLISH-ONLY description of a photorealistic or clean 3D-render image of
  the object/concept for the central illustration — describe ONLY its visual appearance,
  shape, and material; never describe any text/labels that should appear in the image.
- sections: 5-7 content panels covering (as applicable): Overview, How It Works, Key
  Components, Specifications, Materials, Real-World Applications, Did You Know. Each section
  has a short "key" (lowercase english slug, e.g. "overview"), a heading (2-5 words), and a
  body (2-3 sentences) — heading and body both translated into all 4 languages, natural and
  correct in each, not literal machine translation.

Every section must be scientifically/mathematically accurate and suitable for a classroom.

Return ONLY JSON, no markdown.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: MULTI_LANG_TEXT_SCHEMA,
        visualPrompt: { type: Type.STRING },
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING },
              heading: MULTI_LANG_TEXT_SCHEMA,
              body: MULTI_LANG_TEXT_SCHEMA,
            },
            required: ['key', 'heading', 'body'],
          },
        },
      },
      required: ['title', 'visualPrompt', 'sections'],
    };

    const draft = await generateAndParseJSON<InfographicDraft>(
      [{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined, profile?.tier,
    );

    const visualPrompt = `Photorealistic or clean 3D-render engineering illustration on a `
      + `pure white background: ${draft.visualPrompt}. ${NO_TEXT_SUFFIX}`;
    const illustration = await pedagogyAPI.generateIllustration(visualPrompt);

    return { title: draft.title, imageUrl: illustration.imageUrl, sections: draft.sections };
  },

};
