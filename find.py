import os

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                try:
                    content = f.read()
                    if 'generateLessonPlanIdeas' in content:
                        print(os.path.join(root, file))
                except Exception:
                    pass
