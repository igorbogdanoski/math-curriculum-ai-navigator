# Упатство за Deployment

Апликацијата може да се публикува на **Vercel** (препорачано, бесплатно) или **Firebase Hosting**.
GitHub Actions автоматски ги прави двете при секој push на `main` гранка.

---

## Опција А — Vercel (Препорачано)

### Чекор 1 — Верификација на акаунт
1. Оди на [vercel.com](https://vercel.com) → Sign Up со GitHub акаунт
2. Ако репото е приватно: `Settings → Integrations → GitHub` → дај пристап до репото

### Чекор 2 — Import на проект
1. `Add New → Project`
2. Избери го `math-curriculum-ai-navigator` репото
3. Framework Preset: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Root Directory: `/` (оставете празно)

### Чекор 3 — Environment Variables
Во `Project Settings → Environment Variables` додај ги следниве (ги наоѓаш во Firebase Console → Project Settings):

| Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | AIza... |
| `VITE_FIREBASE_AUTH_DOMAIN` | xxx.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | xxx (само ID, без URL) |
| `VITE_FIREBASE_STORAGE_BUCKET` | xxx.appspot.com |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 123456789 |
| `VITE_FIREBASE_APP_ID` | 1:123:web:abc |
| `VITE_GEMINI_API_KEY` | AIza... (од Google AI Studio) |

> **Совет:** Постави ги за `Production`, `Preview` и `Development` одеднаш со "Apply to all environments".

### Чекор 4 — Deploy
Кликни **Deploy**. Vercel автоматски ќе го изгради и публикува проектот.
Секој следен `git push main` = автоматски нов deploy.

---

## Опција Б — Firebase Hosting

### Чекор 1 — Инсталирај Firebase CLI
```bash
npm install -g firebase-tools
```

### Чекор 2 — Логирај се
```bash
firebase login
```
Ќе се отвори browser — логирај се со Google акаунтот на кој е Firebase проектот.

### Чекор 3 — Поврзи го проектот
Во root папката на проектот:
```bash
firebase use --add
```
Избери го соодветниот Firebase Project ID → дај му alias `default`.

### Чекор 4 — Изгради ја апликацијата
Прво создај `.env.local` фајл (само за локален build, **никогаш не го commit-ирај**):
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc
VITE_GEMINI_API_KEY=AIza...
```
Потоа:
```bash
npm run build
```

### Чекор 5 — Deploy
```bash
firebase deploy
```
Ова ги деплојува **истовремено**:
- `dist/` → Firebase Hosting
- `firestore.rules` → Firestore Security Rules
- `firestore.indexes.json` → Firestore Индекси

За само Security Rules (без Hosting):
```bash
firebase deploy --only firestore:rules
```

---

## GitHub Actions (Автоматски CI/CD)

Кога ќе се направи `push` на `main`, `.github/workflows/deploy.yml` автоматски:
1. Ги инсталира пакетите
2. Ја изгради апликацијата (со secrets)
3. Ја деплојува на Firebase Hosting

### Потребни Secrets во GitHub репото

Оди на `GitHub Repo → Settings → Secrets and variables → Actions → New repository secret`:

| Secret Name | Каде да го најдеш |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps → SDK config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Исто |
| `VITE_FIREBASE_PROJECT_ID` | Исто |
| `VITE_FIREBASE_STORAGE_BUCKET` | Исто |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Исто |
| `VITE_FIREBASE_APP_ID` | Исто |
| `VITE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) → Get API key |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project Settings → **Service Accounts** → Generate new private key → копирај го целиот JSON |

### Верификација на GitHub Actions
1. Push нешто на `main`
2. Оди на `GitHub Repo → Actions` → види дали `Build & Deploy` workflow минал
3. Зелена штиклица = успешно деплојување

---

## Брза референца — команди

```bash
# Локален dev server
npm run dev

# Локален production build + preview
npm run build && npm run preview

# Deploy само Firestore Rules
firebase deploy --only firestore:rules

# Deploy само Firestore Indexes
firebase deploy --only firestore:indexes

# Целосен Firebase deploy (Hosting + Rules + Indexes)
firebase deploy

# Vercel deploy (ако имаш Vercel CLI инсталирано)
npx vercel --prod
```

---

## .env.local (не се commit-ира)

Создај `.env.local` за локален развој. Провери дека е во `.gitignore`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
```
