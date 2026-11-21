"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function NewDayForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [songs, setSongs] = useState<string[]>([""]);
  const [date, setDate] = useState("");

  useEffect(() => {
    const qDate = searchParams.get("date");
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      setDate(qDate);
    } else {
      const d = new Date();
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setDate(localDate);
    }
  }, [searchParams]);

  async function appendFiles(newFileList: FileList | File[]) {
    const incoming = Array.from(newFileList).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) return;
    const toAdd = incoming.filter(
      (f) => !files.some((p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified)
    );
    if (!toAdd.length) return;

    const loaded = await Promise.all(
      toAdd.map(async (file) => ({
        file,
        url: await readAsDataUrl(file),
      }))
    );

    setFiles((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...loaded]);
  }

  function removePhoto(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function makeCover(idx: number) {
    if (idx === 0) return;
    setFiles((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.unshift(item);
      return copy;
    });
    setPreviews((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.unshift(item);
      return copy;
    });
  }

  function movePhoto(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    setFiles((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
    setPreviews((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
  }

  function clearAllPhotos() {
    setFiles([]);
    setPreviews([]);
  }

  function addSongField() {
    setSongs((prev) => [...prev, ""]);
  }

  function removeSongField(idx: number) {
    setSongs((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSongField(idx: number, val: string) {
    setSongs((prev) => prev.map((s, i) => (i === idx ? val : s)));
  }

  // Геолокация и погода
  const [geo, setGeo] = useState<Geo | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [geoCity, setGeoCity] = useState("");
  const [geoCountry, setGeoCountry] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");

  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  // При смене даты пользователем: если геолокация уже есть, автоматически перезапрашиваем погоду за новую дату
  async function handleDateChange(newDate: string) {
    setDate(newDate);
    if (geo) {
      setGeoLoading(true);
      setGeoMsg(`Запрашиваем погоду строго за выбранную дату ${newDate}…`);
      try {
        const w = await fetchWeather(geo, newDate);
        setWeather(w);
        if (w) {
          setGeoMsg(`Погода обновлена за ${newDate}: ${w.temp > 0 ? "+" : ""}${w.temp}°C, ${w.label}`);
        } else {
          setGeoMsg(`Данные о погоде за ${newDate} недоступны в архиве.`);
        }
      } catch {
        setGeoMsg(`Ошибка получения погоды за ${newDate}.`);
      } finally {
        setGeoLoading(false);
      }
    }
  }

  // Ручной принудительный пересчет погоды по текущей выбранной дате
  async function refreshWeatherForDate() {
    if (!geo) return;
    setGeoLoading(true);
    setGeoMsg(`Обновляем погоду за ${date}…`);
    try {
      const w = await fetchWeather(geo, date);
      setWeather(w);
      if (w) {
        setGeoMsg(`Погода загружена за ${date}: ${w.temp > 0 ? "+" : ""}${w.temp}°C, ${w.label}`);
      }
    } catch {
      setGeoMsg(`Не удалось получить погоду за ${date}`);
    } finally {
      setGeoLoading(false);
    }
  }

  // Автоматическое определение по GPS (с разрешения пользователя) СТРОГО за выбранную дату
  async function detectLocation() {
    setGeoLoading(true);
    setGeoMsg(`Запрашиваем геолокацию и погоду за выбранную дату (${date})…`);
    try {
      const g = await getGeo();
      setGeoMsg(`Координаты получены. Запрашиваем архив/прогноз погоды за ${date}…`);
      const [place, w] = await Promise.all([reverse(g), fetchWeather(g, date)]);
      const resolvedGeo = { ...g, place: place || g.place };
      setGeo(resolvedGeo);
      setWeather(w);
      setGeoMsg(
        w
          ? `Успешно: ${resolvedGeo.place || `${g.lat}, ${g.lon}`} · погода за ${date}: ${w.temp > 0 ? "+" : ""}${w.temp}°C, ${w.label}`
          : `Локация: ${resolvedGeo.place || `${g.lat}, ${g.lon}`}. За ${date} данных погоды нет.`
      );
    } catch (e: any) {
      setGeoMsg(`Ошибка: ${e?.message || String(e)}`);
    } finally {
      setGeoLoading(false);
    }
  }

  // Ручной поиск по названию города и страны СТРОГО за выбранную дату
  async function searchCity() {
    if (!geoCity.trim()) return;
    setGeoLoading(true);
    const queryLabel = geoCountry.trim() ? `${geoCity.trim()}, ${geoCountry.trim()}` : geoCity.trim();
    setGeoMsg(`Ищем «${queryLabel}» и проверяем погоду за выбранную дату ${date}…`);
    try {
      const g = await geocode(geoCity, geoCountry);
      if (!g) {
        setGeoMsg("Город не найден. Проверьте написание города и страны.");
        return;
      }
      setGeoMsg(`Найден: ${g.place}. Запрашиваем погоду за ${date}…`);
      const w = await fetchWeather(g, date);
      setGeo(g);
      setWeather(w);
      setGeoMsg(
        w
          ? `Локация: ${g.place} · погода за ${date}: ${w.temp > 0 ? "+" : ""}${w.temp}°C, ${w.label}`
          : `Локация сохранена: ${g.place}.`
      );
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
    setGeoCountry("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const validSongs = songs.map((s) => s.trim()).filter(Boolean);
    if (text.trim().length < 5 || !files.length || !validSongs.length) {
      return setErr("Нужны текст, хотя бы одно фото и как минимум одна песня.");
    }

    try {
      setBusy("Подбираю цвета и палитру…");
      const photos =
        previews.length === files.length && previews.every((p) => p.url)
          ? previews.map((p) => p.url)
          : await Promise.all(files.map((f) => fileToDataUrl(f)));
      const photoStats = await analyzeAll(photos);

      setBusy("Настраиваю атмосферу дня…");
      const [a, ...fetchedSongs] = (await Promise.all([
        post("/api/analyze-day", { text, date }),
        ...validSongs.map((link) => post("/api/song", { link })),
      ])) as [any, ...Song[]];

      const mainSong = fetchedSongs[0];

      const base = {
        id: crypto.randomUUID(),
        date,
        title: a.title,
        text,
        photos,
        song: mainSong,
        playlist: fetchedSongs,
        textMood: a.textMood,
        photoStats,
        context: a.context,
        geo: geo || undefined,
        weather: weather || undefined,
      };

      const { mood, why } = fuse(base);
      let { style, why: why2 } = pickStyle(mood, mainSong, a.context, photoStats);

      // Если есть погода — модифицируем визуальный стиль и текстуру картины
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
        {/* ДАТА вынесена наверх, чтобы погода сразу привязывалась к выбранному дню */}
        <BlurFade delay={0.05}>
          <div className="rounded-xl border border-[var(--border)] bg-white/50 p-4">
            <label className="block font-mono text-xs text-muted font-semibold uppercase tracking-wider">
              📅 ДАТА ВОСПОМИНАНИЯ (погода запрашивается именно за этот день)
              <input
                className={field + " mt-2 font-mono text-sm"}
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </label>
          </div>
        </BlurFade>

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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-mono text-xs text-muted uppercase tracking-wider font-semibold">
                📷 ФОТОГРАФИИ ДНЯ {files.length > 0 && `(${files.length})`}
              </label>
              {files.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted hidden sm:inline">
                    ★ Первое фото станет центром винила и обложкой дня
                  </span>
                  <button
                    type="button"
                    onClick={clearAllPhotos}
                    className="font-mono text-xs text-rose-600 hover:underline"
                  >
                    Очистить все
                  </button>
                </div>
              )}
            </div>

            {/* Скрытый input с поддержкой множественного выбора */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  appendFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />

            {files.length === 0 ? (
              /* Зона Drag & Drop для первого добавления */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) appendFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
                  isDragging
                    ? "border-rose-500 bg-rose-50/70 scale-[1.01]"
                    : "border-[var(--border)] bg-white/40 hover:border-[var(--foreground)] hover:bg-white/70"
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl text-rose-600 shadow-sm">
                  📸
                </div>
                <div>
                  <div className="font-medium text-stone-900 text-sm sm:text-base">
                    Перетащите фотографии сюда или нажмите для выбора
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted">
                    Можно выбрать несколько файлов сразу или добавлять по одному
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-1 rounded-full border border-[var(--border)] bg-white px-5 py-2 font-mono text-xs font-medium shadow-sm hover:bg-stone-50"
                >
                  Выбрать фото на устройстве
                </button>
              </div>
            ) : (
              /* Галерея загруженных фотографий с возможностью добавления новых */
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {previews.map((item, idx) => (
                    <div
                      key={item.url}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-stone-100 shadow-sm"
                    >
                      {/* Изображение */}
                      <img
                        src={item.url}
                        alt={`Фото ${idx + 1}`}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      />

                      {/* Тёмный градиент для кнопок при наведении */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Метка обложки или номер фото */}
                      {idx === 0 ? (
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-amber-500/95 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow backdrop-blur">
                          <span>⭐</span>
                          <span>ОБЛОЖКА</span>
                        </div>
                      ) : (
                        <div className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur">
                          #{idx + 1}
                        </div>
                      )}

                      {/* Кнопка удаления */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(idx);
                        }}
                        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-rose-600 transition shadow"
                        title="Удалить это фото"
                      >
                        ✕
                      </button>

                      {/* Действия внизу карточки */}
                      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                movePhoto(idx, -1);
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-xs text-white hover:bg-black"
                              title="Переместить левее"
                            >
                              ◀
                            </button>
                          )}
                          {idx < previews.length - 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                movePhoto(idx, 1);
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-xs text-white hover:bg-black"
                              title="Переместить правее"
                            >
                              ▶
                            </button>
                          )}
                        </div>

                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              makeCover(idx);
                            }}
                            className="rounded bg-amber-500/90 px-2 py-1 font-mono text-[10px] font-medium text-white hover:bg-amber-600 shadow"
                            title="Сделать главной обложкой"
                          >
                            Обложка
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Кнопка добавления ещё фото в сетке */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) appendFiles(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center cursor-pointer transition ${
                      isDragging
                        ? "border-rose-500 bg-rose-50/70"
                        : "border-[var(--border)] bg-white/40 hover:border-[var(--foreground)] hover:bg-white/80"
                    }`}
                  >
                    <span className="text-2xl text-muted">➕</span>
                    <span className="font-mono text-xs font-medium text-stone-700">Добавить ещё</span>
                    <span className="font-mono text-[10px] text-muted">или перетащите</span>
                  </div>
                </div>

                <p className="font-mono text-[11px] text-muted">
                  Вы можете менять порядок фото стрелками или назначить любое фото главной обложкой карточки и винила.
                </p>
              </div>
            )}
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs text-muted uppercase tracking-wider font-semibold">
                🎵 ПЛЕЙЛИСТ ДНЯ (ссылка YouTube / Spotify или «артист - название»)
              </label>
              <span className="font-mono text-[11px] text-muted">
                {songs.length} {songs.length === 1 ? "трек" : "трека"}
              </span>
            </div>

            <div className="space-y-2">
              {songs.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="font-mono text-xs text-muted w-6 text-right">
                    {String(idx + 1).padStart(2, "0")}.
                  </span>
                  <input
                    className={field + " flex-1"}
                    value={s}
                    onChange={(e) => updateSongField(idx, e.target.value)}
                    placeholder={
                      idx === 0
                        ? "Главный трек дня (например: Depeche Mode - Enjoy The Silence)"
                        : `Дополнительный трек #${idx + 1}`
                    }
                  />
                  {songs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSongField(idx)}
                      className="rounded-lg p-2.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Удалить трек"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSongField}
              className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-white/40 px-4 py-2 font-mono text-xs text-muted hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition"
            >
              <span>+ Добавить трек в саундтрек дня</span>
            </button>
          </div>
        </BlurFade>

        {/* Секция: Погода и геолокация */}
        <BlurFade delay={0.25}>
          <div className="rounded-xl border border-[var(--border)] bg-white/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs text-muted uppercase tracking-wider font-semibold">
                📍 Погода и локация (за дату {date})
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

            {/* Карточка погоды с указанием даты */}
            {weather || geo ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {weather && <span className="text-3xl">{GLYPH[weather.kind]}</span>}
                    <div>
                      <div className="font-semibold text-stone-900">
                        {weather
                          ? `${weather.temp > 0 ? "+" : ""}${weather.temp}°C, ${weather.label}`
                          : "Погода для этой даты загружается"}
                        {geo?.place && ` · ${geo.place}`}
                      </div>
                      <div className="font-mono text-xs text-stone-600">
                        Погода именно за дату: <strong className="text-emerald-800">{date}</strong>
                        {weather && ` · Ветер ${weather.wind} км/ч`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={refreshWeatherForDate}
                    disabled={geoLoading}
                    className="rounded-full border border-emerald-600 bg-white px-3 py-1 font-mono text-xs text-emerald-800 hover:bg-emerald-50 transition"
                  >
                    🔄 Обновить за {date}
                  </button>
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
                  <span>
                    {geoLoading ? "Загружаем погоду…" : `Определить по GPS погоду за выбранную дату (${date})`}
                  </span>
                </button>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
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
                      placeholder="Город (например: Уральск, Рим...)"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-white/60 px-3 py-2 font-mono text-xs outline-none focus:border-[var(--foreground)]"
                    />
                    <input
                      type="text"
                      value={geoCountry}
                      onChange={(e) => setGeoCountry(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchCity();
                        }
                      }}
                      placeholder="Страна (например: Казахстан, Италия)"
                      className="sm:w-56 rounded-lg border border-[var(--border)] bg-white/60 px-3 py-2 font-mono text-xs outline-none focus:border-[var(--foreground)]"
                    />
                    <button
                      type="button"
                      disabled={geoLoading || !geoCity.trim()}
                      onClick={searchCity}
                      className="rounded-lg bg-[var(--foreground)] px-5 py-2 font-mono text-xs text-[var(--background)] disabled:opacity-50 transition cursor-pointer"
                    >
                      Найти
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-muted">
                    💡 Подсказка: если городов с таким названием несколько, укажите страну рядом (или напишите «Уральск, Казахстан»).
                  </p>
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

export default function NewDay() {
  return (
    <Suspense fallback={<div className="p-12 text-center font-mono text-muted">Загрузка...</div>}>
      <NewDayForm />
    </Suspense>
  );
}
