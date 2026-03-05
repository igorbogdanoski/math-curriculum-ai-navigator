import re

file_path = 'components/dashboard/WeeklySchedule.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add const { t } = useLanguage(); inside WeeklySchedule if missing
if 'export const WeeklySchedule' in content:
    content = re.sub(r'(export const WeeklySchedule:\s*React\.FC\s*=\s*\(\)\s*=>\s*\{)', r'\1\n    const { t } = useLanguage();\n', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Weekly fixed")
