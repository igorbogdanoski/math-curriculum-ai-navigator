import React from 'react';

// ─── Math helpers ─────────────────────────────────────────────────────────────
export type Pt = [number, number];

export function dist(a: Pt, b: Pt): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
}
export function angleDeg(a: Pt, vertex: Pt, b: Pt): number {
  const ua = [a[0] - vertex[0], a[1] - vertex[1]];
  const ub = [b[0] - vertex[0], b[1] - vertex[1]];
  const dot = ua[0] * ub[0] + ua[1] * ub[1];
  const mag = Math.sqrt(ua[0] ** 2 + ua[1] ** 2) * Math.sqrt(ub[0] ** 2 + ub[1] ** 2);
  if (mag < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}
export function triArea(pts: Pt[]): number {
  const [A, B, C] = pts;
  return Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
}
export function foot(p: Pt, a: Pt, b: Pt): Pt {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const ap = [p[0] - a[0], p[1] - a[1]];
  const denom = ab[0] ** 2 + ab[1] ** 2;
  if (denom < 1e-9) return a;
  const t = (ap[0] * ab[0] + ap[1] * ab[1]) / denom;
  return [a[0] + t * ab[0], a[1] + t * ab[1]];
}
export function midpoint(a: Pt, b: Pt): Pt { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
export function fmtNum(n: number, dec = 1): string { return isFinite(n) ? n.toFixed(dec) : '—'; }

// ─── Shared curriculum badge ──────────────────────────────────────────────────
export interface CurRef { primary?: string[]; gymnasium?: string[]; vocational?: string[]; }
export function CurrBadges({ cur }: { cur: CurRef }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {cur.primary?.map(p => <span key={p} className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН {p} одд.</span>)}
      {cur.gymnasium?.map(g => <span key={g} className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. {g}</span>)}
      {cur.vocational?.map(v => <span key={v} className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">{v}</span>)}
    </div>
  );
}