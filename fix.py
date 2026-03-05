with open('components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(r"{t(\'sidebar_logout\')}", "{t('sidebar_logout')}")

with open('components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
