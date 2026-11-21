"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Overlay, { defaultItems } from "@/components/Overlay";
import Editor from "@/components/Editor";
import Scene from "@/components/Scene";
import { BlurFade } from "@/components/ui/blur-fade";
import { GLYPH } from "@/lib/env";
import { getDay, saveDay } from "@/lib/store";
import type { DayPassport, SceneItem } from "@/lib/types";

export default function DayPage() {
  const { id } = useParams<{ id: string }>();
  const [day, setDay] = useState<DayPassport | null | undefined>(undefined);
  const [items, setItems] = useState<SceneItem[]>([]);
  const [edit, setEdit] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Плейлист и текущий трек
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [noPreview, setNoPreview] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  // Загрузка дня
  useEffect(() => {
    getDay(id).then((d) => {
      setDay(d ?? null);
      if (d) {
        const loaded = d.items && d.items.length > 0 ? d.items : defaultItems(d);
        setItems(loaded);
      }
    });
  }, [id]);

  const playlist = day?.playlist && day.playlist.length > 0 ? day.playlist : day ? [day.song] : [];
  const activeSong = playlist[currentSongIndex] || day?.song;

  // Воспроизведение трека при смене активного трека в плейлисте
  useEffect(() => {
    if (!activeSong) return;
    let dead = false;
    let off = () => {};
    const a = new Audio();
    a.loop = true;
    audio.current = a;
    setPlaying(false);
    setNoPreview(false);

    (async () => {
      const dz = activeSong.deezerId;
      const q = `title=${encodeURIComponent(activeSong.title)}&artist=${encodeURIComponent(activeSong.artist)}`;
      const url = dz ? `/api/song?deezerId=${dz}&${q}` : `/api/song?${q}`;

      const j = await fetch(url).then((r) => r.json()).catch(() => null);
      if (dead) return;

      if (j?.coverUrl && j.coverUrl !== activeSong.coverUrl) {
        setDay((prev) => {
          if (!prev) return prev;
          const pl = prev.playlist && prev.playlist.length > 0 ? [...prev.playlist] : [{ ...prev.song }];
          if (pl[currentSongIndex]) {
            pl[currentSongIndex] = { ...pl[currentSongIndex], coverUrl: j.coverUrl };
          }
          const updatedSong = currentSongIndex === 0 ? { ...prev.song, coverUrl: j.coverUrl } : prev.song;
          const updatedDay = { ...prev, song: updatedSong, playlist: pl };
          saveDay(updatedDay).catch(() => {});
          return updatedDay;
        });
      }

      if (!j?.preview) return setNoPreview(true);
      a.src = j.preview;
        const offset = activeSong.startTime ?? 0;
        if (offset > 0) {
          a.currentTime = offset;
        }
        try {
          await a.play();
          if (!dead) setPlaying(true);
        } catch {
          const go = (e: Event) => {
            if ((e.target as Element).closest("[data-disc]")) return;
            window.removeEventListener("pointerdown", go);
            if (offset > 0) a.currentTime = offset;
            a.play().then(() => !dead && setPlaying(true)).catch(() => {});
          };
          window.addEventListener("pointerdown", go);
          off = () => window.removeEventListener("pointerdown", go);
        }
      })();

    return () => {
      dead = true;
      off();
      a.pause();
      a.src = "";
      speechSynthesis.cancel();
    };
  }, [activeSong]);

  function toggleMusic() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else {
      a.pause();
      setPlaying(false);
    }
  }

  function nextTrack() {
    if (!playlist.length) return;
    setCurrentSongIndex((prev) => (prev + 1) % playlist.length);
  }

  function prevTrack() {
    if (!playlist.length) return;
    setCurrentSongIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  }

  function speak() {
    if (!day) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(day.text);
    u.lang = "ru-RU";
    u.rate = 0.75 + 0.5 * day.mood.arousal;
    u.pitch = 0.8 + 0.4 * day.mood.valence;
    speechSynthesis.speak(u);
  }

  // Сохранение изменений в IndexedDB
  async function persistChanges() {
    if (!day) return;
    const updated: DayPassport = { ...day, items };
    await saveDay(updated);
    setDay(updated);
  }

  if (day === undefined) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <div className="h-8 w-44 rounded-full bg-stone-200/60 animate-pulse" />
        <div className="grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,620px)_1fr] items-start">
          <div className="aspect-[4/5] w-full rounded-md bg-stone-200/50 animate-pulse" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 rounded-lg bg-stone-200/60 animate-pulse" />
            <div className="h-28 w-full rounded-lg bg-stone-200/40 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }
  if (day === null) {
    return (
      <main className="p-10">
        День не найден.{" "}
        <Link className="underline" href="/">
          В архив
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-8 overflow-x-hidden min-w-0">
      {/* Верхняя навигационная панель */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <Link href="/" className="font-mono text-sm text-muted hover:text-[var(--foreground)] transition shrink-0">
          ← архив воспоминаний
        </Link>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 max-w-full">
          {/* Мини-плеер с навигацией по трекам */}
          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/70 p-1 shadow-sm backdrop-blur max-w-full">
            {playlist.length > 1 && (
              <button
                onClick={prevTrack}
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-stone-200 transition text-xs shrink-0"
                title="Предыдущий трек"
              >
                ⏮
              </button>
            )}

            <button
              onClick={toggleMusic}
              disabled={noPreview}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 py-1 font-mono text-xs transition ${
                playing
                  ? "border border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "bg-white/60 text-muted hover:border-[var(--foreground)]"
              } disabled:opacity-40 min-w-0`}
              title={noPreview ? "Превью недоступно" : playing ? "Пауза" : "Играть"}
            >
              <span className={playing ? "animate-spin text-sm" : "text-sm"}>{playing ? "💿" : "▶"}</span>
              <span className="truncate max-w-[110px] sm:max-w-[150px]">
                {noPreview ? "без звука" : activeSong?.title || "песня"}
              </span>
            </button>

            {playlist.length > 1 && (
              <button
                onClick={nextTrack}
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-stone-200 transition text-xs shrink-0"
                title="Следующий трек"
              >
                ⏭
              </button>
            )}
          </div>

          {/* Кнопка включения режима кастомизации */}
          <button
            onClick={() => {
              setEdit((prev) => !prev);
              setSel(null);
            }}
            className={`flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 font-mono text-xs font-medium transition shrink-0 ${
              edit
                ? "bg-rose-600 text-white shadow-md"
                : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
            }`}
          >
            <span>{edit ? "✕ Закрыть редактор" : "✨ Кастомизация"}</span>
          </button>
        </div>
      </div>

      {/* Панель редактора (если включен режим редактирования) */}
      {edit && (
        <BlurFade>
          <Editor
            day={day}
            setDay={setDay}
            items={items}
            setItems={setItems}
            sel={sel}
            setSel={setSel}
            onSave={persistChanges}
            onClose={() => setEdit(false)}
          />
        </BlurFade>
      )}

      {/* Основная сетка: Постер с винилом и элементами + Описание */}
      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,620px)_1fr] items-start min-w-0">
        {/* Интерактивный холст с генеративным артом и оверлеем */}
        <BlurFade>
          <div className="space-y-3 min-w-0">
            <div className="relative rounded-md shadow-2xl transition hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] overflow-hidden sm:overflow-visible">
              {/* Генеративный живописный холст */}
              <Scene day={day} activeSong={activeSong} />

              {/* Интерактивный слой: увеличенный винил, погода, карта, стикеры, кассета */}
              <Overlay
                day={day}
                items={items}
                setItems={setItems}
                edit={edit}
                sel={sel}
                setSel={setSel}
                playing={playing}
                noPreview={noPreview}
                onDisc={toggleMusic}
                activeSong={activeSong}
                currentSongIndex={currentSongIndex}
              />
            </div>

            <div className="flex items-center justify-between font-mono text-xs text-muted px-1">
              <span>Клик по винилу ставит на паузу / играет</span>
              {day.weather && (
                <span>
                  {GLYPH[day.weather.kind]} {day.weather.temp > 0 ? "+" : ""}
                  {day.weather.temp}°C {day.weather.label}
                </span>
              )}
            </div>

            {/* Галерея оригинальных фотографий дня */}
            {day.photos && day.photos.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-white/70 p-4 space-y-3 backdrop-blur shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📸</span>
                    <span className="font-mono text-xs uppercase tracking-wider font-semibold text-stone-800">
                      Фотографии дня ({day.photos.length})
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted">
                    Нажмите для увеличения
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {day.photos.map((src, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedPhoto(src)}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-stone-100 cursor-pointer shadow-sm hover:shadow-md transition"
                      title="Открыть фото в полном размере"
                    >
                      <img
                        src={src}
                        alt={`Фото дня #${i + 1}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      {i === 0 && (
                        <div className="absolute top-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow backdrop-blur">
                          ⭐ Обложка
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-[11px] font-mono bg-black/70 px-2 py-0.5 rounded shadow transition">
                          🔍 открыть
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </BlurFade>

        {/* Правая колонка с описанием дня, плейлистом и контекстом */}
        <aside className="space-y-7">
          <div>
            <div className="flex items-center gap-3 font-mono text-xs text-muted">
              <span>{day.date}</span>
              {day.geo?.place && (
                <>
                  <span>•</span>
                  <span>📍 {day.geo.place}</span>
                </>
              )}
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-serif font-bold leading-tight break-words">{day.title}</h1>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-stone-700 whitespace-pre-wrap break-words">{day.text}</p>
          </div>

          {/* Интерактивные действия */}
          <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-2">
            <button
              onClick={speak}
              className="rounded-full border border-[var(--foreground)] px-4 sm:px-5 py-2 sm:py-2.5 font-mono text-xs sm:text-sm hover:bg-black/5 transition"
            >
              🎙️ озвучить
            </button>
            {activeSong && (
              <a
                href={activeSong.link}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--border)] px-4 sm:px-5 py-2 sm:py-2.5 font-mono text-xs sm:text-sm text-muted hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition truncate max-w-full"
              >
                ♪ открыть «{activeSong.title}» ↗
              </a>
            )}
          </div>

          {/* Саундтрек дня / Плейлист */}
          <div className="rounded-xl border border-[var(--border)] bg-white/60 p-5 space-y-4 backdrop-blur shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💿</span>
                <h3 className="font-mono text-xs uppercase tracking-wider font-bold">
                  Саундтрек дня ({playlist.length} {playlist.length === 1 ? "трек" : "трека"})
                </h3>
              </div>
              {playlist.length > 1 && (
                <div className="flex items-center gap-1 font-mono text-xs">
                  <button
                    onClick={prevTrack}
                    className="rounded-full px-2 py-0.5 border border-stone-300 hover:bg-stone-100 transition"
                    title="Предыдущий"
                  >
                    ⏮
                  </button>
                  <span className="text-muted text-[11px] px-1">
                    {currentSongIndex + 1}/{playlist.length}
                  </span>
                  <button
                    onClick={nextTrack}
                    className="rounded-full px-2 py-0.5 border border-stone-300 hover:bg-stone-100 transition"
                    title="Следующий"
                  >
                    ⏭
                  </button>
                </div>
              )}
            </div>

            {/* Список треков плейлиста */}
            <div className="divide-y divide-stone-200/60 font-mono">
              {playlist.map((track, idx) => {
                const isActive = idx === currentSongIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (idx !== currentSongIndex) {
                        setCurrentSongIndex(idx);
                      } else {
                        toggleMusic();
                      }
                    }}
                    className={`group flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition ${
                      isActive ? "bg-stone-900 text-white shadow-sm" : "hover:bg-stone-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs ${isActive ? "text-rose-400 font-bold" : "text-muted"}`}>
                        {isActive && playing ? "▶" : String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-serif font-semibold text-sm truncate">{track.title}</div>
                        <div className={`text-xs truncate ${isActive ? "text-stone-300" : "text-muted"}`}>
                          {track.artist} {track.year ? `· ${track.year}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          на виниле
                        </span>
                      )}
                      <a
                        href={track.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1 text-xs opacity-60 hover:opacity-100 ${
                          isActive ? "text-white" : "text-muted"
                        }`}
                        title="Открыть трек"
                      >
                        ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Карточка погоды и метаданных дня */}
          <div className="rounded-xl border border-[var(--border)] bg-white/50 p-5 space-y-4 backdrop-blur">
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted font-semibold">
              Атмосфера и контекст дня
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-stone-100/70 p-3">
                <span className="block font-mono text-[11px] text-muted">ПОГОДА</span>
                <span className="font-medium">
                  {day.weather
                    ? `${GLYPH[day.weather.kind]} ${day.weather.temp > 0 ? "+" : ""}${day.weather.temp}°C, ${day.weather.label}`
                    : "Не указана"}
                </span>
                {day.weather && (
                  <span className="block font-mono text-[11px] text-muted mt-0.5">
                    Ветер {day.weather.wind} км/ч
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-stone-100/70 p-3">
                <span className="block font-mono text-[11px] text-muted">ЛОКАЦИЯ</span>
                <span className="font-medium truncate block">
                  {day.geo?.place || (day.geo ? `${day.geo.lat}, ${day.geo.lon}` : "Не указана")}
                </span>
                <span className="block font-mono text-[11px] text-muted mt-0.5">
                  {day.context.season}, {day.context.timeOfDay}
                </span>
              </div>
            </div>

            {/* Детали настроения и художественного стиля */}
            {day.why && day.why.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3">
                <span className="block font-mono text-[11px] text-muted uppercase tracking-wider mb-1.5">
                  Настроение постера:
                </span>
                <ul className="space-y-1 font-mono text-xs text-muted list-disc list-inside">
                  {day.why
                    .filter((r) => !r.includes("llm") && !r.includes("оценены по названию"))
                    .map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Модальное окно просмотра оригинального фото в полном размере */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-[92vw] overflow-hidden rounded-2xl bg-black shadow-2xl border border-white/10"
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-rose-600 transition shadow"
              title="Закрыть"
            >
              ✕
            </button>
            <img
              src={selectedPhoto}
              alt="Фотография воспоминания"
              className="max-h-[88vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </main>
  );
}
