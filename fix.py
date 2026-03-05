import re

file_path = 'components/dashboard/WeeklySchedule.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'export const WeeklySchedule: React.FC = () => {', 
    'export const WeeklySchedule: React.FC = () => {\n    const { t } = useLanguage();'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done again")
