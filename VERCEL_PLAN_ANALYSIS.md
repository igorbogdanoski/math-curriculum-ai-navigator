# Vercel Hobby vs Pro — Конкретна анализа за Math Curriculum AI Navigator

**Датум:** 08.04.2026  
**Контекст:** По Deployment Vercel TS исправка (12 API functions) + F3 Bundle/Perf gate PASS  
**Одлука начин:** Фактички críteriu за S19+ план

---

## ДЕЛО 1: Тековна состојба (Hobby)

### API Функции (Vercel serverless limits)

#### Тековно развиено и951 функции
```
1.  api/create-school.ts         — onboarding Firebase school create
2.  api/embed.ts                 — embedding proxy (now consolidated)
3.  api/gemini-stream.ts         — streaming Gemini responses
4.  api/gemini.ts                — non-streaming Gemini proxy
5.  api/imagen.ts                — image generation
6.  api/matura-share.ts          — sign + verify (consolidated from 2→1)
7.  api/slo-summary.ts           — operational SLO dashboard data
8.  api/stripe-checkout.ts       — Stripe payment initiation
9.  api/stripe-webhook.ts        — Stripe webhook fulfillment
10. api/vertex-shadow.ts         — Vertex AI shadow proxy (501 stub)
11. api/webpage-extract.ts       — web/PDF extraction + OCR fallback
12. api/youtube-captions.ts      — YouTube transcript fetch

Укупно: 12 функции = точно на Hobby лимит (max 12)
```

#### Hobby лимити — Тековна позиција
| Límit | Hobby value | Ваша употреба | Статус |
|---|---|---|---|
| Serverless functions per unit | 12 | 12/12 | 🔴 **ПОЛН** |
| Function execution time | 60s | avg ~8-15s | ✅ Комотно |
| Function memory | 3008 MB (shared) | avg ~256-512 MB | ✅ Комотно |
| Concurrent executions | Unlimited | N/A | ✅ OK |
| Cold start | 5-10s typical | Acceptable for UX | ✅ OK |
| Public source maps | ✅ | ✅ мате ja имате | ✅ |

**Заклучок:** Веќе ***не можете да додадете ни една нова API функција без да ја отстраните или консолидирате стара.***

---

## ДЕЛО 2: S19+ План за нови функции

### S19 + S20 Необходни нови API endpoints (според STRATEGIC_ROADMAP.md)

#### П1. **Forum FCM push notifications** (V3 од ПАТЕКА В)
Ново: Cloud Function (Firebase) или Vercel function за FCM trigger kada ima нов forum reply
```
Функције натврдени за реализација:
- /api/forum-notify — trigger на нов reply во forum → push notification
- /api/fcm-token-register — client регистрирање на FCM токен (можеше адаптирано во create-school или нов endpoint)

Нови функције: 1–2
```

#### П2. **Vocational exam import + conceptIds enrichment** (A3 extention од ПАТЕКА А)
Ново: Separate pipeline за vocational curriculum (како што постоји gymnasium)
```
Функције натврдени:
- /api/matura:import-vocational — batch import средно стручни испити
- /api/matura:enrich-vocational — auto conceptIds mapping за vocational-it, vocational-eco, итн

Нови функције: 2
```

#### П3. **Batch translation service** (S18-P4 deferred, мо до S19)
Ново: Gemini batch API за EN/AL/TR UI keys (~800 идендификатори)
```
Не троши Vercel function (batch работи offline),
может REST wrapper ако сакате dashboard:
- /api/translation-batch-status — проверити статус на batch job

Нови функције: 0–1 (опционално)
```

#### П4. **Interactive math components — Shape3D WebSocket** (D3 долгорочно)
Ново: Real-time canvas collaboration
```
Бара: WebSocket fallback или Vercel Websocket proxy (ако користите)
- /api/canvas-collaborate — WebSocket upgrade
- /api/canvas-session — session management

Нови функције: 1–2
```

#### П5. **SLO hardening — Sentry custom events** (operational)
Ново: Detailed error categorization для SLO dashboard
```
Можеше интегрирано во /api/slo-summary,
неможе одвојена функција.

Нови функције: 0
```

#### П6. **Extraction scale-up — Batch URL processing** (B3/B4 од ПАТЕКА Б)
Ново: За долги видеа и batch web extraction
```
Функције натврдени:
- /api/extract-batch — процесирање на 5–10 URLs паралелно
- /api/extract-status — проверити статус на batch job

Нови функције: 2
```

#### П7. **Gemini vision batch** (B2 scale-up од ПАТЕКА Б)
Ново: За処理 на нескоко слики истовремено
```
Можеше адаптирано во /api/imagen или нова функција
- /api/vision-batch — batch image analysis

Нови функції: 0–1
```

### **Укупна прогноза за S19–S20**

| Сценарио | Нови функције | Укупно | Фeasible на Hobby? |
|---|---|---|---|
| Минимум (V3 + vocational base) | 2–3 | 14–15 | ❌ ПРЕПОЛНО |
| Напред (+ batch extraction) | 4–5 | 16–17 | ❌ НЕВОЗМОЖНО |
| Максимум (+ canvas + batch) | 6–8 | 18–20 | ❌ НЕВОЗМОЖНО |

---

## ДЕЛО 3: Hobby vs Pro — Директна компарација

### Vercel Pro лимити и цена

| Límit | Hobby | Pro | Вашата потреба |
|---|---|---|---|
| Serverless functions | 12 | **Unlimited** | 15–20 |
| Function execution time | 60s | **600s** | 8–15s (OK) |
| Cold start | 5–10s | ~5–10s (исто) | Same |
| Concurrent deployments | 1 | 3 | Maybe |
| Environment variables | 100 | **Unlimited** | ~50 (OK) |
| Team seats | 1 | 10 | N/A сега |
| Monthly cost | $20 (fixed) | $20 + $95 (paid tier) | +$95 extra |

---

## ДЕЛО 4: Критериуми за одлука

### "Купи сега (за Pro)" ако:
```
☑ Плакирате S19 П1 (Forum FCM) + П2 (Vocational) + П6 (Batch extraction) истовремено
   → То додава 4–6 API functions = 16–18 укупно (НЕВОЗМОЖНО на Hobby without teardown)

☑ Цервени критериуми за миграција на Vercel:
   - Веќе ви одостига Hobby function slot е за имплементација на нови features
   - Развојни циклуси станаа 1–2 дена полавици (консолидирање + рефакторирање место додавање)
   - Верveljат на временските хорајончици за S19+ се отвореноени
```

### "Почекај 2–4 недели (остани на Hobby)" ако:
```
☑ Фокусирате се на S19 П1 САМО (Forum FCM) — нужно 1 function, можеше консолидирано
☑먹ете да го отстраните или завршите vertex-shadow stub (501) → слободен slot
☑ Batch translation НЕ е критично за Q2 2026 (можеше во Q3)
☑ Развојниот tempo е модеран и не срљате во P1 скоро
```

### "Никогаш на Pro" ако:
```
❌ Веќе сте во maintenance mode (нема нови features) — Hobby е сосем оправ
❌ Сте мигрирале на Firebase Cloud Functions целосно (Vercel е вторичен)
❌ Буџетот е ултра-ограничен и $95/месец е непристапилив
```

---

## ДЕЛО 5: Микростратегија за S19 (одлука во следниот sprint)

### Сценарио А: Остани на Hobby (низак трошок)

**Фокус:** Forum FCM (V3) + Vocational базе (A3 extend)  
**Консолидирање:** Отстрани `vertex-shadow.ts` → слободен slot

```bash
# Pre-S19 cleanup
git rm api/vertex-shadow.ts
# Update vite.config.ts — remove /api/vertex-shadow dev middleware
# Update services/gemini/vertexShadow.ts — remove runVertexShadow() call
# Validate: npm run build (должно да остане зелено)

# Нови функције:
# /api/forum-notify (нова)
# /api/matura:import-vocational (нова, или script.mjs)
# → Total: 12 - 1 + 2 = 13 (ПРЕПОЛНО за Hobby)

# Workaround за 13teenth функција:
# 1. Merge /api/forum-notify INTO /api/matura-share.ts (query parameter router)
#    /api/matura-share?action=sign|verify|notifyForum
# OR
# 2. Skip /api/matura:import-vocational kao Vercel function; use local script instead
#    npm run matura:import-vocational -- --file path/to/exam.json (local)
```

**Резултат:** 12 functions, но потеснина за growth. S20 ќе треба нов cleanup или upgrade.

---

### Сценарио Б: Преминете на Pro сега (вы growth + flexibility)

**Налика:** Forum FCM + Vocational + Batch extraction (full S19)

```bash
# S19 full steam
# /api/forum-notify (нова)
# /api/matura:import-vocational (нова)
# /api/extract-batch (нова)
# /api/extract-status (нова)
# /api/translation-batch-status (нова)
# → Total: 12 + 5 = 17 functions

# No workarounds needed.
# All new features deployed as separate, clear endpoints.
# Operational simplicity + team sanity = 👌
```

**Резултат:** Unlimited functions, чист архитектура, позитивен team morale. Трошок: +$95/месец.

---

## ДЕЛО 6: Финална препорака

### За вашиот проект + S19 план:

**Одлука:** **Преминете на Pro во раната Avril (пред S19 kickoff), но САМО ако:**

1. ✅ **S19 Roadmap е финализирана и таткога одобрена** (не нагадување)
2. ✅ **Барем 2 од 5-те S19 задачи се P0** (Forum FCM + Vocational база)
3. ✅ **Team има bandwidth за 4–6 недели континуирана работа** (не фрагментирано)
4. ✅ **Буџет од $95/месец е усвоена и достапна** (не "може да биде")

**Ако сите услови НЕ се исполнети:** Остани на Hobby, направи микро-cleanup (отстрани vertex-shadow), и ревизирај одлуката во рана Май.

---

## ДЕЛО 7: Конкретна финансиска компарација

### 12-месечен хоризонт

| Сценарио | Total cost | Развојни ограничувања | Проблеми |
|---|---|---|---|
| **Hobby (12 месеци)** | $240 (12 × $20) | За S19: ако сакате 4+ функције, трошите 3–4 дени рефакторирање | Medium |
| **Pro (12 месеци)** | $1,380 ($20 × 12 + $95 × 12) | НЕМА за S19 | Комотно |
| **Pro (6 месеци Hobby, 6 Pro)** | $810 (6×$20 + 6×($20+$95)) | Трошактивирате Pro во Май (среди S19) | Good compromise |

**Мојата препорака:** Ако не сте сигурни, **максимум 6 месеци Hobby до Май**, потоа евалуирајте дали сте влегле во P0 S19 features кои ви требаат Pro. Актуално, на Май можеш да видиш точно кои functions ти се запленети и да намерноше одлука.

---

## ДЕЛО 8: Action план за Avril

### Week of April 8–14

**Ако останете на Hobby:**
```
☐ Remove api/vertex-shadow.ts (saves 1 slot)
☐ Consolidate /api/forum-notify into /api/matura-share.ts
☐ npm run build (validate)
☐ Commit → push
☐ Update this document with decision
```

**Ако преминете на Pro:**
```
☐ Upgrade Vercel account to Pro (immediate)
☐ Update vercel.json if needed (should be transparent)
☐ Plan S19 P1 (Forum FCM) + P2 (Vocational) as separate, clean endpoints
☐ Start development immediately after upgrade confirmation
☐ Document in ROADMAP (new sprint: "S19-Pro-enabled edition")
```

---

*Ова е фактички анализа за вашиот проект, не генеричка Hobby vs Pro маркетинг.*  
*Одлука по avril.корто 14 ќе биде јасна врз основа на S19 конкретност.*
