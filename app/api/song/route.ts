import { NextResponse } from "next/server";
import { askJson } from "@/lib/llm";
import type { Song, SongFeatures } from "@/lib/types";

const num = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : undefined);
const j = async (url: string) => {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

/** Превью запрашиваем свежим при открытии дня: ссылки Deezer протухают. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("deezerId");
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "deezerId" }, { status: 400 });
  const t = await j(`https://api.deezer.com/track/${id}`);
  const coverUrl = t?.album?.cover_medium ?? t?.album?.cover_big ?? t?.artist?.picture_medium ?? null;
  return NextResponse.json({ preview: t?.preview ?? null, coverUrl });
}

export async function POST(req: Request) {
  const { link } = await req.json();
  if (typeof link !== "string") return NextResponse.json({ error: "link required" }, { status: 400 });

  // 1. oEmbed -> название и исполнитель
  let title = "", artist = "", spotifyId: string | undefined;
  if (/spotify\.com/.test(link)) {
    spotifyId = link.match(/track\/([A-Za-z0-9]+)/)?.[1];
    const o = await j(`https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`);
    title = o?.title ?? "";
  } else if (/youtu\.?be/.test(link)) {
    const o = await j(`https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`);
    const raw: string = o?.title ?? "";
    const parts = raw.split(" - ");
    if (parts.length >= 2) { artist = parts[0]; title = parts.slice(1).join(" - "); }
    else { title = raw; artist = (o?.author_name ?? "").replace(/ - Topic$/, ""); }
  } else {
    title = link; // пользователь мог ввести «артист - песня» текстом
    const p = link.split(" - ");
    if (p.length >= 2) { artist = p[0]; title = p[1]; }
  }
  title = title.replace(/\(.*?(official|video|lyrics|audio).*?\)|\[.*?\]/gi, "").trim();

  // 2. Deezer: метаданные, год, BPM, deezerId
  const q = encodeURIComponent(`${artist} ${title}`.trim());
  const s = await j(`https://api.deezer.com/search?q=${q}&limit=1`);
  const hit = s?.data?.[0];
  let deezerId: number | undefined, year: number | undefined, bpm: number | undefined, coverUrl: string | undefined;
  if (hit) {
    deezerId = hit.id;
    title = hit.title ?? title;
    artist = hit.artist?.name ?? artist;
    coverUrl = hit.album?.cover_medium ?? hit.artist?.picture_medium;
    const t = await j(`https://api.deezer.com/track/${hit.id}`);
    const y = parseInt(String(t?.release_date ?? "").slice(0, 4));
    if (y) year = y;
    if (t?.bpm && t.bpm > 0) bpm = t.bpm; // 0 — не ошибка, просто нет данных
    if (!coverUrl && t?.album?.cover_medium) coverUrl = t.album.cover_medium;
  }

  // 3. ReccoBeats (по Spotify ID — проверить по их документации)
  let features: SongFeatures | null = null;
  let featuresSource: Song["featuresSource"] = null;
  if (spotifyId) {
    const r = await j(`https://api.reccobeats.com/v1/audio-features?ids=${spotifyId}`);
    const f = r?.content?.[0];
    if (f && num(f.energy) != null) {
      features = { energy: f.energy, valence: num(f.valence), tempo: num(f.tempo) ?? bpm, mode: f.mode === 0 ? 0 : f.mode === 1 ? 1 : undefined };
      featuresSource = "reccobeats";
    }
  }

  // 4. Запас: LLM оценивает по названию/исполнителю
  if (!features && title) {
    const g = await askJson(
      'Оцени аудио-признаки песни по названию и исполнителю. Верни СТРОГО JSON: {"energy":0..1,"valence":0..1,"tempo":bpm,"mode":0|1} (mode 0 = минор).',
      `${artist} — ${title}${year ? ` (${year})` : ""}`,
    );
    if (g && num(g.energy) != null) {
      features = { energy: g.energy, valence: num(g.valence), tempo: bpm ?? num(g.tempo), mode: g.mode === 0 ? 0 : g.mode === 1 ? 1 : undefined };
      featuresSource = "llm";
    }
  }
  if (!features && bpm) features = { tempo: bpm };

  const song: Song = { title: title || "Без названия", artist: artist || "—", year, link, deezerId, coverUrl, features, featuresSource };
  return NextResponse.json(song);
}
