# Sprint S42 — Extraction Hub Upgrade

> **Состав:** 25.04.2026
> **Статус на платформа:** S39 + S40 + S41 завршени; TSC 0; 1079 / 1079 тестови.
> **Цел:** Дополни го екстракцискиот hub со image upload, clipboard paste, multi-language OCR и golden set по јазик.

---

## Снимка пред почеток

| Што постои | Статус |
|---|---|
| Manual transcript fallback (textarea) | ✅ имплементирано во `ExtractionHubView.tsx` (`manualTranscript`) |
| Web URL extraction (`/api/webpage-extract`) | ✅ работи |
| YouTube + Vimeo captions | ✅ работи |
| PDF / DOCX / TXT upload (drag-drop, file-picker) | ✅ работи |
| OCR за PDF (Gemini Vision) | ✅ единечен prompt во `extractTextFromDocument` |

| Што **недостасува** | Приоритет |
|---|---|
| Image upload (PNG/JPEG) како директен OCR извор | 🔴 P0 |
| Clipboard paste handler (Ctrl+V на слика/текст) | 🔴 P0 |
| Multi-language OCR hint (МК/СР/ХР/РУ/ТР/ЕН) | 🟠 P1 |
| Golden set структуриран по јазик | 🟠 P1 |

---

## Содржина

| ID | Задача | Опис | Проценка |
|---|---|---|---|
| **S42-E2a** | Image upload | Прошири `loadFile` да прифаќа `image/png`, `image/jpeg`, `image/webp`. Нов `kind: 'image'` во `uploadedDoc`. `extractFromDocument` ја испраќа сликата директно до Vision со OCR prompt. | 0.5 ден |
| **S42-E2b** | Clipboard paste | `onPaste` listener на `ExtractionHubView`. Детектира `image/*` items → `loadFile`, `text/plain` items со ≥ 200 chars → `manualTranscript` или нов "pasted text" mode. Tooltip "Paste Ctrl+V" во dropzone. | 0.5 ден |
| **S42-E3** | Multi-language OCR | Dropdown во "Напредни параметри" (МК / СР / ХР / РУ / ТР / ЕН / Auto). Помина како hint до `extractTextFromDocument({ pdfBase64, language })` и `extractTextFromImage(...)`. Prompt се менува: "Original language: <X>. ..." | 0.5 ден |
| **S42-E5** | Golden set per-language | Расти `eval/ocr-mk-golden.json` → folder `eval/ocr-golden/<lang>.json` со ист schema. Скриптата `eval-ocr-cyrillic.mjs` ги loop-ира сите јазици. | 0.5 ден |

**Вкупен ефорт:** ~2 дена (без снимање реални scan-ови).

---

## Излезни критериуми

- [x] PNG / JPEG / WEBP се прифаќа во dropzone, file-picker и paste
- [x] Ctrl+V на слика од clipboard ја вади истата OCR pipeline како и upload
- [x] Ctrl+V на текст ≥ 200 chars се пред-полнува во `manualTranscript`
- [x] Language dropdown се испраќа како hint и видлив во OCR prompt (`ExtractionHubView` advanced params → document mode)
- [x] `eval/ocr-golden/` има по една JSON за `mk`, `sr`, `hr`, `ru`, `tr`, `en` (5 samples секоја)
- [x] +29 нови unit тестови за helpers (image MIME detection, paste classifier, language-prompt builder, isOcrLanguage)
- [x] TSC 0 одржан, 0 нови `as any` / `@ts-ignore`

---

## Quality gates (не-преговарачки)

| Gate | Threshold | Резултат |
|---|---|---|
| TSC errors | 0 | ✅ 0 |
| Unit tests | ≥ 1089 (1079 + 10) | ✅ 1108 (+29) |
| `as any` / `@ts-ignore` | 0 нови | ✅ 0 |
| `npm run prompts:check` | green | ✅ |
| `npm run eval:ocr-recall` | non-blocking (во CI) | ✅ multi-lang |

---

## Принципи

1. **Не break-нувај** постојниот PDF/DOCX/TXT path.
2. **Pure helpers** одделно (`extractionHubHelpers.ts`) за тестабилност.
3. **Conventional commit:** `feat-s42-<id>`.
4. **Roadmap evidence log** ажуриран по секоја задача.
