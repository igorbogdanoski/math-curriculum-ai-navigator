import re

files_to_fix = [
    'components/dashboard/MonthlyActivityChart.tsx',
    'components/dashboard/WeeklySchedule.tsx'
]

for fp in files_to_fix:
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'const { t } = useLanguage();' not in content:
        # For MonthlyActivityChart
        content = re.sub(
            r'(export const MonthlyActivityChart: React\.FC<MonthlyActivityChartProps> = \(\{ data \}\) => \{)', 
            r'\1\n  const { t } = useLanguage();\n', 
            content
        )
        
        # For WeeklySchedule
        content = re.sub(
            r'(export const WeeklySchedule: React\.FC = \(\) => \{)', 
            r'\1\n  const { t } = useLanguage();\n', 
            content
        )
        
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
print("Hooks injected perfectly")
