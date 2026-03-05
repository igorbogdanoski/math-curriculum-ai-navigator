import re

file_path = 'components/dashboard/WeeklySchedule.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add const { t } = useLanguage(); inside AgendaItem
content = re.sub(
    r'(const AgendaItem: React\.FC<\{ item: PlannerItem; onClick: \(\) => void; \}> = \(\{ item, onClick \}\) => \{)', 
    r'\1\n    const { t } = useLanguage();\n', 
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("AgendaItem fixed")
