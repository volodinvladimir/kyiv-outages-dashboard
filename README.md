# Kyiv Outages Dashboard (YASNO)

Статична сторінка для GitHub Pages, яка показує графіки відключень для Києва по всіх групах на сьогодні і (якщо є) на завтра.

Джерело даних: YASNO API endpoint `https://api.yasno.com.ua/api/v1/pages/home/schedule-turn-off-electricity` (структура з `components[]`, де шукаємо `template_name = electricity-outages-daily-schedule`).

## Як запустити на GitHub Pages (безкоштовно)
1) Створи репозиторій і залий файли.
2) Settings → Pages → Deploy from a branch → `main` / root.
3) (Опційно) увімкни Actions: workflow `.github/workflows/yasno-fetch.yml` — тоді буде "кеш" оновлюватись щогодини і сторінка зможе брати дані навіть якщо браузер блокує CORS.

## Локально
Відкрий `index.html` будь-яким локальним сервером (наприклад `python -m http.server`), бо fetch локальних файлів у браузері напряму може бути заблокований.
