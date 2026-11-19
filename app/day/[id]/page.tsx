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
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => { getDay(id).then((d) => setDay(d ?? null)); }, [id]);

  useEffect(() => {
    if (!day?.song.deezerId) return setNoPreview(true);
    fetch(`/api/song?deezerId=${day.song.deezerId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.preview && audio.current) { audio.current.src = j.preview; audio.current.loop = true; } else setNoPreview(true);
      })
      .catch(() => setNoPreview(true));
    return () => audio.current?.pause();
  }, [day]);

  function toggleMusic() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  }

  function speak() {
    if (!day) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(day.text);
    u.lang = "ru-RU";
    u.rate = 0.75 + 0.5 * day.mood.arousal;   // голос «по правилам»: темп ← напряжённость
    u.pitch = 0.8 + 0.4 * day.mood.valence;   // высота ← приятность
    speechSynthesis.speak(u);
  }

  if (day === undefined) return null;
  if (day === null) return <main className="p-10">День не найден. <Link className="underline" href="/">В архив</Link></main>;

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,520px)_1fr]">
      <BlurFade><Scene day={day} /></BlurFade>
      <aside className="space-y-8">
        <Link href="/" className="font-mono text-sm text-muted">← архив</Link>
        <div>
          <p className="font-mono text-xs text-muted">{day.date}</p>
          <h1 className="mt-1 text-4xl">{day.title}</h1>
          <p className="mt-4 leading-relaxed text-muted">{day.text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={toggleMusic} disabled={noPreview} className="rounded-full bg-[var(--foreground)] px-5 py-2.5 font-mono text-sm text-[var(--background)] disabled:opacity-40">
            {noPreview ? "превью недоступно" : playing ? "❚❚ пауза" : "▶ песня"}
          </button>
          <button onClick={speak} className="rounded-full border border-[var(--foreground)] px-5 py-2.5 font-mono text-sm">озвучить</button>
          <a href={day.song.link} target="_blank" className="rounded-full border border-[var(--border)] px-5 py-2.5 font-mono text-sm text-muted">открыть песню ↗</a>
        </div>
        <div>
          <h2 className="mb-3 font-mono text-xs tracking-[0.2em] text-muted">ПОЧЕМУ ДЕНЬ ВЫГЛЯДИТ ТАК</h2>
          <ul className="space-y-2">
            {day.why.map((w, i) => (
              <BlurFade key={i} delay={0.1 + i * 0.07}>
                <li className="border-l-2 border-[var(--border)] pl-3 text-sm">{w}</li>
              </BlurFade>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            {day.style.params.palette.map((c) => (
              <span key={c} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c }} title={c} />
            ))}
          </div>
        </div>
      </aside>
      <audio ref={audio} />
    </main>
  );
}
