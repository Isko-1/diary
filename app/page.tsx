"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { GridPattern } from "@/components/ui/grid-pattern";
import { MagicCard } from "@/components/ui/magic-card";
import { GLYPH } from "@/lib/env";
import { listDays } from "@/lib/store";
import { dominant, techniqueName } from "@/lib/style";
import type { DayPassport } from "@/lib/types";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function DayCard({ d }: { d: DayPassport }) {
  const [c0, c1] = [d.style.params.palette[0] ?? "#bbb", d.style.params.palette[1] ?? "#888"];

  return (
    <Link href={`/day/${d.id}`} title={`${d.title} · ${d.song.title}`} className="group block rounded-xl">
      <MagicCard className="rounded-xl overflow-hidden" gradientFrom={c0} gradientTo={c1} gradientColor={c0 + "33"} gradientSize={260}>
        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: `linear-gradient(135deg, ${c0}, ${c1})` }}>
          <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />

          {/* Винил, выглядывающий из конверта при наведении */}
          <div
            className="absolute -right-10 top-1/2 -translate-y-1/2 w-32 aspect-square rounded-full transition-transform duration-500 ease-out group-hover:-translate-x-6 shadow-2xl"
            style={{
              background:
                "conic-gradient(from 40deg, transparent 0deg, rgba(255,255,255,.18) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,.18) 225deg, transparent 270deg), repeating-radial-gradient(circle, #0e0e10 0, #18181b 1.5px, #111113 3px)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <div
              className="absolute inset-[32%] rounded-full shadow-inner flex items-center justify-center overflow-hidden"
              style={{ background: c0 }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-stone-400" />
            </div>
          </div>

          {/* Плашка техники */}
          <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 font-mono text-[11px] tracking-wider text-white backdrop-blur">
            {techniqueName(dominant(d.style.weights)).toUpperCase()}
          </span>

          {/* Бейдж погоды, если есть */}
          {d.weather && (
            <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur flex items-center gap-1.5">
              <span>{GLYPH[d.weather.kind]}</span>
              <span>{d.weather.temp > 0 ? "+" : ""}{d.weather.temp}°</span>
            </span>
          )}
        </div>

        <div className="space-y-1.5 p-4 bg-white/70 backdrop-blur">
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>{d.date}</span>
            {d.geo?.place && <span className="truncate max-w-[140px]">📍 {d.geo.place}</span>}
          </div>
          <h3 className="text-lg font-serif font-bold leading-snug line-clamp-1 group-hover:text-rose-900 transition-colors">
            {d.title}
          </h3>
          <p className="font-[family-name:var(--font-hand)] text-xl text-muted truncate">
            ♪ {d.song.title} — {d.song.artist}
          </p>
        </div>
      </MagicCard>
    </Link>
  );
}

export default function Archive() {
  const [days, setDays] = useState<DayPassport[] | null>(null);
  useEffect(() => {
    listDays().then(setDays);
  }, []);

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-16">
      <GridPattern
        width={48}
        height={48}
        className="fill-black/5 stroke-black/5 [mask-image:radial-gradient(700px_circle_at_50%_0%,white,transparent)]"
      />
      <header className="relative mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <BlurFade delay={0.05}>
            <p className="font-mono text-xs tracking-[0.3em] text-muted">GENESIS // ART_CASE</p>
          </BlurFade>
          <BlurFade delay={0.15}>
            <h1 className="mt-2 text-5xl md:text-6xl font-serif">Дневник дней</h1>
          </BlurFade>
          <BlurFade delay={0.25}>
            <p className="mt-3 max-w-md text-muted">
              Невидимое — ощущение дня. Здесь оно оживает в музыке, виниле, погоде и генеративном искусстве.
            </p>
          </BlurFade>
        </div>
        <BlurFade delay={0.35}>
          <Link
            href="/new"
            className="rounded-full bg-[var(--foreground)] px-6 py-3 font-mono text-sm text-[var(--background)] transition hover:opacity-80 shadow-md"
          >
            + новый день
          </Link>
        </BlurFade>
      </header>

      {days === null ? null : days.length === 0 ? (
        <BlurFade>
          <p className="relative rounded-xl border border-dashed border-[var(--border)] p-12 text-center text-muted">
            Пока пусто. <Link className="underline font-medium" href="/new">Запишите первый день</Link>.
          </p>
        </BlurFade>
      ) : (
        <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((d, i) => (
            <BlurFade key={d.id} delay={0.1 + i * 0.06}>
              <DayCard d={d} />
            </BlurFade>
          ))}
        </div>
      )}
    </main>
  );
}
