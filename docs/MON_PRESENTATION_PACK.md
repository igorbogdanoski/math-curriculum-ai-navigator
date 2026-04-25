# МОН Презентациски Пакет

**Подготвено за:** Министерство за образование и наука на РСМ
**Датум:** 25.04.2026
**Контакт за прашања:** [info@ai.mismath.net]
**Платформа:** Math Curriculum AI Navigator

---

## 1. Линкови за пристап

| Ресурс | URL |
|---|---|
| **Production апликација** | https://ai.mismath.net |
| **Демо режим (auto-fill)** | https://ai.mismath.net/?demo=mon |
| **Status page (uptime)** | https://status.ai.mismath.net |
| **Health endpoint (API)** | https://ai.mismath.net/api/health |
| **Видео-туторијал (5 min)** | [Внеси YouTube unlisted линк] |

---

## 2. Демо креденцијали

> ⚠️ Овие креденцијали се **исклучиво за МОН рецензија**. Не споделувајте надвор од одобрени лица. Демо налогот е изолиран од production податоците.

### Наставник (главен преглед)
| Поле | Вредност |
|---|---|
| Е-пошта | `teacher@mon-demo.ai.mismath.net` |
| Лозинка | `MonDemo!2026` |
| Улога | Teacher (Pro tier) |
| Кредити | 500 (доволно за демонстрација) |

### Ученици (12 профили)
| Е-пошта pattern | Лозинка |
|---|---|
| `student1@mon-demo.ai.mismath.net` ... `student12@mon-demo.ai.mismath.net` | `MonDemo!2026` |

### Seed-податоци
- 3 годишни планови (6, 7, 8 одделение)
- 8 квизови (DoK 1–4 ротирано)
- 96 history entries (12 ученици × 8 квизови)
- 5 forum threads
- IRT estimates за секој ученик

**Скрипта за повторно seed-ирање:** `npm run mon:seed` (read-only за production деплојмент).

---

## 3. Документи (со овој пакет)

| Документ | Локација | Цел |
|---|---|---|
| Кориснички водич | `docs/MON_USER_GUIDE_MK.md` | Чекор-по-чекор за секој flow |
| Privacy Impact Assessment | `docs/MON_PRIVACY_IMPACT_ASSESSMENT.md` | GDPR compliance evidence |
| Видео-туторијал сценарио | `docs/MON_VIDEO_TUTORIAL_SCRIPT.md` | Reproducible recording script |
| Status page setup | `docs/MON_STATUS_PAGE_SETUP.md` | UptimeRobot upclock |
| Овој пакет | `docs/MON_PRESENTATION_PACK.md` | Master манифест |

---

## 4. Технички сертификати и одобренија

| Stack | Сертификат |
|---|---|
| Vercel (hosting) | ISO 27001, SOC 2 Type II |
| Firebase (Auth + DB + Storage) | ISO 27001/27017/27018, GDPR DPA |
| Google Gemini API | EU AI Act compliant |
| Sentry (observability) | EU region, GDPR DPA |
| TLS | 1.3 (modern profile) |

**Локација на податоци:** Сите податоци се во ЕУ (Frankfurt + Belgium регион).

---

## 5. Quality evidence (snapshot)

| Метрика | Вредност | Извор |
|---|---|---|
| TypeScript строги грешки | 0 | `npx tsc --noEmit` |
| `as any` / `@ts-ignore` | 0 / 0 | grep gate |
| Unit тестови | 1074 / 1074 | `npm test` |
| E2E тестови (Playwright) | ~20 spec фајлови | `npm run test:e2e` |
| AI quality gate | min 70% | `eval:smoke-gate` |
| Sprint завршени | S1 → S41 | git history |
| Mobile audit | iPhone-375, iPad-768, Desktop-1440 | `tests/mobile-responsive.spec.ts` |
| RBAC | Firestore Rules + tests | `firestore.rules` + `test:rules` |
| Rate-limiting | UID 20/min + IP 100/min | `api/_lib/rateLimitInMemory.ts` |

---

## 6. Безбедност и приватност (highlights)

✓ **GDPR-усогласено** — PIA документ потпишан
✓ **Локација во ЕУ** — Frankfurt / Belgium
✓ **RBAC** — Firestore rules + role-based UI
✓ **Rate-limiting** — двослоен (UID + IP)
✓ **CSP report-only** — XSS защита
✓ **Sentry release tagging** — детекција на регресии
✓ **Шифрирање во мирување** — AES-256
✓ **Право на бришење** — каскадно (`firestoreService.gdpr.ts`)
✓ **Без training на корисничките податоци** — no-train flag за Gemini

---

## 7. Педагошка длабочина

✓ **DoK 1–4 (Webb)** — фундаментална, не козметичка
✓ **IRT 3-PL** — Newton-Raphson MLE + Fisher-information selection
✓ **Misconception mining** — со mini-lesson cards
✓ **Vertical progression** — крос-одделенско следење на концепти
✓ **БРО (Биро за развој на образование) усогласеност** — секоја цел мапирана на национален стандард
✓ **Spaced repetition (SM-2)** — за лична подготовка

---

## 8. Roadmap (после МОН одобрение)

### Q3 2026 (предлог пилот)
- 3–5 училишта × ~50 наставници секое
- Тренинг за наставници (2 × 2 ч)
- Технички helpdesk (e-mail + Slack)
- Месечни one-on-one со 1 претставник на МОН

### Q4 2026
- Постепено отворање за сите македонски наставници по математика
- Содржина за 5–9 + гимназија
- Албанска локализација (за Тетово, Гостивар, Куманово)

### Q1 2027
- Експанзија на физика + хемија (на барање)
- Интеграција со постоечки училишни системи (e-Diary, ако МОН има)

---

## 9. Одобрение и потврда

| Улога | Име | Потпис | Датум |
|---|---|---|---|
| Контролор / Развој | _________________ | _________________ | __/__/____ |
| МОН претставник | _________________ | _________________ | __/__/____ |

---

## 10. Контакти

| Прашање | Контакт |
|---|---|
| Општи прашања | info@ai.mismath.net |
| Технички | tech@ai.mismath.net |
| Приватност / GDPR | privacy@ai.mismath.net |
| Безбедносни инциденти | security@ai.mismath.net |
| Hotline (24h за инциденти) | [Внеси број] |

---

## 11. Чек-листа за презентација

Пред средба со МОН провери:

- [ ] Production деплојмент live (`/api/health` 200 OK)
- [ ] Status page јавна и зелена ≥ 7 дена
- [ ] Видео-туторијал качен на YouTube unlisted
- [ ] PIA документ потпишан од контролор
- [ ] Демо налог seed-иран (`npm run mon:seed`)
- [ ] `?demo=mon` URL функционира → банер видлив
- [ ] Сите тестови минуваат (`npm test` + `npm run test:rules`)
- [ ] TSC чист (`npx tsc --noEmit`)
- [ ] Backup verified (`npm run backup:readiness-check`)
- [ ] Овој пакет (`MON_PRESENTATION_PACK.md`) испратен на МОН ≥ 48 ч пред средбата

---

*Документ генериран како дел од S41-D7 (МОН-readiness sprint).*
