import { describe, it, expect } from 'vitest';
import { educationalHints, formatPedagogicalModelsReference } from './educationalModelsInfo';

describe('formatPedagogicalModelsReference', () => {
  it('includes every pedagogical model\'s title', () => {
    const ref = formatPedagogicalModelsReference();
    for (const model of Object.values(educationalHints.pedagogicalModels)) {
      expect(ref).toContain(model.title);
    }
  });

  it('instructs the model to recommend one, not list all', () => {
    const ref = formatPedagogicalModelsReference();
    expect(ref).toMatch(/ЕДЕН/);
  });

  it('is self-delimited so it reads correctly regardless of surrounding wrapper text', () => {
    const ref = formatPedagogicalModelsReference();
    expect(ref).toMatch(/^=== ПЕДАГОШКИ РЕФЕРЕНТЕН МАТЕРИЈАЛ/);
    expect(ref).toMatch(/=== КРАЈ НА ПЕДАГОШКИ РЕФЕРЕНТЕН МАТЕРИЈАЛ ===$/);
  });
});
