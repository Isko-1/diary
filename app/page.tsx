"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { GridPattern } from "@/components/ui/grid-pattern";
import { MagicCard } from "@/components/ui/magic-card";
import { listDays } from "@/lib/store";
import { dominant, techniqueName } from "@/lib/style";
import type { DayPassport } from "@/lib/types";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function DayCard({ d }: { d: DayPassport }) {
  const [c0, c1] = [d.style.params.palette[0] ?? "#bbb", d.style.params.palette[1] ?? "#888"];
  return (
    <Link href={`/day/${d.id}`} title={`${d.title} · ${d.song.title}`} className="block rounded-xl">
      <MagicCard className="rounded-xl" gradientFrom={c0} gradientTo={c1} gradientColor={c0 + "33"} gradientSize={260}>
        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: `linear-gradient(135deg, ${c0}, ${c1})` }}>
          <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
          <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2.5 py-1 font-mono text-[11px] tracking-wider text-white backdrop-blur">
            {techniqueName(dominant(d.style.weights)).toUpperCase()}
          </span>
        </div>
        <div className="space-y-1 p-4">
          <p className="font-mono text-xs text-muted">{d.date}</p>
          <h3 className="text-lg leading-snug">{d.title}</h3>
          <p className="font-[family-name:var(--font-hand)] text-xl text-muted">
            ♪ {d.song.title} — {d.song.artist}
          </p>
        </div>
      </MagicCard>
    </Link>
  );
}

export default function Archive() {
  const [days, setDays] = useState<DayPassport[] | null>(null);
  useEffect(() => { listDays().then(setDays); }, []);

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-16">
      <GridPattern width={48} height={48} className="fill-black/5 stroke-black/5 [mask-image:radial-gradient(700px_circle_at_50%_0%,white,transparent)]" />
      <header className="relative mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <BlurFade delay={0.05}>
            <p className="font-mono text-xs tracking-[0.3em] text-muted">GENESIS // ART_CASE</p>
          </BlurFade>
          <BlurFade delay={0.15}>
            <h1 className="mt-2 text-5xl md:text-6xl">Дневник дней</h1>
          </BlurFade>
          <BlurFade delay={0.25}>
            <p className="mt-3 max-w-md text-muted">Невидимое — ощущение дня. Здесь оно становится видимым.</p>
          </BlurFade>
        </div>
        <BlurFade delay={0.35}>
          <Link href="/new" className="rounded-full bg-[var(--foreground)] px-6 py-3 font-mono text-sm text-[var(--background)] transition hover:opacity-80">
            + новый день
          </Link>
        </BlurFade>
      </header>

      {days === null ? null : days.length === 0 ? (
        <BlurFade>
          <p className="relative rounded-xl border border-dashed border-[var(--border)] p-12 text-center text-muted">
            Пока пусто. <Link className="underline" href="/new">Запишите первый день</Link>.
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
