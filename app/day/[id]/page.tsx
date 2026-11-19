"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Scene from "@/components/Scene";
import { BlurFade } from "@/components/ui/blur-fade";
import { getDay } from "@/lib/store";
import type { DayPassport } from "@/lib/types";

export default function DayPage() {
  const { id } = useParams<{ id: string }>();
  const [day, setDay] = useState<DayPassport | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [noPreview, setNoPreview] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { getDay(id).then((d) => setDay(d ?? null)); }, [id]);

  // Песня включается сама при открытии дня. Если браузер блокирует автозапуск,
  // музыка стартует с первого клика по странице.
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

    return () => { dead = true; off(); a.pause(); a.src = ""; speechSynthesis.cancel(); };
  }, [day]);

  function toggleMusic() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
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

  if (day === undefined) return null;
  if (day === null) return <main className="p-10">День не найден. <Link className="underline" href="/">В архив</Link></main>;

  const label = day.style.params.palette[0] ?? "#c9a24b";
  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,520px)_1fr]">
      <BlurFade>
        <div className="relative">
          <Scene day={day} />
          {/* Диск у правого нижнего угла фото: крутится, пока играет песня; клик — выкл/вкл */}
          <button
            data-disc
            onClick={toggleMusic}
            disabled={noPreview}
            aria-label={playing ? "Выключить музыку" : "Включить музыку"}
            title={noPreview ? "превью песни недоступно" : playing ? "выключить музыку" : "включить музыку"}
            className="absolute rounded-full shadow-xl transition-transform hover:scale-105 disabled:opacity-40"
            style={{ left: "80.9%", top: "69.1%", width: "10.5%", aspectRatio: "1" }}
          >
            <span
              className="absolute inset-0 animate-spin rounded-full"
              style={{
                animationDuration: `${(6 - 4 * day.style.params.tempo).toFixed(1)}s`,
                animationPlayState: playing ? "running" : "paused",
                background:
                  "conic-gradient(transparent 0 20%, rgba(255,255,255,.2) 25%, transparent 30% 70%, rgba(255,255,255,.2) 75%, transparent 80%), repeating-radial-gradient(circle, #111 0 2px, #222 2px 4px)",
              }}
            >
              <span className="absolute inset-[33%] rounded-full" style={{ background: label }}>
                <span className="absolute inset-[38%] rounded-full bg-[#111]" />
              </span>
            </span>
          </button>
        </div>
      </BlurFade>
      <aside className="space-y-8">
        <Link href="/" className="font-mono text-sm text-muted">← архив</Link>
        <div>
          <p className="font-mono text-xs text-muted">{day.date}</p>
          <h1 className="mt-1 text-4xl">{day.title}</h1>
          <p className="mt-4 leading-relaxed text-muted">{day.text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={speak} className="rounded-full border border-[var(--foreground)] px-5 py-2.5 font-mono text-sm">озвучить</button>
          <a href={day.song.link} target="_blank" className="rounded-full border border-[var(--border)] px-5 py-2.5 font-mono text-sm text-muted">открыть песню ↗</a>
        </div>
      </aside>
    </main>
  );
}
