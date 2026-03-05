const fs = require('fs');

let tContent = fs.readFileSync('i18n/translations.ts', 'utf8');

if (!tContent.includes("'play.onboarding.step1.title': 'Добредојде во'")) {
    const mkAdd = `
    'play.error.invalidLink': 'Невалиден линк за квиз.',
    'play.error.notFound': 'Квизот не е пронајден. Проверете го линкот со вашиот наставник.',
    'play.error.connect': 'Проблем со поврзувањето. Проверете ја интернет конекцијата.',
    'play.loadingText': 'Се подготвува квизот...',
    'play.errorTitle': 'Грешка!',
    'play.backHome': 'Назад кон почетна',
    
    'play.header.portal': 'Ученички Портал',
    'play.header.challenge': 'МАТЕМАТИЧКИ ПРЕДИЗВИК',
    
    'play.onboarding.step1.title': 'Добредојде во',
    'play.onboarding.step1.subtitle': 'Математички Портал!',
    'play.onboarding.step1.opt1.title': 'Одговарај на прашања',
    'play.onboarding.step1.opt1.desc': 'Квизови прилагодени на твоето ниво',
    'play.onboarding.step1.opt2.title': 'Освојувај XP и значки',
    'play.onboarding.step1.opt2.desc': 'Редови, достигнувања и напредок',
    'play.onboarding.step1.opt3.title': 'Следи го твојот напредок',
    'play.onboarding.step1.opt3.desc': 'Гледај ги сите твои резултати на едно место',
    'play.onboarding.step1.button': 'Да почнеме!',
    
    'play.onboarding.step2.title': 'Како се викаш?',
    'play.onboarding.step2.desc': 'Твоето име се чува само за да го следиме твојот напредок.',
    'play.onboarding.step2.placeholder': 'Твоето име и презиме...',
    'play.onboarding.step2.button': 'Потврди',
    'play.onboarding.step2.back': '← Назад',
    
    'play.changeName.title': 'Промени име',
    'play.changeName.desc': 'Внеси го твоето име за да го зачуваме твојот резултат.',
    'play.changeName.button': 'Почни Квизот',
    
    'play.welcomeBack': '👋 Добредојде назад!',
    'play.change': 'Промени',
    
    'play.result.mastered': 'Концептот е СОВЛАДАН! 🏆',
    'play.result.masteredDesc': 'Го постигна 85%+ три пати по ред. Кажи му на твојот наставник — ова е голем успех!',
    'play.result.consecutive1': 'Одличен резултат ',
    'play.result.consecutive2': ' пати по ред',
    'play.result.consecutive3': ' — уште ',
    'play.result.consecutive4': ' за да го совладаш концептот!',
    
    'play.result.great': 'Одличен резултат! ',
    'play.result.correct': ' точни',
    'play.result.bravo': 'Браво',
    'play.result.bravoDesc': '! Ги совладавте прашањата одлично. Кажи му на твојот наставник за резултатот.',
    'play.result.viewProgress': 'Погледни го мојот прогрес',
    
    'play.advance.preparingAI': 'AI подготвува предизвик...',
    'play.advance.button': '🚀 Предизвик (напредни прашања)',
    
    'play.tryAgin.title': 'Не се откажувај! ',
    'play.tryAgin.descLow': 'Подготвуваме полесни прашања специјално за тебе...',
    'play.tryAgin.descMid': 'Уште малку вежба за да го совладаш концептот...',
    'play.tryAgin.preparingAI': 'AI подготвува следен квиз за тебе...',
    'play.tryAgin.buttonLow': '📘 Поддршка (полесни прашања)',
    'play.tryAgin.buttonMid': '📖 Вежбај повторно',
    'play.tryAgin.buttonFallback': 'Обиди се повторно',
    
    'play.confidence.title': 'Колку сигурен/сигурна се осеќаш за овој концепт?',
    'play.confidence.saved': 'Зачувано! Благодарам за твојот одговор. ✓',
    'play.level': 'Лв.',
    'play.totalXP': 'XP вкупно',
    'play.newAchievement': 'Ново достигнување!',
    `;

    const sqAdd = `
    'play.error.invalidLink': 'Link i pavlefshëm i kuizit.',
    'play.error.notFound': 'Kuizi nuk u gjet. Kontrolloni linkun me mësuesin tuaj.',
    'play.error.connect': 'Problem me lidhjen. Kontrolloni lidhjen e internetit.',
    'play.loadingText': 'Duke përgatitur kuizin...',
    'play.errorTitle': 'Gabim!',
    'play.backHome': 'Kthehu në fillim',
    
    'play.header.portal': 'Portali i Nxënësit',
    'play.header.challenge': 'SFIDA MATEMATIKORE',
    
    'play.onboarding.step1.title': 'Mirësevini në',
    'play.onboarding.step1.subtitle': 'Portal Matematikore!',
    'play.onboarding.step1.opt1.title': 'Përgjigju pyetjeve',
    'play.onboarding.step1.opt1.desc': 'Kuize të përshtatura për nivelin tuaj',
    'play.onboarding.step1.opt2.title': 'Fitoni XP dhe distinktivë',
    'play.onboarding.step1.opt2.desc': 'Rangje, arritje dhe progres',
    'play.onboarding.step1.opt3.title': 'Ndiqni progresin tuaj',
    'play.onboarding.step1.opt3.desc': 'Shikoni të gjitha rezultatet tuaja në një vend',
    'play.onboarding.step1.button': 'Le të fillojmë!',
    
    'play.onboarding.step2.title': 'Si quheni?',
    'play.onboarding.step2.desc': 'Emri juaj ruhet vetëm për të ndjekur progresin tuaj.',
    'play.onboarding.step2.placeholder': 'Emri dhe mbiemri juaj...',
    'play.onboarding.step2.button': 'Konfirmo',
    'play.onboarding.step2.back': '← Kthehu',
    
    'play.changeName.title': 'Ndrysho emrin',
    'play.changeName.desc': 'Futni emrin tuaj për ta ruajtur rezultatin.',
    'play.changeName.button': 'Fillo Kuizin',
    
    'play.welcomeBack': '👋 Mirësevini përsëri!',
    'play.change': 'Ndrysho',
    
    'play.result.mastered': 'Koncepi është PËRVETËSUAR! 🏆',
    'play.result.masteredDesc': 'Keni arritur 85%+ tre herë radhazi. Tregojini mësuesit tuaj — ky është një sukses i madh!',
    'play.result.consecutive1': 'Rezultat i shkëlqyer ',
    'play.result.consecutive2': ' herë radhazi',
    'play.result.consecutive3': ' — edhe ',
    'play.result.consecutive4': ' për të përvetësuar konceptin!',
    
    'play.result.great': 'Rezultat i shkëlqyer! ',
    'play.result.correct': ' të sakta',
    'play.result.bravo': 'Të lumtë',
    'play.result.bravoDesc': '! I keni përvetësuar shkëlqyeshëm pyetjet. Tregojini mësuesit tuaj për rezultatin.',
    'play.result.viewProgress': 'Shiko progresin tim',
    
    'play.advance.preparingAI': 'AI po përgatit sfidën...',
    'play.advance.button': '🚀 Sfidë (pyetje të avancuara)',
    
    'play.tryAgin.title': 'Mos u dorëzo! ',
    'play.tryAgin.descLow': 'Ne po përgatisim pyetje më të lehta posaçërisht për ju...',
    'play.tryAgin.descMid': 'Pak më shumë praktikë për të përvetësuar konceptin...',
    'play.tryAgin.preparingAI': 'AI po përgatit kuizin e radhës për ju...',
    'play.tryAgin.buttonLow': '📘 Mbështetje (pyetje më të lehta)',
    'play.tryAgin.buttonMid': '📖 Praktiko përsëri',
    'play.tryAgin.buttonFallback': 'Provo përsëri',
    
    'play.confidence.title': 'Sa të sigurt ndiheni për këtë koncept?',
    'play.confidence.saved': 'U ruajt! Faleminderit për përgjigjen tuaj. ✓',
    'play.level': 'Niv.',
    'play.totalXP': 'XP total',
    'play.newAchievement': 'Arritje e re!',
    `;

    const trAdd = `
    'play.error.invalidLink': 'Geçersiz sınav bağlantısı.',
    'play.error.notFound': 'Sınav bulunamadı. Bağlantıyı öğretmeninizle kontrol edin.',
    'play.error.connect': 'Bağlantı sorunu. İnternet bağlantınızı kontrol edin.',
    'play.loadingText': 'Sınav hazırlanıyor...',
    'play.errorTitle': 'Hata!',
    'play.backHome': 'Ana sayfaya dön',
    
    'play.header.portal': 'Öğrenci Portalı',
    'play.header.challenge': 'MATEMATİK MEYDAN OKUMASI',
    
    'play.onboarding.step1.title': 'Şuraya hoş geldiniz',
    'play.onboarding.step1.subtitle': 'Matematik Portalı!',
    'play.onboarding.step1.opt1.title': 'Soruları yanıtlayın',
    'play.onboarding.step1.opt1.desc': 'Seviyenize uyarlanmış sınavlar',
    'play.onboarding.step1.opt2.title': 'XP ve rozetler kazanın',
    'play.onboarding.step1.opt2.desc': 'Rütbeler, başarılar ve ilerleme',
    'play.onboarding.step1.opt3.title': 'İlerlemenizi takip edin',
    'play.onboarding.step1.opt3.desc': 'Tüm sonuçlarınızı tek bir yerde görün',
    'play.onboarding.step1.button': 'Başlayalım!',
    
    'play.onboarding.step2.title': 'Adınız nedir?',
    'play.onboarding.step2.desc': 'Adınız yalnızca ilerlemenizi izlemek için saklanır.',
    'play.onboarding.step2.placeholder': 'Adınız ve soyadınız...',
    'play.onboarding.step2.button': 'Onayla',
    'play.onboarding.step2.back': '← Geri',
    
    'play.changeName.title': 'Adı değiştir',
    'play.changeName.desc': 'Sonucunuzu kaydetmek için adınızı girin.',
    'play.changeName.button': 'Sınava Başla',
    
    'play.welcomeBack': '👋 Tekrar hoş geldiniz!',
    'play.change': 'Değiştir',
    
    'play.result.mastered': 'Kavram ÖĞRENİLDİ! 🏆',
    'play.result.masteredDesc': 'Üç kez üst üste %85+ oranına ulaştınız. Öğretmeninize söyleyin — bu büyük bir başarı!',
    'play.result.consecutive1': 'Harika sonuç ',
    'play.result.consecutive2': ' kez üst üste',
    'play.result.consecutive3': ' — kavramı öğrenmek için ',
    'play.result.consecutive4': ' daha kaldı!',
    
    'play.result.great': 'Mükemmel sonuç! ',
    'play.result.correct': ' doğru',
    'play.result.bravo': 'Tebrikler',
    'play.result.bravoDesc': '! Soruları mükemmel bir şekilde öğrendiniz. Sonucu öğretmeninize söyleyin.',
    'play.result.viewProgress': 'İlerlememi gör',
    
    'play.advance.preparingAI': 'AI meydan okumayı hazırlıyor...',
    'play.advance.button': '🚀 Meydan Okuma (ileri düzey sorular)',
    
    'play.tryAgin.title': 'Pes etmeyin! ',
    'play.tryAgin.descLow': 'Size özel daha kolay sorular hazırlıyoruz...',
    'play.tryAgin.descMid': 'Kavramı öğrenmek için biraz daha pratik yapın...',
    'play.tryAgin.preparingAI': 'AI sizin için bir sonraki sınavı hazırlıyor...',
    'play.tryAgin.buttonLow': '📘 Destek (daha kolay sorular)',
    'play.tryAgin.buttonMid': '📖 Tekrar pratik yapın',
    'play.tryAgin.buttonFallback': 'Tekrar dene',
    
    'play.confidence.title': 'Bu kavram hakkında ne kadar eminsiniz?',
    'play.confidence.saved': 'Kaydedildi! Yanıtınız için teşekkürler. ✓',
    'play.level': 'Svy.',
    'play.totalXP': 'Toplam XP',
    'play.newAchievement': 'Yeni başarı!',
    `;

    tContent = tContent.replace("const mk: Record<string, string> = {", "const mk: Record<string, string> = {" + mkAdd);
    tContent = tContent.replace("const sq: Record<string, string> = {", "const sq: Record<string, string> = {" + sqAdd);
    tContent = tContent.replace("const tr: Record<string, string> = {", "const tr: Record<string, string> = {" + trAdd);
    fs.writeFileSync('i18n/translations.ts', tContent, 'utf8');
}

let hContent = fs.readFileSync('views/StudentPlayView.tsx', 'utf8');

if (!hContent.includes('useLanguage()')) {
    hContent = hContent.replace(
        "import { useAuth } from '../contexts/AuthContext';",
        "import { useAuth } from '../contexts/AuthContext';\nimport { useLanguage } from '../i18n/LanguageContext';"
    );
}
if (!hContent.includes('const { t } = useLanguage();')) {
    hContent = hContent.replace(
        "export const StudentPlayView: React.FC = () => {",
        "export const StudentPlayView: React.FC = () => {\n  const { t } = useLanguage();"
    );
}

// Replacements
hContent = hContent.replace("'Невалиден линк за квиз.'", "t('play.error.invalidLink')");
hContent = hContent.replace("'Квизот не е пронајден. Проверете го линкот со вашиот наставник.'", "t('play.error.notFound')");
hContent = hContent.replace("'Проблем со поврзувањето. Проверете ја интернет конекцијата.'", "t('play.error.connect')");
hContent = hContent.replace(">Се подготвува квизот...<", ">{t('play.loadingText')}<");
hContent = hContent.replace(">Грешка!<", ">{t('play.errorTitle')}<");
hContent = hContent.replace("> Назад кон почетна<", "> {t('play.backHome')}<");

hContent = hContent.replace(">Ученички Портал<", ">{t('play.header.portal')}<");
hContent = hContent.replace(">МАТЕМАТИЧКИ ПРЕДИЗВИК<", ">{t('play.header.challenge')}<");

hContent = hContent.replace(">Добредојде во<br/>Математички Портал!<", ">{t('play.onboarding.step1.title')}<br/>{t('play.onboarding.step1.subtitle')}<");
hContent = hContent.replace(">Одговарај на прашања<", ">{t('play.onboarding.step1.opt1.title')}<");
hContent = hContent.replace(">Квизови прилагодени на твоето ниво<", ">{t('play.onboarding.step1.opt1.desc')}<");
hContent = hContent.replace(">Освојувај XP и значки<", ">{t('play.onboarding.step1.opt2.title')}<");
hContent = hContent.replace(">Редови, достигнувања и напредок<", ">{t('play.onboarding.step1.opt2.desc')}<");
hContent = hContent.replace(">Следи го твојот напредок<", ">{t('play.onboarding.step1.opt3.title')}<");
hContent = hContent.replace(">Гледај ги сите твои резултати на едно место<", ">{t('play.onboarding.step1.opt3.desc')}<");
hContent = hContent.replace(">Да почнеме!<", ">{t('play.onboarding.step1.button')}<");

hContent = hContent.replace(">Како се викаш?<", ">{t('play.onboarding.step2.title')}<");
hContent = hContent.replace("Твоето име се чува само за да го следиме твојот напредок. Никој друг не може да го гледа.", "{t('play.onboarding.step2.desc')}");
hContent = hContent.replace('placeholder="Твоето име и презиме..."', 'placeholder={t("play.onboarding.step2.placeholder")}');
hContent = hContent.replace(">Потврди <", ">{t('play.onboarding.step2.button')} <");
hContent = hContent.replace(">← Назад<", ">{t('play.onboarding.step2.back')}<");

hContent = hContent.replace(">Промени име<", ">{t('play.changeName.title')}<");
hContent = hContent.replace("Внеси го твоето име за да го зачуваме твојот резултат.", "{t('play.changeName.desc')}");
hContent = hContent.replace(">Почни Квизот <", ">{t('play.changeName.button')} <");

hContent = hContent.replace(">👋 Добредојде назад!<", ">{t('play.welcomeBack')}<");
hContent = hContent.replace(">Промени<", ">{t('play.change')}<");

hContent = hContent.replace(">Концептот е СОВЛАДАН! 🏆<", ">{t('play.result.mastered')}<");
hContent = hContent.replace("Го постигна 85%+ три пати по ред. Кажи му на твојот наставник — ова е голем успех!", "{t('play.result.masteredDesc')}");

hContent = hContent.replace("Одличен резултат {consecutive} пат", "{t('play.result.consecutive1')} {consecutive} {t('play.result.consecutive2')}");
hContent = hContent.replace("{consecutive === 1 ? '' : 'и'} по ред", "");

hContent = hContent.replace(" ? ` — уште ${3 - consecutive} за да го совладаш концептот!` : ''", " ? `${t('play.result.consecutive3')} ${3 - consecutive} ${t('play.result.consecutive4')}` : ''");
hContent = hContent.replace("Одличен резултат! {quizResult.correctCount} / {quizResult.totalQuestions} точни", "{t('play.result.great')} {quizResult.correctCount} / {quizResult.totalQuestions} {t('play.result.correct')}");

hContent = hContent.replace("Браво{studentName ? `, ${studentName}` : ''}! Ги совладавте прашањата одлично. Кажи му на твојот наставник за резултатот.", "{t('play.result.bravo')}{studentName ? `, ${studentName}` : ''}{t('play.result.bravoDesc')}");

hContent = hContent.replace(">Погледни го мојот прогрес<", ">{t('play.result.viewProgress')}<");
hContent = hContent.replace(">AI подготвува предизвик...<", ">{t('play.advance.preparingAI')}<");
hContent = hContent.replace(">🚀 Предизвик (напредни прашања)<", ">{t('play.advance.button')}<");

hContent = hContent.replace("Не се откажувај! {quizResult.correctCount} / {quizResult.totalQuestions} точни", "{t('play.tryAgin.title')} {quizResult.correctCount} / {quizResult.totalQuestions} {t('play.result.correct')}");
hContent = hContent.replace("? 'Подготвуваме полесни прашања специјално за тебе...'", "? t('play.tryAgin.descLow')");
hContent = hContent.replace(": 'Уште малку вежба за да го совладаш концептот...'", ": t('play.tryAgin.descMid')");
hContent = hContent.replace(">AI подготвува следен квиз за тебе...<", ">{t('play.tryAgin.preparingAI')}<");
hContent = hContent.replace("'📘 Поддршка (полесни прашања)'", "t('play.tryAgin.buttonLow')");
hContent = hContent.replace("'📖 Вежбај повторно'", "t('play.tryAgin.buttonMid')");
hContent = hContent.replace(">Обиди се повторно<", ">{t('play.tryAgin.buttonFallback')}<");

hContent = hContent.replace(">Колку сигурен/сигурна се осеќаш за овој концепт?<", ">{t('play.confidence.title')}<");
hContent = hContent.replace(">Зачувано! Благодарам за твојот одговор. ✓<", ">{t('play.confidence.saved')}<");

hContent = hContent.replace(">Лв.{newLvl.level}<", ">{t('play.level')}{newLvl.level}<");
hContent = hContent.replace(">{totalXP} XP вкупно<", ">{totalXP} {t('play.totalXP')}<");
hContent = hContent.replace(">Ново достигнување!<", ">{t('play.newAchievement')}<");

fs.writeFileSync('views/StudentPlayView.tsx', hContent, 'utf8');
