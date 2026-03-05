const fs = require('fs');

let content = fs.readFileSync('views/TeacherAnalyticsView.tsx', 'utf8');

const helperFn = `
    const calculateGrade = (percentage: number): number => {
        if (percentage < 30) return 1;
        if (percentage < 50) return 2;
        if (percentage < 70) return 3;
        if (percentage < 85) return 4;
        return 5;
    };

    const handleEDnevnikExport = () => {
        const rows: string[][] = [
            ['Ученик / Идентификатор', 'Квиз / Тема', 'Поени', 'Макс. Поени', 'Процент', 'Оценка (Е-Дневник)', 'Датум'],
            ...results.map(r => {
                const perc = Math.round(r.percentage);
                const grade = calculateGrade(perc);
                return [
                    r.studentName || 'Анонимен',
                    r.quizTitle,
                    String(r.correctCount),
                    String(r.totalQuestions),
                    \`\${perc}%\`,
                    String(grade),
                    r.playedAt?.toDate?.()?.toLocaleDateString('mk-MK') || ''
                ];
            }),
        ];
        const csv = rows.map(row =>
            row.map(cell => cell.includes(',') || cell.includes('"') || /[\\r\\n]/.test(cell)
                ? \`"\${cell.replace(/"/g, '""').replace(/[\\r\\n]+/g, ' ')}"\` : cell
            ).join(',')
        ).join('\\n');
        
        // Use standard CSV MIME type with UTF-8 BOM for Excel Cyrillic support
        const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`e-dnevnik-ocenki-\${new Date().toISOString().slice(0, 10)}.csv\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addNotification('Експортот за Е-Дневник е успешно преземен', 'success');
    };
`;

const anchor = "const handleExportCSV = () => {";
content = content.replace(anchor, helperFn + '\n    ' + anchor);

// Now patch the UI 
// Find the button group
// <button type="button" onClick={handleExportCSV}
// We will place the new button next to it. Also there is "import { Download, RefreshCw, etc }" we might want to use a different icon like "FileSpreadsheet" or "GraduationCap" or just "Download".
content = content.replace(
    /onClick=\{handleExportCSV\}[\s\S]*?\{t\('analytics.exportCsv'\)\}\n\s*<\/button>/,
    match => match + `
                  <button
                      type="button"
                      onClick={handleEDnevnikExport}
                      disabled={results.length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-bold transition active:scale-95 disabled:opacity-40 shadow-sm"
                  >
                      <Download className="w-4 h-4" />
                      За Е-Дневник (МОН)
                  </button>`
);

fs.writeFileSync('views/TeacherAnalyticsView.tsx', content);
