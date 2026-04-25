# Status Page Setup — UptimeRobot

**Цел:** Јавно достапна status страна `status.ai.mismath.net` со уptime монитор за `/api/health`.
**Estimated setup time:** 30 минути
**Cost:** $0 (free tier е доволен за демонстрација пред МОН)

---

## Опции за провајдер

| Провајдер | Free tier | Public page | Препорачано? |
|---|---|---|---|
| **UptimeRobot** | 50 monitors, 5-min checks | ✓ | ✓ За МОН демо |
| **BetterStack (Better Uptime)** | 10 monitors, 30-sec checks | ✓ | За production scale |
| **Cronitor** | 5 monitors | ✓ | Алтернатива |
| **Statuspage by Atlassian** | $29/mes | ✓ | За >5 услуги |

---

## Чекор-по-чекор: UptimeRobot

### 1. Регистрација (3 мин)
1. Оди на https://uptimerobot.com/signUp
2. Регистрирај со admin email (нпр. `ops@ai.mismath.net`)
3. Потврди ја email адресата

### 2. Креирај Monitor за `/api/health` (5 мин)
1. Dashboard → **+ Add New Monitor**
2. **Monitor Type:** HTTP(s)
3. **Friendly Name:** `Math Curriculum AI — Production Health`
4. **URL:** `https://ai.mismath.net/api/health`
5. **Monitoring Interval:** 5 minutes (free tier)
6. **Monitor Timeout:** 30 seconds
7. **HTTP Method:** GET
8. **Expected status code:** 200
9. **Keyword (Advanced):** `"status":"ok"` (response body validation)
10. Save

### 3. Креирај дополнителни monitors (по 2 мин секој)
| Friendly Name | URL | Тип |
|---|---|---|
| Frontend SPA | `https://ai.mismath.net` | HTTP(s) |
| Login page | `https://ai.mismath.net/#/login` | HTTP(s) |
| Web Vitals API | `https://ai.mismath.net/api/web-vitals` | HTTP(s), keyword `samples` |

### 4. Креирај Public Status Page (10 мин)
1. Dashboard → **Status Pages** → **+ Add Status Page**
2. **Friendly Name:** „Math Curriculum AI — Status"
3. **Custom Domain:** `status.ai.mismath.net` (или free `stats.uptimerobot.com/XXXXX` ако нема домен)
4. **Monitors to display:** Сите 4 од погоре
5. **Design:**
   - Logo: Прикачи logo.png
   - Theme: Light
   - Subscribed users get email на инцидент: ✓
6. **Custom CSS (optional):** За брендирање
7. Save → копирај го јавниот URL

### 5. DNS за custom subdomain (5 мин)
Во провајдерот за DNS (Cloudflare / Vercel DNS):
```
Type: CNAME
Name: status
Value: stats.uptimerobot.com
TTL: 3600
```
UptimeRobot ќе го верификува за ~10 минути.

### 6. Notification channels (5 мин)
1. **My Settings → Alert Contacts**
2. Додај:
   - Email: `ops@ai.mismath.net`
   - Slack webhook (ако има): copy webhook URL од Slack app config
   - SMS (Pro plan)
3. Назад во Monitor → **Alert Contacts** → штиклирај ги новите канали
4. **Send alert when:** Down for 2 consecutive checks (10 мин — намалува flapping)

---

## Очекуван SLA

| Метрика | Цел | Реалност (Vercel + Firebase) |
|---|---|---|
| Uptime | 99.9% (< 8.7 ч/година) | Vercel SLA 99.99%, Firebase 99.95% |
| TTFB на `/api/health` | < 200 ms | ~50 ms |
| Detection time | < 10 мин | 5-min check × 2 = 10 мин max |

---

## Верификација пред МОН презентација

```bash
# Локално, провери дека endpoint-от живее
curl -i https://ai.mismath.net/api/health

# Очекуван одговор:
# HTTP/2 200
# content-type: application/json
# {"status":"ok","service":"math-curriculum-ai-navigator", ...}
```

Status page треба да покажува сите 4 monitor-и зелени за најмалку 7 дена пред МОН презентацијата.

---

## Trouble-shooting

| Симптом | Причина | Решение |
|---|---|---|
| 401 на `/api/health` | Auth wrapper погрешно applied | Провери дека health.ts нема `verifyAuth` middleware |
| 404 | Vercel route mismatch | Провери `vercel.json` rewrites |
| Custom domain не функционира | DNS пропагација | Wait 24h + dig CNAME проверка |
| Status page празна | Monitors not assigned | Status Pages → Edit → Add Monitors |

---

## Алтернатива: Vercel Built-in

Vercel самата има metrics dashboard, но **не е јавна** — не може да се сподели со МОН без admin пристап. Затоа UptimeRobot е препорачаната опција за публичен JS на status-страна.

---

*Документ генериран како дел од S41-D5 (МОН-readiness sprint).*
