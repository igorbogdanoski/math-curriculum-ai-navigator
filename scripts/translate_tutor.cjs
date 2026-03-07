const fs = require('fs');

const dict = {
  mk: {
    tutor: {
      greeting: 'Здраво! Јас сум твојот AI тутор по математика. Тука сум да ти помогнам да ги разбереш лекциите, но нема да ти ги решам задачите наместо тебе. Што учиме денес?',
      error: 'Извини, се појави проблем при поврзувањето. Те молам обиди се повторно.',
      title: 'Тутор по Математика',
      subtitle: 'Безбедно учење • Објаснува, не решава',
      placeholder: 'Прашај нешто... на пр. "Како се собираат дропки со различен именител?"',
      disclaimer: 'AI туторот може да греши. Секогаш проверувај ги информациите.'
    }
  },
  sq: {
    tutor: {
      greeting: 'Përshëndetje! Unë jam tutori yt AI i matematikës. Jam këtu për të të ndihmuar të kuptosh mësimet, por nuk do t\'i zgjidh detyrat për ty. Çfarë do të mësojmë sot?',
      error: 'Më falni, pati një problem me lidhjen. Ju lutemi provoni përsëri.',
      title: 'Tutor i Matematikës',
      subtitle: 'Mësim i sigurt • Shpjegon, nuk zgjidh',
      placeholder: 'Pyet diçka... p.sh. "Si të mbledhim thyesa me emërues të ndryshëm?"',
      disclaimer: 'Tutori AI mund të bëjë gabime. Gjithmonë kontrolloni informacionin.'
    }
  },
  tr: {
    tutor: {
      greeting: 'Merhaba! Ben senin AI matematik öğretmeninim. Dersleri anlamana yardımcı olmak için buradayım, ancak senin yerine ödevleri çözmeyeceğim. Bugün ne öğreniyoruz?',
      error: 'Özür dilerim, bağlantıda bir sorun oluştu. Lütfen tekrar deneyin.',
      title: 'Matematik Öğretmeni',
      subtitle: 'Güvenli Öğrenme • Açıklar, çözmez',
      placeholder: 'Bir şey sor... ör. "Farklı paydalı kesirler nasıl toplanır?"',
      disclaimer: 'AI öğretmeni hata yapabilir. Bilgileri her zaman kontrol edin.'
    }
  }
};

let translations = fs.readFileSync('i18n/translations.ts', 'utf8');
for (const lang of ['mk', 'sq', 'tr']) {
  const block = Object.entries(dict[lang].tutor)
    .map(([k, v]) => `      ${k}: '${v.replace(/'/g, "\\'")}',`)
    .join('\n');
  
  const searchPattern = new RegExp(`(export const ${lang}Translations = \\{[\\s\\S]*?)\\};`);
  translations = translations.replace(searchPattern, (match, p1) => {
    return p1 + `  tutor: {\n${block}\n  },\n};\n`;
  });
}
fs.writeFileSync('i18n/translations.ts', translations);

let viewCode = fs.readFileSync('views/StudentTutorView.tsx', 'utf8');

if (!viewCode.includes('useLanguage')) {
  viewCode = viewCode.replace(
    /import \{([^}]+)\} from 'lucide-react';/,
    `import { $1 } from 'lucide-react';\nimport { useLanguage } from '../i18n/LanguageContext';`
  );
  viewCode = viewCode.replace(
    /export const StudentTutorView: React\.FC = \(\) => \{/,
    `export const StudentTutorView: React.FC = () => {\n  const { t } = useLanguage();`
  );
}

viewCode = viewCode
  .replace(/Здраво! Јас сум твојот AI тутор по математика\. Тука сум да ти помогнам да ги разбереш лекциите, но нема да ти ги решам задачите наместо тебе\. Што учиме денес\?/, `{t('tutor.greeting')}`)
  .replace(/>Извини, се појави проблем при поврзувањето\. Те молам обиди се повторно\.</g, `>{t('tutor.error')}<`)
  .replace(/>\s*Тутор по Математика\s*</g, `>{t('tutor.title')}<`)
  .replace(/>\s*Безбедно учење • Објаснува, не решава\s*</g, `>{t('tutor.subtitle')}<`)
  .replace(/placeholder="Прашај нешто\.\.\. на пр\. \\"Како се собираат дропки со различен именител\?\\""/g, `placeholder={t('tutor.placeholder')}`)
  .replace(/>\s*AI туторот може да греши\. Секогаш проверувај ги информациите\.\s*</g, `>{t('tutor.disclaimer')}<`);

fs.writeFileSync('views/StudentTutorView.tsx', viewCode);
console.log('Tutor updated');
