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

# Fix user text
# \x{00C3}\x{008A}\x{00C3}\x{00BE}\x{00C3}\x{201A}\x{00C2}\x{00B8}...
# The mojibake is from reading it. I will look for the text around it: 
text = re.sub(
    r"user\?\.name \|\| '[^']+'",
    r"user?.name || t('dashboard_default_user')",
    text
)

text = re.sub(
    r"className=\"text-xs text-gray-500 hover:text-brand-primary transition-colors\"[^>]*>.*?<\/button>",
    r"className=\"text-xs text-gray-500 hover:text-brand-primary transition-colors\"\n                    >\n                      {t('sidebar_logout')}\n                    </button>",
    text,
    flags=re.DOTALL
)

with open('components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated Sidebar")
