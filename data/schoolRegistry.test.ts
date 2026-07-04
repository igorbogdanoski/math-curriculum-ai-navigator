import { describe, it, expect } from 'vitest';
import { SCHOOL_REGISTRY } from './schoolRegistry';

describe('SCHOOL_REGISTRY — generated dataset shape', () => {
  it('contains a substantial number of entries across all three types', () => {
    expect(SCHOOL_REGISTRY.length).toBeGreaterThan(400);
  });

  it('has stable, unique ids', () => {
    const ids = SCHOOL_REGISTRY.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('id prefix matches the entry type for every entry', () => {
    for (const entry of SCHOOL_REGISTRY) {
      expect(entry.id.startsWith(`${entry.type}-`)).toBe(true);
    }
  });

  it('every entry has a non-empty name and municipality', () => {
    for (const entry of SCHOOL_REGISTRY) {
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.municipality.trim().length).toBeGreaterThan(0);
    }
  });

  it('primary and secondary schools have an address; VET centers have a website instead', () => {
    const primaryAndSecondary = SCHOOL_REGISTRY.filter(s => s.type === 'primary' || s.type === 'secondary');
    const withAddress = primaryAndSecondary.filter(s => s.address);
    // Not every row has an address in the source data, but the overwhelming majority should.
    expect(withAddress.length / primaryAndSecondary.length).toBeGreaterThan(0.9);

    const vetCenters = SCHOOL_REGISTRY.filter(s => s.type === 'vet');
    expect(vetCenters.length).toBe(7);
    for (const vet of vetCenters) {
      expect(vet.website).toMatch(/^https?:\/\//);
    }
  });

  it('spot-checks known real schools from the source data', () => {
    const names = SCHOOL_REGISTRY.map(s => s.name);
    expect(names).toContain('ОOУ „Блаже Конески“');
    expect(names.some(n => n.includes('Јосип Броз Тито'))).toBe(true);
    expect(names.some(n => n.includes('Киро Бурназ'))).toBe(true);
  });

  it('has plausible per-type counts (primary > secondary > vet)', () => {
    const byType = (t: string) => SCHOOL_REGISTRY.filter(s => s.type === t).length;
    expect(byType('primary')).toBeGreaterThan(byType('secondary'));
    expect(byType('secondary')).toBeGreaterThan(byType('vet'));
  });
});
