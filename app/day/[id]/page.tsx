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

  // Песня включается сама при открытии дня или при первом клике
  useEffect(() => {
    if (!day) return;
    let dead = false;
    let off = () => {};
    const a = new Audio();
    a.loop = true;
    audio.current = a;
    setPlaying(false);
    setNoPreview(false);

    (async () => {
      const dz = day.song.deezerId;
      const j = dz ? await fetch(`/api/song?deezerId=${dz}`).then((r) => r.json()).catch(() => null) : null;
      if (dead) return;
      if (!j?.preview) return setNoPreview(true);
      a.src = j.preview;
      try {
        await a.play();
        if (!dead) setPlaying(true);
      } catch {
        const go = (e: Event) => {
          if ((e.target as Element).closest("[data-disc]")) return;
          window.removeEventListener("pointerdown", go);
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
  }, [day]);

  function toggleMusic() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else {
      a.pause();
      setPlaying(false);
    }
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

  if (day === undefined) return null;
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
    <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
      {/* Верхняя навигационная панель */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <Link href="/" className="font-mono text-sm text-muted hover:text-[var(--foreground)] transition">
          ← архив воспоминаний
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {/* Индикатор музыки */}
          <button
            onClick={toggleMusic}
            disabled={noPreview}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs transition ${
              playing
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-[var(--border)] bg-white/60 text-muted hover:border-[var(--foreground)]"
            } disabled:opacity-40`}
            title={noPreview ? "Превью недоступно" : playing ? "Пауза" : "Играть"}
          >
            <span className={playing ? "animate-spin text-sm" : "text-sm"}>{playing ? "💿" : "▶"}</span>
            <span>{noPreview ? "без звука" : playing ? "играет музыка" : "включить музыку"}</span>
          </button>

          {/* Кнопка включения режима кастомизации */}
          <button
            onClick={() => {
              setEdit((prev) => !prev);
              setSel(null);
            }}
            className={`flex items-center gap-2 rounded-full px-5 py-2 font-mono text-xs font-medium transition ${
              edit
                ? "bg-rose-600 text-white shadow-md"
                : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
            }`}
          >
            <span>{edit ? "✕ Закрыть редактор" : "✨ Кастомизация сцены"}</span>
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
      <div className="grid gap-10 lg:grid-cols-[minmax(0,620px)_1fr] items-start">
        {/* Интерактивный холст с генеративным артом и оверлеем */}
        <BlurFade>
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-md shadow-2xl transition hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]">
              {/* Генеративный живописный холст */}
              <Scene day={day} />

              {/* Интерактивный слой: увеличенный винил, погода, карта, стикеры, заметки */}
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
              />
            </div>

            <div className="flex items-center justify-between font-mono text-xs text-muted px-1">
              <span>Клик по винилу включает/выключает музыку</span>
              {day.weather && (
                <span>
                  {GLYPH[day.weather.kind]} {day.weather.temp > 0 ? "+" : ""}
                  {day.weather.temp}°C {day.weather.label}
                </span>
              )}
            </div>
          </div>
        </BlurFade>

        {/* Правая колонка с описанием дня и контекстом */}
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
            <h1 className="mt-2 text-4xl lg:text-5xl font-serif font-bold leading-tight">{day.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-stone-700 whitespace-pre-wrap">{day.text}</p>
          </div>

          {/* Интерактивные действия */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={speak}
              className="rounded-full border border-[var(--foreground)] px-5 py-2.5 font-mono text-sm hover:bg-black/5 transition"
            >
              🎙️ озвучить
            </button>
            <a
              href={day.song.link}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 font-mono text-sm text-muted hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition"
            >
              ♪ открыть песню ↗
            </a>
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

            {/* Почему подобрана эта живописная техника */}
            {day.why && day.why.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3">
                <span className="block font-mono text-[11px] text-muted uppercase tracking-wider mb-1.5">
                  Генеративный стиль:
                </span>
                <ul className="space-y-1 font-mono text-xs text-muted list-disc list-inside">
                  {day.why.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
