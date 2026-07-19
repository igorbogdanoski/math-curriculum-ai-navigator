/**
 * Single source of truth for display pricing/contact info shown across
 * PricingView, UpgradeModal, and SchoolPricingView. Added 2026-07-19
 * (Wave 7.1, audit_2026_07_18_full_app_review) after PricingView and
 * UpgradeModal drifted to two different Pro prices (1500 vs 1200 MKD/year)
 * and two different contact emails for school/B2B inquiries.
 *
 * This does NOT control the actual amount charged — that's whatever
 * STRIPE_PRO_PRICE_ID points to in Stripe (see api/stripe-checkout.ts).
 * Keep this in sync with the real Stripe price manually.
 */

export const PRO_PRICE_MKD = 1500;
export const PRO_PRICE_MONTHLY = Math.round(PRO_PRICE_MKD / 12);

export const BANK_ACCOUNT = '210501596102457';
export const BANK_NAME = 'НЛБ Банка';
export const BANK_RECIPIENT = 'Игор Богданоски';

/** Used for all support/billing/school-license contact links across the app. */
export const SUPPORT_EMAIL = 'bogdanoskiigor@gmail.com';
