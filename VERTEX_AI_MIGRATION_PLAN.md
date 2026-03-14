# Акционен План: Миграција кон Google Cloud Vertex AI (Преку Firebase)

Овој документ ги дефинира чекорите за транзиција на апликацијата од користење на `Google Generative AI SDK` (со API клучеви преку Vercel Serverless Functions) кон `Firebase Vertex AI SDK`. Ова е критичен инфраструктурен чекор за безбедност, приватност на податоци и скалабилност на национално ниво.

## Зошто Vertex AI?
1. **Безбедност на податоци**: Vertex AI не користи кориснички податоци за тренинг на моделите.
2. **Стабилност**: Enterprise SLA, без `429 Quota Exceeded` грешки како кај бесплатниот AI Studio.
3. **Архитектура**: Потполна интеграција со постоечкиот Firebase екосистем. Отстранување на зависноста од ротација на API клучеви (`GEMINI_API_KEY_1`, `2`, итн.).

---

## ЧЕКОР 1: Подготовка на Google Cloud Environment
- [ ] Креирање/Поврзување на Google Cloud Project со постоечкиот Firebase Project (`math-curriculum-ai-navigator`).
- [ ] Овозможување на **Vertex AI API** во Google Cloud Console.
- [ ] Конфигурирање на Billing Account (задолжително за Vertex AI, дури и за free-tier usage преку Firebase).
- [ ] Овозможување на **Firebase App Check** (за заштита од злоупотреба на бекендот од неовластени клиенти).

## ЧЕКОР 2: Инсталација и Конфигурација на SDK
- [ ] Инсталирање на новиот SDK: `npm install firebase/vertexai-preview` (или најновата стабилна верзија).
- [ ] Ажурирање на `firebaseConfig.ts` за да се иницијализира Vertex AI сервисот:
  ```typescript
  import { getVertexAI } from "firebase/vertexai-preview";
  // ... постоечка иницијализација на app ...
  export const vertexAI = getVertexAI(app);
  ```

## ЧЕКОР 3: Миграција на Core AI Логиката (`services/gemini/core.ts`)
- [ ] Замена на импортот: Од `@google/generative-ai` кон `firebase/vertexai-preview`.
- [ ] Рефакторирање на `generateContent` и `generateContentStream` функциите да го користат `vertexAI` инстанцираниот објект наместо испраќање HTTP POST барања до `/api/gemini`.
  * *Забелешка: Со ова, Vercel Serverless функциите (`api/gemini.ts`, `api/gemini-stream.ts`) стануваат непотребни, бидејќи Firebase Vertex SDK директно и безбедно комуницира со Google Cloud од клиентот, користејќи Firebase Auth за автентикација.*

## ЧЕКОР 4: Адаптација на Моделите и Функционалностите
- [ ] Ажурирање на имињата на моделите според Vertex AI номенклатурата (може да имаат мали разлики од AI Studio).
- [ ] Проверка и адаптација на **Structured Outputs** (JSON Schema). Vertex AI има стриктни правила за дефинирање на шеми.
- [ ] Миграција на `gemini-embed.ts` (векторското пребарување) да користи Vertex AI Text Embeddings API (`text-embedding-004` или сличен еквивалент).
- [ ] Тестирање на мултимодалните влезови (слики од учебници) со новиот SDK.

## ЧЕКОР 5: Безбедност и Firebase Rules
- [ ] Поставување на стриктни **App Check** правила во Firebase конзолата за да се осигура дека само верификуваната апликација (од точниот домен) може да ги повикува Vertex AI моделите.
- [ ] Отстранување на логиката за ротација на API клучеви од `.env` фајловите.

## ЧЕКОР 6: Тестирање и Пуштање во Продукција (Deployment)
- [ ] Креирање на тестови кои верификуваат дека генерирањето на сценарија, квизови и сугестии работи идентично или побрзо.
- [ ] Мониторинг на трошоците во Google Cloud Console во првите 48 часа.
- [ ] Бришење на старите `/api/gemini*.ts` фајлови откако миграцијата ќе биде 100% стабилна.