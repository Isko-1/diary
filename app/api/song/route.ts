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

/** Поиск в iTunes Search API — работает без API-ключа, глобально (в т.ч. в РФ без блокировок) */
async function fetchITunes(query: string) {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.results?.[0];
    if (!hit) return null;
    const rawCover = hit.artworkUrl100 || hit.artworkUrl60;
    const coverUrl = rawCover ? rawCover.replace(/100x100bb/, "600x600bb") : null;
    return {
      preview: hit.previewUrl ?? null,
      coverUrl,
      title: hit.trackName ?? undefined,
      artist: hit.artistName ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Превью и обложка: Deezer + надежный iTunes Search fallback */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("deezerId");
  const qTitle = url.searchParams.get("title");
  const qArtist = url.searchParams.get("artist");

  let preview: string | null = null;
  let coverUrl: string | null = null;
  let deezerId: number | null = null;

  // 1. Попытка через Deezer ID (если передан)
  if (id && /^\d+$/.test(id)) {
    const t = await j(`https://api.deezer.com/track/${id}`);
    if (t) {
      preview = t.preview ?? null;
      coverUrl = t.album?.cover_medium ?? t.album?.cover_big ?? t.artist?.picture_medium ?? null;
      deezerId = Number(id);
    }
  }

  // 2. Поиск по запросу в Deezer (если обложка или превью еще не получены)
  if ((!preview || !coverUrl) && qTitle) {
    const q = `${qArtist ?? ""} ${qTitle}`.trim();
    const s = await j(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`);
    const hit = s?.data?.[0];
    if (hit) {
      if (!preview) preview = hit.preview ?? null;
      if (!coverUrl) coverUrl = hit.album?.cover_medium ?? hit.album?.cover_big ?? hit.artist?.picture_medium ?? null;
      if (!deezerId) deezerId = hit.id;
    }
  }

  // 3. iTunes Search API fallback (надежно работает даже при блокировках Deezer)
  if ((!preview || !coverUrl) && qTitle) {
    const itunes = await fetchITunes(`${qArtist ?? ""} ${qTitle}`.trim());
    if (itunes) {
      if (!preview && itunes.preview) preview = itunes.preview;
      if (!coverUrl && itunes.coverUrl) coverUrl = itunes.coverUrl;
    }
  }

  return NextResponse.json({ preview, coverUrl, deezerId });
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

  // 2b. Если Deezer не вернул обложку (или заблокирован), ищем в iTunes:
  if (!coverUrl && title) {
    const itunes = await fetchITunes(`${artist} ${title}`.trim());
    if (itunes?.coverUrl) {
      coverUrl = itunes.coverUrl;
      if (!artist && itunes.artist) artist = itunes.artist;
    }
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
