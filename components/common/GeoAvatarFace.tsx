import React from 'react';

export type GeoAvatarState = 'idle' | 'thinking' | 'explaining';

interface GeoAvatarFaceProps {
    state: GeoAvatarState;
    size?: 'fab' | 'panel';
    className?: string;
}

const ORBIT_GLYPHS = ['Σ', 'π', '∫'];

/**
 * "Geo" — the Math Tutor's face. Pure SVG + CSS (no Lottie/Rive dependency yet).
 * Swapping in a real Rive/Lottie asset later only means replacing this component's
 * internals — callers just pass `state` and `size`, nothing else changes.
 */
export const GeoAvatarFace: React.FC<GeoAvatarFaceProps> = ({ state, size = 'fab', className = '' }) => {
    const dims = size === 'fab' ? 40 : 56;

    return (
        <div
            className={`geo-avatar geo-avatar--${state} ${className}`}
            style={{ width: dims, height: dims }}
            aria-hidden="true"
        >
            {state === 'thinking' && (
                <div className="geo-avatar__orbit">
                    {ORBIT_GLYPHS.map((glyph, i) => (
                        <span key={glyph} className="geo-avatar__glyph" style={{ ['--geo-i' as string]: i }}>
                            {glyph}
                        </span>
                    ))}
                </div>
            )}
            <svg viewBox="0 0 100 100" className="geo-avatar__shape">
                <defs>
                    <linearGradient id="geo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--color-brand-accent)" />
                        <stop offset="55%" stopColor="var(--color-brand-secondary)" />
                        <stop offset="100%" stopColor="var(--color-brand-primary)" />
                    </linearGradient>
                </defs>
                {/* Flattened hexagon silhouette */}
                <polygon
                    points="50,4 92,27 92,73 50,96 8,73 8,27"
                    fill="url(#geo-gradient)"
                    className="geo-avatar__body"
                />
                <circle cx="36" cy="46" r="6" fill="white" className="geo-avatar__eye geo-avatar__eye--left" />
                <circle cx="64" cy="46" r="6" fill="white" className="geo-avatar__eye geo-avatar__eye--right" />
                <path
                    d={state === 'explaining' ? 'M 36 64 Q 50 76 64 64' : 'M 38 64 Q 50 70 62 64'}
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                    className="geo-avatar__mouth"
                />
            </svg>
        </div>
    );
};
