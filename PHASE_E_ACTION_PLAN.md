# Фаза Е: Психологија на ученикот, Ангажираност и Екосистем (Phase E)

Оваа фаза се фокусира на трансформација на стабилната архитектура во продукт кој создава навика за учење, ја олеснува пристапноста за најмладите, и создава одржлив мост помеѓу вештачката интелигенција и експертизата на наставниците.

## Цел 1: Систем за Гемификација и Мотивација (Gamification Engine)
**Фокус: Задржување на вниманието и натпреварувачки дух.**
* [x] **Чекор 1.1: Систем на Искуство (XP) и Еволуција на Аватари**
  * XP поени постоеја; додаден `AVATAR_LEVELS` + `getAvatar(level)` во `utils/gamification.ts`.
  * 8 аватари: 🌱 Почетник → 📐 Геометричар → ⭐ Ѕвезда → 🔢 Нумеричар → 🧮 Алгебрист → 🔭 Истражувач → 🏆 Математичар → 🧠 Гениј.
  * `StudentProgressView`: emoji аватар + наслов + „Лв.N" заменуваат бројот во нивото картичката.
  * `StudentPlayView`: аватар + XP progress bar + „⬆️ Level Up!" badge (animate-bounce) во гемификација картичката по квиз.
* [x] **Чекор 1.2: Стрикови (Streaks) и Дневни Предизвици**
  * Следење на последователни денови на учење (оганчиња 🔥) — постои преку `student_gamification.currentStreak`.
  * `utils/dailyQuests.ts` — `generateDailyQuests()` (easy=совладан, medium=во тек, hard=не започнат со задоволени предуслови), `loadOrGenerateQuests()` (localStorage cache по ден), `markQuestComplete()`.
  * `components/common/DailyQuestCard.tsx` — UI картичка со 3 квести + прогрес бројач + „Вежбај” копчиња.
  * Интегриран во `StudentProgressView` (после гемификација картичката).
  * `StudentPlayView` → `markQuestComplete()` по завршен квиз (2c. корак).
* [x] **Чекор 1.3: Математички Лиги (Leaderboards)**
  * `firestoreService.fetchClassLeaderboard(teacherUid)` — documentId() range query (`{teacherUid}_` prefix), сортирано по totalXP.
  * `views/analytics/LeagueTab.tsx` — подиум (Топ 3) + целосна листа групирана по лига (🥉 Бронзена Лв.1-2 / 🥈 Сребрена Лв.3-5 / 🥇 Златна Лв.6+); аватар emoji + XP progress bar по ред.
  * `TeacherAnalyticsView`: нов таб „🏆 Лига".
  * `StudentProgressView`: „🏆 #N од M во класата" badge во нивото картичката (само кога teacherUid е познат).

## Цел 2: Пристапност и Инклузивност (Accessibility & Voice)
**Фокус: Поврзување со најмладите и ученици со потешкотии во читањето.**
* [x] **Чекор 2.1: Режим за читање (Reading Focus Mode)**
  * ⚠️ TTS отфрлен: Web Speech API нема сигурна поддршка за македонски на сите уреди.
  * Копче 👁️ во хедерот на `InteractiveQuizPlayer` го активира `ReadingModeBar`.
  * Функции: 3 големини на фонт (А / А+ / А++), OpenDyslexic фонт (jsDelivr, on-demand), 🔢 истакнување на бројки (amber) и оператори (blue), 📄 „Чекор по чекор" (секвенцијален приказ по реченица со навигација).
  * Компоненти: `ReadingModeBar.tsx`, `ReadingModeQuestion.tsx`.
* [x] **Чекор 2.2: Визуелни помошници за дислексија**
  * `app.css`: `.dyslexic-font *` (OpenDyslexic, letter-spacing, line-height) + `.high-contrast` (filter: contrast+saturate) на `<html>`.
  * `SettingsView`: нова картичка „👁️ Пристапност" — toggle копчиња за OpenDyslexic фонт + Зголемен контраст; промената важи веднаш.
  * `App.tsx`: `applyAccessibilityOnStartup()` — чита localStorage при стартување и применува CSS класи пред React render.

## Цел 3: Контрола на Квалитет (Human-in-the-loop QA)
**Фокус: Градење на најдобрата и најточната национална база на прашања.**
* [x] **Чекор 3.1: Наставнички фидбек за AI**
  * `AIFeedbackBar.tsx` — 👍 „Корисен" / 👎 „Проблем" копчиња под секој генериран материјал.
  * По 👎: опционален textarea за опис на проблемот + „Испрати" / „Прескокни".
  * `firestoreService.saveMaterialFeedback()` → колекција `material_feedback` (rating, title, type, teacherUid, reportText?, conceptId?, gradeLevel?, ratedAt).
  * Интегриран во `MaterialsGeneratorView` над `RefineGenerationChat`; нула промени на постоечки Generated* компоненти.
* [x] **Чекор 3.2: Верификувана Банка на Прашања (Curated Bank)**
  * `SavedQuestion.isVerified?: boolean` + `verifiedAt?` во `types.ts`.
  * `firestoreService.verifyQuestion(id, bool)` + `fetchVerifiedQuestions(teacherUid, conceptId?)`.
  * `QuestionBankTab`: 🛡️ / ✓ toggle per question, зелен border за верификувани, „Само верификувани" filter, brojач во header.
  * `MaterialsGeneratorView`: автоматски ги вчитува верификуваните прашања за избраниот концепт; копче „📚 Од банката (N)" — создава квиз без Gemini повик; **нула промени на постоечкиот Generate AI flow**.

## Цел 4: Перформанси и Брзина (Micro-Optimization)
**Фокус: Вчитување на апликацијата под 1 секунда дури и на 3G мрежи.**
* [x] **Чекор 4.1: Code Splitting (Lazy Loading)**
  * Веќе имплементирано: `safeLazy()` wrapper во `App.tsx` ги lazy-load сите 30+ views преку `React.lazy()` + `Suspense`.
  * Тежките библиотеки (pdf/docx) се вчитуваат само кога корисникот ги повика (inside the lazily-loaded views).
* [x] **Чекор 4.2: Оптимизација на слики и рендерирање**
  * `math-placeholder` shimmer CSS веќе постоеше во `app.css`.
  * `TeacherAnalyticsView`: подобрен skeleton (header + tabs + stat cards + chart area + table rows) наместо едноставниот placeholder.
  * `AppSkeleton` постои за сите lazy-loaded views.

## Цел 5: Проактивен Портал за Родители (Parental Portal 2.0)
**Фокус: Поврзување на родителот со успехот на детето без напор.**
* [x] **Чекор 5.1: Автоматски Неделни Извештаи**
  * ⚠️ Cloud Function + email: надвор од frontend scope (бара backend инфраструктура).
  * `ParentPortalView`: целосно пренапишан — по внесување на ime, прво покажува **Неделен Преглед** картичка со: квизови, просечен резултат, совладани концепти, streak + контекстуална порака (одличен / добар / треба помош).
  * „Целосен извештај →” копче ги редиректира кон `StudentProgressView` (read-only).
