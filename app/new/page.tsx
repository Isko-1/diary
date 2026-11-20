"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { defaultItems } from "@/components/Overlay";
import { BlurFade } from "@/components/ui/blur-fade";
import { fetchWeather, geocode, getGeo, reverse, GLYPH } from "@/lib/env";
import { fuse } from "@/lib/fuse";
import { analyzeAll, fileToDataUrl } from "@/lib/photo";
import { saveDay } from "@/lib/store";
import { pickStyle, weatherTweak } from "@/lib/style";
import type { DayPassport, Geo, Song, Weather } from "@/lib/types";

const post = async (url: string, body: unknown) => {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

export default function NewDay() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Геолокация и погода
  const [geo, setGeo] = useState<Geo | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [geoCity, setGeoCity] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");

  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  // Автоматическое определение по GPS (с разрешения пользователя)
  async function detectLocation() {
    setGeoLoading(true);
    setGeoMsg("Запрашиваем разрешение на геолокацию в браузере…");
    try {
      const g = await getGeo();
      setGeoMsg("Координаты получены. Определяем район и погоду…");
      const [place, w] = await Promise.all([reverse(g), fetchWeather(g, date)]);
      const resolvedGeo = { ...g, place: place || g.place };
      setGeo(resolvedGeo);
      setWeather(w);
      setGeoMsg(`Локация определена: ${resolvedGeo.place || `${g.lat}, ${g.lon}`}`);
    } catch (e: any) {
      setGeoMsg(`Ошибка: ${e?.message || String(e)}`);
    } finally {
      setGeoLoading(false);
    }
  }

  // Ручной поиск по названию города
  async function searchCity() {
    if (!geoCity.trim()) return;
    setGeoLoading(true);
    setGeoMsg("Ищем город через Open-Meteo…");
    try {
      const g = await geocode(geoCity);
      if (!g) {
        setGeoMsg("Город не найден. Проверьте написание.");
        return;
      }
      setGeoMsg(`Найден: ${g.place}. Запрашиваем погоду за ${date}…`);
      const w = await fetchWeather(g, date);
      setGeo(g);
      setWeather(w);
      setGeoMsg(`Локация сохранена: ${g.place}`);
    } catch (e: any) {
      setGeoMsg(`Ошибка: ${e?.message || String(e)}`);
    } finally {
      setGeoLoading(false);
    }
  }

  function clearGeo() {
    setGeo(null);
    setWeather(null);
    setGeoMsg("");
    setGeoCity("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (text.trim().length < 5 || !files.length || !link.trim()) {
      return setErr("Нужны текст, хотя бы одно фото и песня.");
    }

    try {
      setBusy("Читаю фото…");
      const photos = await Promise.all(files.map((f) => fileToDataUrl(f)));
      const photoStats = await analyzeAll(photos);

      setBusy("Слушаю текст и песню…");
      const [a, song] = (await Promise.all([
        post("/api/analyze-day", { text }),
        post("/api/song", { link }),
      ])) as [any, Song];

      const base = {
        id: crypto.randomUUID(),
        date,
        title: a.title,
        text,
        photos,
        song,
        textMood: a.textMood,
        photoStats,
        context: a.context,
        geo: geo || undefined,
        weather: weather || undefined,
      };

      const { mood, why } = fuse(base);
      let { style, why: why2 } = pickStyle(mood, song, a.context, photoStats);

      // Если есть погода — модифицируем визуальный стиль и текстуру
      let extraWhy: string[] = [];
      if (weather) {
        const tw = weatherTweak(style, weather);
        style = tw.style;
        extraWhy = tw.why;
      }

      // Формируем начальные элементы сцены (увеличенный винил, погода, карта)
      const dayDraft: DayPassport = {
        ...base,
        mood,
        style,
        why: [...why, ...why2, ...extraWhy],
      };
      dayDraft.items = defaultItems(dayDraft);

      setBusy("Собираю воспоминание…");
      await saveDay(dayDraft);
      router.push(`/day/${dayDraft.id}`);
    } catch (x) {
      setErr(String(x));
      setBusy("");
    }
  }

  const field =
    "w-full rounded-lg border border-[var(--border)] bg-white/60 px-4 py-3 outline-none focus:border-[var(--foreground)] transition";

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="font-mono text-sm text-muted hover:text-[var(--foreground)] transition">
        ← архив
      </Link>
      <BlurFade>
        <h1 className="mt-4 text-4xl">Как прошёл день?</h1>
      </BlurFade>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <BlurFade delay={0.1}>
          <label className="block font-mono text-xs text-muted mb-2">ИСТОРИЯ ДНЯ</label>
          <textarea
            className={field + " min-h-40"}
            placeholder="Расскажите так, как рассказали бы близкому другу: погода, свет, люди, мелочи…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </BlurFade>

        <BlurFade delay={0.15}>
          <label className="block font-mono text-xs text-muted">
            ФОТО (1 и больше)
            <input
              className={field + " mt-2"}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles([...(e.target.files ?? [])])}
            />
          </label>
        </BlurFade>

        <BlurFade delay={0.2}>
          <label className="block font-mono text-xs text-muted">
            ПЕСНЯ (ссылка YouTube / Spotify или «артист - название»)
            <input
              className={field + " mt-2"}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://open.spotify.com/track/… или Queen - Bohemian Rhapsody"
            />
          </label>
        </BlurFade>

        <BlurFade delay={0.25}>
          <label className="block font-mono text-xs text-muted">
            ДАТА
            <input
              className={field + " mt-2"}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </BlurFade>

        {/* Секция: Погода и геолокация */}
        <BlurFade delay={0.3}>
          <div className="rounded-xl border border-[var(--border)] bg-white/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs text-muted uppercase tracking-wider font-semibold">
                📍 Геолокация и погода (по желанию)
              </label>
              {(geo || weather) && (
                <button
                  type="button"
                  onClick={clearGeo}
                  className="font-mono text-xs text-rose-600 hover:underline"
                >
                  Очистить
                </button>
              )}
            </div>

            {/* Карточка уже определенной погоды */}
            {weather || geo ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-4 space-y-1">
                <div className="flex items-center gap-3">
                  {weather && <span className="text-3xl">{GLYPH[weather.kind]}</span>}
                  <div>
                    <div className="font-semibold text-stone-900">
                      {weather ? `${weather.temp > 0 ? "+" : ""}${weather.temp}°C, ${weather.label}` : "Погода загружается"}
                      {geo?.place && ` · ${geo.place}`}
                    </div>
                    {weather && (
                      <div className="font-mono text-xs text-stone-600">
                        Ветер: {weather.wind} км/ч · Координаты: {geo?.lat}, {geo?.lon}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={geoLoading}
                  onClick={detectLocation}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 font-mono text-xs font-medium hover:border-[var(--foreground)] transition disabled:opacity-50"
                >
                  <span>🛰️</span>
                  <span>{geoLoading ? "Определяем местоположение…" : "Определить по GPS (запрос разрешения)"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={geoCity}
                    onChange={(e) => setGeoCity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchCity();
                      }
                    }}
                    placeholder="Или введите город (Москва, Алматы, Рим...)"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-white/60 px-3 py-2 font-mono text-xs outline-none focus:border-[var(--foreground)]"
                  />
                  <button
                    type="button"
                    disabled={geoLoading || !geoCity.trim()}
                    onClick={searchCity}
                    className="rounded-lg bg-[var(--foreground)] px-4 py-2 font-mono text-xs text-[var(--background)] disabled:opacity-50"
                  >
                    Найти
                  </button>
                </div>
              </div>
            )}

            {geoMsg && (
              <p className="font-mono text-xs text-stone-600 bg-white/70 p-2 rounded">
                {geoMsg}
              </p>
            )}
          </div>
        </BlurFade>

        {err && <p className="text-sm text-red-700">{err}</p>}

        <button
          disabled={!!busy}
          className="rounded-full bg-[var(--foreground)] px-8 py-3.5 font-mono text-sm text-[var(--background)] disabled:opacity-50 transition hover:opacity-90 cursor-pointer"
        >
          {busy || "создать воспоминание →"}
        </button>
      </form>
    </main>
  );
}
