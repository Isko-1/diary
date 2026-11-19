"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { fuse } from "@/lib/fuse";
import { analyzeAll, fileToDataUrl } from "@/lib/photo";
import { saveDay } from "@/lib/store";
import { pickStyle } from "@/lib/style";
import type { DayPassport, Song } from "@/lib/types";

const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

export default function NewDay() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (text.trim().length < 5 || !files.length || !link.trim()) return setErr("Нужны текст, хотя бы одно фото и песня.");
    try {
      setBusy("Читаю фото…");
      const photos = await Promise.all(files.map((f) => fileToDataUrl(f)));
      const photoStats = await analyzeAll(photos);
      setBusy("Слушаю текст и песню…");
      const [a, song] = (await Promise.all([post("/api/analyze-day", { text }), post("/api/song", { link })])) as [any, Song];
      const base = { id: crypto.randomUUID(), date, title: a.title, text, photos, song, textMood: a.textMood, photoStats, context: a.context };
      const { mood, why } = fuse(base);
      const { style, why: why2 } = pickStyle(mood, song, a.context, photoStats);
      const day: DayPassport = { ...base, mood, style, why: [...why, ...why2] };
      setBusy("Собираю воспоминание…");
      await saveDay(day);
      router.push(`/day/${day.id}`);
    } catch (x) {
      setErr(String(x));
      setBusy("");
    }
  }

  const field = "w-full rounded-lg border border-[var(--border)] bg-white/60 px-4 py-3 outline-none focus:border-[var(--foreground)]";
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="font-mono text-sm text-muted">← архив</Link>
      <BlurFade><h1 className="mt-4 text-4xl">Как прошёл день?</h1></BlurFade>
      <form onSubmit={submit} className="mt-8 space-y-6">
        <BlurFade delay={0.1}>
          <textarea className={field + " min-h-40"} placeholder="Расскажите так, как рассказали бы близкому другу: погода, свет, люди, мелочи…" value={text} onChange={(e) => setText(e.target.value)} />
        </BlurFade>
        <BlurFade delay={0.15}>
          <label className="block font-mono text-xs text-muted">ФОТО (1 и больше)
            <input className={field + " mt-2"} type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          </label>
        </BlurFade>
        <BlurFade delay={0.2}>
          <label className="block font-mono text-xs text-muted">ПЕСНЯ (ссылка YouTube / Spotify или «артист - название»)
            <input className={field + " mt-2"} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://open.spotify.com/track/…" />
          </label>
        </BlurFade>
        <BlurFade delay={0.25}>
          <label className="block font-mono text-xs text-muted">ДАТА
            <input className={field + " mt-2"} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </BlurFade>
        {err && <p className="text-sm text-red-700">{err}</p>}
        <button disabled={!!busy} className="rounded-full bg-[var(--foreground)] px-7 py-3 font-mono text-sm text-[var(--background)] disabled:opacity-50">
          {busy || "создать воспоминание"}
        </button>
      </form>
    </main>
  );
}
