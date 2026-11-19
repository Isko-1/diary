# Дневник дней (GENESIS ArtTech)

Запись дня (текст + фото + песня) → анимированная сцена 4:5 на canvas → папка дня → архив.

## Запуск

```bash
npm install
cp .env.example .env.local   # вставьте ANTHROPIC_API_KEY (без ключа работает эвристика)
npm run dev
```

## Структура
- `lib/fuse.ts` — слияние текста, песни и фото в valence/arousal + строки `why`
- `lib/style.ts` — веса техник (Моне, Матисс, Кандинский, минимализм) и сдвиг палитры в OKLCH
- `lib/photo.ts` — палитра, яркость, контраст, тепло фото
- `components/Scene.tsx` — постоянные элементы + слои техник
- `app/api/analyze-day`, `app/api/song` — серверные роуты (ключи только тут)
- `components/ui/*` — Magic UI: magic-card, blur-fade, grid-pattern

## Использованные инструменты
Next.js, React, Tailwind CSS, Magic UI (magic-card, blur-fade, grid-pattern), motion, culori, idb-keyval, JSZip, Deezer API, oEmbed (YouTube/Spotify), ReccoBeats, Claude API (анализ текста и названия).

## Осталось (план)
- 20.11: папка дня (JSZip), speechSynthesis → Piper, Meyda для своих аудиофайлов
- 21.11: 5–7 дней разного настроения (`public/seed/days.json` + фото), мозаика и карта настроений
