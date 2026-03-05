import re

with open('components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Ensure we import useLanguage
if 'import { useLanguage }' not in text:
    text = "import { useLanguage } from '../i18n/LanguageContext';\n" + text

# Ensure hook is inside
if 'const { t } = useLanguage();' not in text:
    text = re.sub(
        r'(export const Sidebar: React\.FC<SidebarProps> = \(\{ isMobileOpen, setIsMobileOpen \}\) => \{)',
        r'\1\n  const { t } = useLanguage();\n',
        text
    )

text = re.sub(
    r"user\?\.name \|\| '[^']+'",
    r"user?.name || t('dashboard_default_user')",
    text
)

# Look for the logout button text. It has something like ÃÅ¾... in it.
# We will just replace between the button attributes and button close tag
text = re.sub(
    r'(className="text-xs text-gray-500 hover:text-brand-primary transition-colors"\s*>)[^<]*(</button>)',
    r'\1\n                      {t(\'sidebar_logout\')}\n                    \2',
    text,
    flags=re.DOTALL
)

with open('components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated Sidebar cleanly")
