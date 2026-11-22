import { NextResponse } from "next/server";
import { askJson } from "@/lib/llm";
import type { Song, SongFeatures } from "@/lib/types";
import { tidyTitle } from "@/lib/utils";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Запасная оценка признаков по жанру (Deezer-альбом или iTunes) и, если есть, BPM.
 * e — типичная энергия жанра, v — типичная приятность. Это оценка, не измерение; в панели она помечается как «оценка по жанру».
 * Порядок правил важен: берётся первое совпадение, поэтому узкие жанры стоят раньше широких.
 */
const GENRES: [RegExp, { e: number; v: number }][] = [
  [/metal|метал|punk|панк|hardcore|хард/i, { e: 0.9, v: 0.35 }],
  [/ambient|эмбиент|new age|lo-?fi|chill|downtempo|классик|classical|instrumental|инструмент|soundtrack|саундтрек|score|опер|opera/i, { e: 0.22, v: 0.45 }],
  [/jazz|джаз|blues|блюз|bossa|swing/i, { e: 0.4, v: 0.55 }],
  [/folk|фолк|acoustic|акуст|singer|songwriter|авторск|country|кантри|шансон|chanson/i, { e: 0.35, v: 0.5 }],
  [/disco|диско|funk|фанк|reggae|регги|latin|латин|salsa|reggaeton/i, { e: 0.74, v: 0.8 }],
  [/electro|электро|house|хаус|techno|техно|trance|транс|edm|dance|дэнс|drum|dubstep|club/i, { e: 0.82, v: 0.62 }],
  [/rap|рэп|реп|hip.?hop|хип.?хоп|trap|трэп/i, { e: 0.72, v: 0.5 }],
  [/r&b|rnb|soul|соул/i, { e: 0.5, v: 0.55 }],
  [/rock|рок|alternative|альтернатив|indie|инди|grunge/i, { e: 0.68, v: 0.45 }],
  [/pop|поп|эстрад|variet/i, { e: 0.62, v: 0.66 }],
];

function genreFeatures(genre?: string, bpm?: number): SongFeatures | null {
  if (!genre) return null;
  const g = GENRES.find(([re]) => re.test(genre))?.[1];
  if (!g) return bpm ? { tempo: bpm } : null;
  // BPM, если есть, уточняет жанр: быстрый трек того же жанра энергичнее
  const energy = bpm ? clamp01(0.65 * g.e + 0.35 * clamp01((bpm - 60) / 120)) : g.e;
  return { energy, valence: g.v, tempo: bpm };
}

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
    const y = parseInt(String(hit.releaseDate ?? "").slice(0, 4));
    return {
      preview: hit.previewUrl ?? null,
      coverUrl,
      title: hit.trackName ?? undefined,
      artist: hit.artistName ?? undefined,
      genre: (hit.primaryGenreName as string | undefined) ?? undefined,
      year: y || undefined,
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
  let genre: string | undefined;
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
    // Жанр у Deezer лежит на альбоме, а не на треке
    if (t?.album?.id) {
      const alb = await j(`https://api.deezer.com/album/${t.album.id}`);
      const names = (alb?.genres?.data ?? []).map((g: any) => g?.name).filter(Boolean);
      if (names.length) genre = names.join(", ");
      if (!year) {
        const ay = parseInt(String(alb?.release_date ?? "").slice(0, 4));
        if (ay) year = ay;
      }
    }
  }

  // 2b. Deezer не дал обложку, жанр или год (или заблокирован) — добираем из iTunes:
  if ((!coverUrl || !genre || !year) && title) {
    const itunes = await fetchITunes(`${artist} ${title}`.trim());
    if (itunes) {
      if (!coverUrl && itunes.coverUrl) coverUrl = itunes.coverUrl;
      if (!artist && itunes.artist) artist = itunes.artist;
      if (!genre && itunes.genre) genre = itunes.genre;
      if (!year && itunes.year) year = itunes.year;
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

  // 4. LLM оценивает по «исполнитель, название, год, жанр, BPM». Точнее жанра, но часто падает (лимиты, нет ключа).
  if (!features && title) {
    const meta = [`${artist} — ${title}`, year ? `год ${year}` : "", genre ? `жанр ${genre}` : "", bpm ? `${bpm} BPM` : ""].filter(Boolean).join(", ");
    const g = await askJson(
      'Оцени аудио-признаки песни по названию, исполнителю и жанру. Верни СТРОГО JSON: {"energy":0..1,"valence":0..1,"tempo":bpm,"mode":0|1} (mode 0 = минор).',
      meta,
    );
    if (g && num(g.energy) != null) {
      features = { energy: clamp01(g.energy), valence: num(g.valence) != null ? clamp01(g.valence) : undefined, tempo: bpm ?? num(g.tempo), mode: g.mode === 0 ? 0 : g.mode === 1 ? 1 : undefined };
      featuresSource = "llm";
    }
  }
  // 5. Оценка по жанру (+BPM). Работает без ключей и без BPM, поэтому музыка влияет на оформление даже при пустом ответе Deezer.
  if (!features) {
    const gf = genreFeatures(genre, bpm);
    if (gf?.energy != null) {
      features = gf;
      featuresSource = "genre";
    }
  }
  if (!features && bpm) {
    features = { tempo: bpm };
    featuresSource = "tempo";
  }

  const song: Song = { title: tidyTitle(title) || "Без названия", artist: artist || "—", year, genre, link, deezerId, coverUrl, features, featuresSource };
  return NextResponse.json(song);
}
