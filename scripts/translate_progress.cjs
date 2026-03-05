const fs = require('fs');

const dict = {
  mk: {
    progress: {
      thisWeek: 'Оваа недела',
      lastWeek: 'Минатата недела',
      thisMonth: 'Овој месец',
      print: 'Печати',
      home: 'Почетна',
      check: 'Провери',
      learningLevel: 'Ниво на учење',
      level: 'Лв.',
      untilNextLevel: 'до след. ниво',
      ofInClass: 'од {total} во класата',
      searchName: 'Барај по име',
      searchDesc: 'Да се види како напредува ученикот'
    }
  },
  sq: {
    progress: {
      thisWeek: 'Këtë javë',
      lastWeek: 'Javën e kaluar',
      thisMonth: 'Këtë muaj',
      print: 'Printo',
      home: 'Kreu',
      check: 'Kontrollo',
      learningLevel: 'Niveli i të nxënit',
      level: 'Niv.',
      untilNextLevel: 'deri në niv. tjetër',
      ofInClass: 'nga {total} në klasë',
      searchName: 'Kërko me emër',
      searchDesc: 'Për të parë se si përparon nxënësi'
    }
  },
  tr: {
    progress: {
      thisWeek: 'Bu hafta',
      lastWeek: 'Geçen hafta',
      thisMonth: 'Bu ay',
      print: 'Yazdır',
      home: 'Ana Sayfa',
      check: 'Kontrol Et',
      learningLevel: 'Öğrenme Seviyesi',
      level: 'Sv.',
      untilNextLevel: 'sonraki sv. kadar',
      ofInClass: 'sınıftaki {total} öğrenciden',
      searchName: 'Ada göre ara',
      searchDesc: 'Öğrencinin ilerlemesini görmek için'
    }
  }
};

let translations = fs.readFileSync('i18n/translations.ts', 'utf8');
for (const lang of ['mk', 'sq', 'tr']) {
  const block = Object.entries(dict[lang].progress)
    .map(([k, v]) => `      ${k}: '${v}',`)
    .join('\n');
  
  const searchPattern = new RegExp(`(export const ${lang}Translations = \\{[\\s\\S]*?)\\};`);
  translations = translations.replace(searchPattern, (match, p1) => {
    return p1 + `  progress: {\n${block}\n  },\n};\n`;
  });
}
fs.writeFileSync('i18n/translations.ts', translations);

let viewCode = fs.readFileSync('views/StudentProgressView.tsx', 'utf8');

// Add import
if (!viewCode.includes('useLanguage')) {
  viewCode = viewCode.replace(
    /import \{([^}]+)\} from 'lucide-react';/,
    `import { $1 } from 'lucide-react';\nimport { useLanguage } from '../contexts/LanguageContext';`
  );
  viewCode = viewCode.replace(
    /export function StudentProgressView\(\{ isReadOnly = false, studentName = '' \}\) \{/,
    `export function StudentProgressView({ isReadOnly = false, studentName = '' }) {\n  const { t } = useLanguage();`
  );
}

// Replace texts
viewCode = viewCode
  .replace(/>Оваа недела</g, `>{t('progress.thisWeek')}<`)
  .replace(/>Минатата недела</g, `>{t('progress.lastWeek')}<`)
  .replace(/>Овој месец</g, `>{t('progress.thisMonth')}<`)
  .replace(/<Printer className="w-4 h-4" \/> Печати/, `<Printer className="w-4 h-4" /> {t('progress.print')}`)
  .replace(/<Home className="w-4 h-4" \/> Почетна/, `<Home className="w-4 h-4" /> {t('progress.home')}`)
  .replace(/>\s*Провери\s*<\/button>/g, `>\n              {t('progress.check')}\n            </button>`)
  .replace(/>Ниво на учење</g, `>{t('progress.learningLevel')}<`)
  .replace(/>Лв\.{lvlInfo\.level}</g, `>{t('progress.level')} {lvlInfo.level}<`)
  .replace(/до след\. ниво:/g, `{t('progress.untilNextLevel')}:`)
  .replace(/од \{classRank\.total\} во класата/g, `{t('progress.ofInClass').replace('{total}', classRank.total.toString())}`)
  .replace(/>\?\?\?\?\? \?\? \?\?\?\?\?\? ime</g, `>{t('progress.searchName')}<`)
  .replace(/>\?\? \?\?\?\?\?\? \?\?\?\? \?\?\?\?\?\? \?\?\?\?\?\?\?\?</g, `>{t('progress.searchDesc')}<`);

fs.writeFileSync('views/StudentProgressView.tsx', viewCode);
console.log('Progress view updated');
