import { Language } from './index';
import { mk } from './translations.mk';
import { sq } from './translations.sq';
import { tr } from './translations.tr';
import { en } from './translations.en';

export const translations: Partial<Record<Language, Record<string, string>>> = { mk, sq, tr, en };
