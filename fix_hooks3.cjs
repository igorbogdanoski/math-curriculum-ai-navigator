const fs = require('fs');

const files = [
    'components/dashboard/MonthlyActivityChart.tsx',
    'components/dashboard/WeeklySchedule.tsx',
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('const { t } = useLanguage();')) {
        content = content.replace(/(export const \w+(?:\s*:\s*React\.FC<[^>]+>)?\s*=\s*\([^)]*\)\s*=>\s*\{)/, "\n  const { t } = useLanguage();\n");
        content = content.replace(/(export default function \w+\s*\([^)]*\)\s*\{)/, "\n  const { t } = useLanguage();\n");
        content = content.replace(/(export function \w+\s*\([^)]*\)\s*\{)/, "\n  const { t } = useLanguage();\n");
        fs.writeFileSync(f, content, 'utf8');
        console.log("Updated: " + f);
    }
});
