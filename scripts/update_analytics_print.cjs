const fs = require('fs');
let code = fs.readFileSync('views/TeacherAnalyticsView.tsx', 'utf8');

// 1. Add imports
code = code.replace(
    /import { LeagueTab } from '.\/analytics\/LeagueTab';/,
    `import { LeagueTab } from './analytics/LeagueTab';\nimport { useReactToPrint } from 'react-to-print';\nimport { PrintableEDnevnikReport } from '../components/analytics/PrintableEDnevnikReport';\nimport { Printer } from 'lucide-react';`
);

// 2. Add print logic inside component
code = code.replace(
    /const \[isLoadingMore, setIsLoadingMore\] = useState\(false\);/,
    `const [isLoadingMore, setIsLoadingMore] = useState(false);\n    const printRef = React.useRef<HTMLDivElement>(null);\n    const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: \`e-dnevnik-report-\${new Date().toISOString().slice(0, 10)}\` });`
);

// 3. Add print button next to "За Е-Дневник (МОН)"
const printButtonHtml = `
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={results.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-bold transition active:scale-95 disabled:opacity-40 shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Печати Извештај (PDF)
                    </button>
                    <div style={{ display: 'none' }}><PrintableEDnevnikReport ref={printRef} results={results} /></div>`;

// Wait, the "За Е-Дневник (МОН)" we just added might not be easily matched if the indentation differs. Let's find it.
// We added this match in the prev script:
// <button
//                       type="button"
//                       onClick={handleEDnevnikExport}
// ...
// За Е-Дневник (МОН)
//                   </button>
code = code.replace(
    /За Е-Дневник \(МОН\)\n\s*<\/button>/,
    match => match + printButtonHtml
);

fs.writeFileSync('views/TeacherAnalyticsView.tsx', code);
