// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  isRecoveryWorksheetEnabled,
  RECOVERY_WORKSHEET_KEY,
  setRecoveryWorksheetEnabled,
} from './core';

describe('recovery worksheet feature flag', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to disabled when localStorage is empty', () => {
    expect(isRecoveryWorksheetEnabled()).toBe(false);
  });

  it('persists enabled state to localStorage', () => {
    setRecoveryWorksheetEnabled(true);
    expect(window.localStorage.getItem(RECOVERY_WORKSHEET_KEY)).toBe('true');
    expect(isRecoveryWorksheetEnabled()).toBe(true);
  });

  it('persists disabled state to localStorage', () => {
    setRecoveryWorksheetEnabled(true);
    setRecoveryWorksheetEnabled(false);
    expect(window.localStorage.getItem(RECOVERY_WORKSHEET_KEY)).toBe('false');
    expect(isRecoveryWorksheetEnabled()).toBe(false);
  });
});