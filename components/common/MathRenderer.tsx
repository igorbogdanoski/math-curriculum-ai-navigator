import React, { useState, useEffect } from 'react';

declare global {
    interface Window {
        katex: {
            renderToString(latex: string, options?: any): string;
        };
    }
}

interface MathRendererProps {
  text: string | null | undefined;
}

/**
 * Auto-detect bare LaTeX commands outside math delimiters and wrap them in $...$.
 * Handles cases where AI omits $ delimiters around math expressions.
 * Runs on non-math segments only (text not already inside $...$ or $$...$$).
 */
function wrapBareLatex(text: string): string {
    // Split by existing math delimiters — captured groups land at odd indices
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g);

    return parts.map((part, i) => {
        if (i % 2 === 1) return part; // already-delimited math, keep as-is

        // One level of nested braces: matches {abc}, {a{bc}d}
        const b = '\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}';

        // Single-pass regex matching all common bare LaTeX patterns
        const pattern = new RegExp(
            '(?:' +
            // \frac{...}{...}  with optional leading number (e.g., 2\frac{1}{3})
            `(?:\\d+(?:[.,]\\d+)?\\s*)?\\\\frac${b}${b}` + '|' +
            // \sqrt[...]{...}  or  \sqrt{...}
            `\\\\sqrt(?:\\[[^\\]]*\\])?${b}` + '|' +
            // number + \text{...}  (units injected by step 2.5, e.g., 11\text{ km})
            `\\d+(?:[.,]\\d+)?\\s*\\\\text${b}` + '|' +
            // Decorator commands with one brace arg: \mathbb{R}, \overline{AB}, etc.
            `\\\\(?:text|mathbb|overline|underline|hat|vec|bar|tilde)${b}` + '|' +
            // Bare superscript / subscript: x^{2}, a_{n}, x^2, a_1
            `[a-zA-Zа-яА-Я](?:\\^|_)(?:${b}|\\d+)` + '|' +
            // Standalone symbols (no brace args)
            '\\\\(?:cdot|times|div|pm|mp|leq|geq|neq|approx|infty|circ|angle|triangle|perp|parallel|sim|' +
            'alpha|beta|gamma|delta|pi|theta|lambda|sigma|omega|phi|psi|mu|rho|tau|epsilon)(?![a-zA-Z])' +
            ')',
            'g'
        );

        return part.replace(pattern, m => '$' + m.trim() + '$');
    }).join('');
}

// Converts a string with double backslashes for JS to single backslashes for standard LaTeX.
// Pipeline: escape normalisation → space fix → unit injection → environment spacing
//           → bare-LaTeX auto-wrapping → inner-$ cleanup
const convertToStandardLatex = (text: string): string => {
    if (!text) return "";
    
    let processed = text;
    
    // 1. Handle triple/double escaped backslashes common in JSON (\\\\ -> \)
    processed = processed.replace(/\\\\\\\\/g, '\\').replace(/\\\\/g, '\\');
    
    // 2. Fix common AI issues like \ frac instead of \frac, or \ cdot
    processed = processed.replace(/\\ /g, '\\');
    
    // 2.1 Fix bare LaTeX commands missing their backslash (AI sometimes drops it)
    //     e.g., "frac{1}{2}" → "\frac{1}{2}", "sqrt{4}" → "\sqrt{4}"
    //     Commands with mandatory brace arg — only fix when followed by {
    processed = processed.replace(/(?<![a-zA-Z\\])\b(frac|sqrt|text|mathbb|overline|underline|hat|vec|bar|tilde)(?=\{)/g, '\\$1');
    //     Standalone symbols — only fix when NOT preceded by a letter or \
    processed = processed.replace(/(?<![a-zA-Z\\])\b(cdot|times|div|pm|mp|leq|geq|neq|approx|infty|circ)(?![a-zA-Z])/g, '\\$1');
    
    // 2.2 AGGRESSIVE FIX: Check for commands that should ALWAYS have a backslash inside $...$
    // Sometimes AI writes $frac{1}{2}$ which is technically invalid but we want to show it correctly.
    processed = processed.replace(/\$(.*?)\$/g, (match, inner) => {
        const fixedInner = inner.replace(/(?<!\\)\b(frac|sqrt|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|pi|theta|lambda|sigma|omega|phi|psi|mu|rho|tau|epsilon)\b/g, '\\$1');
        return `$${fixedInner}$`;
    });
    // 2.5 Fix unit issues (e.g., 11 km outside of \text{})
    // Detect numbers followed by km, m, cm etc. if they aren't already in \text
    processed = processed.replace(/(\d+(?:[.,]\d+)?)\s*(km|cm|mm|kg|mg|ml|km2|m2|cm2|км|см|мм|кг|мг|мл|км2|м2|см2|m|м|g|г|t|т|l|л|dm|дм)\b/g, '$1\\text{ $2}');
    
    // 2.6 Pull units inside math blocks if they follow immediately
    // Fixes cases like $7 + 4 = 11$ km -> $7 + 4 = 11 \text{ km}$
    processed = processed.replace(/(\$|\\\(|\\\[)\s*([\s\S]+?)\s*(\$|\\\)|\\\])\s*(km|cm|mm|kg|mg|ml|km2|m2|cm2|км|см|мм|кг|мг|мл|км2|м2|см2|m|м|g|г|t|т|l|л|dm|дм)\b/g, '$1 $2 \\text{ $4} $3');
    
    // 3. Ensure mathematical environments like {matrix} or {align} have proper spacing
    processed = processed.replace(/\\begin\{/g, '\n\\begin{').replace(/\\end\{/g, '\\end{\n');
    
    // 4. Auto-detect bare LaTeX commands not inside delimiters and wrap in $...$
    //    This catches cases where the AI forgot $ delimiters (e.g., bare \frac{1}{2})
    processed = wrapBareLatex(processed);
    
    // 5. Fix stray $ inside already-delimited math blocks
    //    e.g., $$\frac{$1$}{2}$$ → $$\frac{1}{2}$$
    processed = processed.replace(/(\$\$)([\s\S]*?)(\$\$)/g, (_, open, content, close) => {
        return open + content.replace(/\$/g, '') + close;
    });
    // For inline $...$: match non-greedily and strip inner stray $
    processed = processed.replace(/(?<!\$)\$(?!\$)([\s\S]*?)(?<!\$)\$(?!\$)/g, (_match, content) => {
        const cleaned = content.replace(/\$/g, '');
        return '$' + cleaned + '$';
    });

    return processed;
};

// Custom styles for KaTeX elements to ensure they look great on all screens
/** Escape HTML entities to prevent XSS when injecting into innerHTML */
const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const katexOptions = {
    throwOnError: false,
    strict: false,
    trust: true,
    macros: {
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\No": "\\mathbb{N}_0",
        "\\deg": "^{\\circ}",
        "\\km": "\\text{ km}",
        "\\m": "\\text{ m}",
        "\\cm": "\\text{ cm}",
        "\\mm": "\\text{ mm}",
        "\\kg": "\\text{ kg}",
        "\\g": "\\text{ g}"
    }
};


const InlineMathRenderer: React.FC<{ text: string }> = React.memo(({ text }) => {
    // Regex to split by markdown bold/italic/code and KaTeX inline delimiters ($...$ and \(...\))
    // Improved to handle common edge cases and allow spaces inside $...$
    // We use a more permissive regex for $...$ to capture expressions like $ 7 + 4 = 11 $
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\$\s*[\s\S]+?\s*\$|\\\(.*?\\\))/g);

    return (
        <>
            {parts.map((part: string, index: number) => {
                if (!part) return null;
                
                let math;
                let isMath = false;

                if (part.startsWith('$') && part.endsWith('$')) {
                    math = part.substring(1, part.length - 1).trim();
                    isMath = true;
                } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
                    math = part.substring(2, part.length - 2).trim();
                    isMath = true;
                }

                if (isMath && math) {
                    let html;
                    try {
                        if (window.katex) {
                            html = window.katex.renderToString(math, { ...katexOptions, displayMode: false });
                        } else {
                             // Fallback if KaTeX isn't loaded
                            return <code key={index} className="font-mono text-sm bg-gray-100 text-gray-800 rounded px-1 border border-gray-200" title="Unrendered math">{math}</code>;
                        }
                    } catch (e: any) {
                        console.warn("KaTeX inline rendering error:", e.message, "for content:", math);
                        html = `<span class="text-red-600 font-mono bg-red-100 p-1 rounded" title="${escapeHtml(e.message)}">${escapeHtml(math)}</span>`;
                    }
                    return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
                }
                
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index}><InlineMathRenderer text={part.substring(2, part.length - 2)} /></strong>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={index}><InlineMathRenderer text={part.substring(1, part.length - 1)} /></em>;
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={index} className="bg-gray-200 text-sm rounded px-1 py-0.5">{part.substring(1, part.length - 1)}</code>;
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </>
    );
});


export const MathRenderer: React.FC<MathRendererProps> = ({ text }) => {
    const [isKatexLoaded, setIsKatexLoaded] = useState(!!(window.katex && typeof window.katex.renderToString === 'function'));
    const [hasTimedOut, setHasTimedOut] = useState(false);

    useEffect(() => {
        if (isKatexLoaded) return;
        
        // Set a timeout to stop checking and show fallback
        const timeoutId = setTimeout(() => {
            if (!isKatexLoaded) setHasTimedOut(true);
        }, 2000);

        const checkKatex = () => {
            if (window.katex && typeof window.katex.renderToString === 'function') {
                setIsKatexLoaded(true);
                return true;
            }
            return false;
        };

        if (checkKatex()) return;

        const intervalId = setInterval(() => { 
            if (checkKatex()) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
            }
        }, 100);
        
        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
    }, [isKatexLoaded]);

    if (!text) return null;
    
    // Pre-process text to fix common issues before splitting
    const processedText = convertToStandardLatex(text);
    
    // If KaTeX is not loaded and we've waited long enough, render raw text with visual cue
    if (!isKatexLoaded) {
        if (hasTimedOut) {
             return <code className="font-mono text-gray-800 bg-gray-100 p-1 rounded block whitespace-pre-wrap">{processedText.replace(/\\/g, '')}</code>;
        }
        // While loading
        return <span className="animate-pulse bg-gray-200 rounded text-transparent select-none">{processedText}</span>;
    }

    const blocks = processedText.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\])/g);

    return (
        <>
            {blocks.map((block, index) => {
                if (!block || block.trim() === '') return null;

                try {
                    let math;
                    let isDisplayMath = false;

                    if (block.startsWith('$$') && block.endsWith('$$')) {
                        math = block.substring(2, block.length - 2);
                        isDisplayMath = true;
                    } else if (block.startsWith('\\[') && block.endsWith('\\]')) {
                        math = block.substring(2, block.length - 2);
                        isDisplayMath = true;
                    }

                    if (isDisplayMath && math !== undefined) {
                        let html;
                        try {
                            html = window.katex.renderToString(math, { ...katexOptions, displayMode: true });
                        } catch (e: any) {
                            console.warn("KaTeX block rendering error:", e.message, "for content:", math);
                            html = `<div class="text-red-600 font-mono bg-red-100 p-2 rounded" title="${escapeHtml(e.message)}">${escapeHtml(math)}</div>`;
                        }
                        return <div key={index} dangerouslySetInnerHTML={{ __html: html }} />;
                    }
                    
                    const paragraphs = block.split(/\n\s*\n/g).filter(p => p.trim() !== '');
                    return paragraphs.map((para, pIndex) => {
                        const trimmedPara = para.trim();
                        if (trimmedPara.startsWith('- ') || trimmedPara.startsWith('* ')) {
                            const items = trimmedPara.split(/\n\s*(?:-|\*)\s/).filter(Boolean);
                            return (
                                <ul key={`${index}-${pIndex}`} className="list-disc list-inside space-y-1 my-2">
                                    {items.map((item, i) => <li key={i}><InlineMathRenderer text={item.trim()} /></li>)}
                                </ul>
                            );
                        }
                        if (trimmedPara.match(/^\d+\.\s/)) {
                            const items = trimmedPara.split(/\n\s*\d+\.\s/).filter(Boolean);
                            return (
                                <ol key={`${index}-${pIndex}`} className="list-decimal list-inside space-y-1 my-2">
                                    {items.map((item, i) => <li key={i}><InlineMathRenderer text={item.trim()} /></li>)}
                                </ol>
                            );
                        }
                        return (
                            <p key={`${index}-${pIndex}`} className="my-1">
                               <InlineMathRenderer text={trimmedPara} />
                            </p>
                        );
                    });
                    
                } catch (error) {
                    console.error("Markdown rendering error:", error, "for block:", block);
                    return <p key={index}>{block}</p>;
                }
            })}
        </>
    );
};