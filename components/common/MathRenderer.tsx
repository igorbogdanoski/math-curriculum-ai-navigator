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

// Converts a string with double backslashes for JS to single backslashes for standard LaTeX
const convertToStandardLatex = (text: string): string => {
    if (!text) return "";
    
    let processed = text;
    
    // 1. Handle double escaped backslashes common in JSON (\\\\ -> \)
    processed = processed.replace(/\\\\\\\\/g, '\\').replace(/\\\\/g, '\\');
    
    // 2. Fix common AI issues like \ frac instead of \frac
    processed = processed.replace(/\\ /g, '\\');
    
    // 3. Ensure mathematical environments like {matrix} or {align} have proper spacing
    processed = processed.replace(/\\begin\{/g, '\n\\begin{').replace(/\\end\{/g, '\\end{\n');
    
    return processed;
};

// Custom styles for KaTeX elements to ensure they look great on all screens
const katexOptions = {
    throwOnError: false,
    strict: false,
    trust: true,
    macros: {
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}"
    }
};


const InlineMathRenderer: React.FC<{ text: string }> = React.memo(({ text }) => {
    // Regex to split by markdown bold/italic/code and KaTeX inline delimiters ($...$ and \(...\))
    // Improved to handle common edge cases and allow spaces inside $...$
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\$(?!\$)[^\$]+?\$|\\\(.*?\\\))/g);

    return (
        <>
            {parts.map((part, index) => {
                if (!part) return null;
                
                let math;
                let isMath = false;

                if (part.startsWith('$') && part.endsWith('$')) {
                    math = part.substring(1, part.length - 1);
                    isMath = true;
                } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
                    math = part.substring(2, part.length - 2);
                    isMath = true;
                }

                if (isMath && math) {
                    let html;
                    try {
                        if (window.katex) {
                            html = window.katex.renderToString(convertToStandardLatex(math), { ...katexOptions, displayMode: false });
                        } else {
                             // Fallback if KaTeX isn't loaded
                            return <code key={index} className="font-mono text-sm bg-gray-100 text-gray-800 rounded px-1 border border-gray-200" title="Unrendered math">{math}</code>;
                        }
                    } catch (e: any) {
                        console.warn("KaTeX inline rendering error:", e.message, "for content:", math);
                        html = `<span class="text-red-600 font-mono bg-red-100 p-1 rounded" title="${e.message}">${math}</span>`;
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
    
    // If KaTeX is not loaded and we've waited long enough, render raw text with visual cue
    if (!isKatexLoaded) {
        if (hasTimedOut) {
             return <code className="font-mono text-gray-800 bg-gray-100 p-1 rounded block whitespace-pre-wrap">{text.replace(/\\/g, '')}</code>;
        }
        // While loading
        return <span className="animate-pulse bg-gray-200 rounded text-transparent select-none">{text}</span>;
    }

    const blocks = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\])/g);

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
                            html = window.katex.renderToString(convertToStandardLatex(math), { ...katexOptions, displayMode: true });
                        } catch (e: any) {
                            console.warn("KaTeX block rendering error:", e.message, "for content:", math);
                            html = `<div class="text-red-600 font-mono bg-red-100 p-2 rounded" title="${e.message}">${math}</div>`;
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