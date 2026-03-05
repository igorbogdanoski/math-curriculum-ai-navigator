const fs = require('fs');
const glob = require('fs').readdirSync;

const cyrillicPattern = /[\u0400-\u04FF]+/;
const extractCyrillicLines = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let results = [];
    lines.forEach((l, i) => {
        if (cyrillicPattern.test(l)) results.push((i+1) + ': ' + l.trim());
    });
    if (results.length > 0) {
        console.log('--- ' + filePath + ' ---');
        console.log(results.join('\n'));
    }
};

const components = [
    'components/dashboard/MonthlyActivityChart.tsx',
    'components/dashboard/TopicCoverageChart.tsx',
    'components/dashboard/OverallProgress.tsx',
    'components/dashboard/WeeklySchedule.tsx',
    'components/dashboard/StandardsCoverageCard.tsx',
    'components/dashboard/WeakConceptsWidget.tsx',
    'components/home/QuickAIStart.tsx',
    'components/home/ContinueBrowsing.tsx'
];

components.forEach(extractCyrillicLines);
