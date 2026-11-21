"use client";
import { useRef, type Dispatch, type SetStateAction } from "react";
import { GLYPH, tile } from "@/lib/env";
import { theme } from "@/lib/style";
import type { DayPassport, SceneItem, Song } from "@/lib/types";

/** Базовая ширина элемента в cqw (% ширины контейнера). */
export const WIDTH: Record<SceneItem["kind"], number> = {
  disc: 38,
  weather: 26,
  map: 30,
  place: 28,
  note: 34,
  sticker: 16,
  tape: 28,
  stamp: 24,
  wave: 32,
  cassette: 36,
  playlist: 34,
};

const TOD = { morning: "утро", day: "день", evening: "вечер", night: "ночь" } as const;
export const stampText = (day: DayPassport) => TOD[day.context.timeOfDay];

export function defaultItems(day: DayPassport): SceneItem[] {
  const it: SceneItem[] = [
    {
      id: "disc",
      kind: "disc",
      x: 84,
      y: 78,
      s: 0.88,
      r: 0,
      size: 30,
      variant: "black",
      text: "song",
      zIndex: 10,
    },
  ];
  if (day.weather) {
    it.push({
      id: "weather",
      kind: "weather",
      x: 22,
      y: 84,
      s: 0.82,
      r: -2,
      variant: "card",
      zIndex: 20,
    });
  }
  if (day.geo) {
    it.push({
      id: "map",
      kind: "map",
      x: 84,
      y: 13,
      s: 0.75,
      r: 2,
      variant: "card",
      zIndex: 30,
    });
  }
  return it;
}

const mono = '"JetBrains Mono", monospace';
const serif = "Fraunces, serif";
const hand = "Caveat, cursive";
const cl = (x: number) => Math.min(300, Math.max(-200, x));

// Цвета для стикеров-заметок
export const NOTE_COLORS: Record<string, { bg: string; fg: string; tape: string }> = {
  yellow: { bg: "#fef9c3", fg: "#422006", tape: "rgba(254, 240, 138, 0.75)" },
  pink: { bg: "#fce7f3", fg: "#831843", tape: "rgba(251, 207, 232, 0.75)" },
  mint: { bg: "#dcfce7", fg: "#14532d", tape: "rgba(187, 247, 208, 0.75)" },
  lavender: { bg: "#ede9fe", fg: "#4c1d95", tape: "rgba(221, 214, 254, 0.75)" },
  craft: { bg: "#eaddcf", fg: "#292524", tape: "rgba(214, 196, 178, 0.75)" },
  dark: { bg: "#1c1917", fg: "#fafaf9", tape: "rgba(68, 64, 60, 0.75)" },
};

// Стили винила
export const VINYL_STYLES: Record<string, { bg: string; rim: string; groove: string }> = {
  black: {
    bg: "#0a0a0c",
    rim: "rgba(255,255,255,0.14)",
    groove:
      "conic-gradient(from 40deg, transparent 0deg, rgba(255,255,255,.14) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,.14) 225deg, transparent 270deg), repeating-radial-gradient(circle, #0c0c0e 0, #17171a 1.5px, #0f0f11 3px)",
  },
  gold: {
    bg: "#453205",
    rim: "rgba(253,230,138,0.35)",
    groove:
      "conic-gradient(from 40deg, transparent 0deg, rgba(253,230,138,.35) 45deg, transparent 90deg, transparent 180deg, rgba(253,230,138,.35) 225deg, transparent 270deg), repeating-radial-gradient(circle, #3d2b05 0, #855d0f 1.5px, #4d3608 3px)",
  },
  ruby: {
    bg: "#3f0a14",
    rim: "rgba(254,205,211,0.25)",
    groove:
      "conic-gradient(from 40deg, transparent 0deg, rgba(254,205,211,.3) 45deg, transparent 90deg, transparent 180deg, rgba(254,205,211,.3) 225deg, transparent 270deg), repeating-radial-gradient(circle, #30060e 0, #781326 1.5px, #420b15 3px)",
  },
  sapphire: {
    bg: "#081b3b",
    rim: "rgba(191,219,254,0.25)",
    groove:
      "conic-gradient(from 40deg, transparent 0deg, rgba(191,219,254,.3) 45deg, transparent 90deg, transparent 180deg, rgba(191,219,254,.3) 225deg, transparent 270deg), repeating-radial-gradient(circle, #05142e 0, #1d4ed8 1.5px, #0e2b60 3px)",
  },
  amber: {
    bg: "#331804",
    rim: "rgba(254,215,170,0.25)",
    groove:
      "conic-gradient(from 40deg, transparent 0deg, rgba(254,215,170,.3) 45deg, transparent 90deg, transparent 180deg, rgba(254,215,170,.3) 225deg, transparent 270deg), repeating-radial-gradient(circle, #271203 0, #b45309 1.5px, #451a03 3px)",
  },
};

function Body({
  it,
  day,
  playing,
  noPreview,
  activeSong,
  currentSongIndex,
}: {
  it: SceneItem;
  day: DayPassport;
  playing: boolean;
  noPreview: boolean;
  activeSong?: Song;
  currentSongIndex?: number;
}) {
  const th = theme(day);
  const pal = day.style.params.palette;
  const currentSong = activeSong || day.song;
  const card = {
    background: th.bg,
    color: th.fg,
    border: `0.2cqw solid ${th.fg}`,
    boxShadow: "0 1.2cqw 3.5cqw rgba(0,0,0,.32)",
  } as const;

  switch (it.kind) {
    case "disc": {
      const vKey = it.variant && VINYL_STYLES[it.variant] ? it.variant : "black";
      const vStyle = VINYL_STYLES[vKey];
      const tempoVal = currentSong.features?.tempo ? Math.min(1, Math.max(0, (currentSong.features.tempo - 60) / 120)) : day.style.params.tempo;
      const spinSpeed = (5.5 - 3.8 * tempoVal).toFixed(1);

      // Индекс активного трека в плейлисте (0, 1, 2...)
      const songIndex = currentSongIndex ?? (
        day.playlist && activeSong
          ? Math.max(0, day.playlist.findIndex((s) => s.title === activeSong.title && s.artist === activeSong.artist))
          : 0
      );

      // Вариант центрального лейбла: song | photo | vintage | palette | minimal
      const labelType = it.text || "song";
      const songCoverUrl = currentSong.coverUrl;

      // Если в галерее несколько фото, ротируем их по трекам
      const photoForTrack = day.photos && day.photos.length > 0
        ? day.photos[songIndex % day.photos.length]
        : null;

      // Приоритет обложки:
      // 1) Если у трека есть coverUrl — показываем обложку трека
      // 2) Если выбран режим photo — показываем фото дня для этого трека
      // 3) Если режим song и в галерее есть фото, но нет обложки трека — ротируем фото
      let effectiveCover: string | null = null;
      if (labelType === "song") {
        // В режиме трека приоритет у обложки трека; если ее нет и в галерее >1 фото, берем фото трека
        effectiveCover = songCoverUrl || (day.photos && day.photos.length > 1 ? photoForTrack : null);
      } else if (labelType === "photo") {
        // В режиме фото: если фото в галерее несколько, ротируем их; если фото всего одно, но есть обложка трека — берем обложку трека, чтобы картинка менялась при смене трека
        effectiveCover = (day.photos && day.photos.length > 1)
          ? photoForTrack
          : (songCoverUrl || photoForTrack);
      }

      return (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1",
            borderRadius: "50%",
            boxShadow: "0 2cqw 6cqw rgba(0,0,0,.6), inset 0 0 1cqw rgba(0,0,0,.8)",
            opacity: noPreview ? 0.55 : 1,
            background: vStyle.bg,
            border: `0.25cqw solid ${vStyle.rim}`,
            transition: "transform 0.25s ease, box-shadow 0.25s ease",
          }}
          className="group"
        >
          {/* Вращающаяся виниловая пластинка */}
          <div
            className="animate-spin"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              animationDuration: `${spinSpeed}s`,
              animationPlayState: playing ? "running" : "paused",
              background: vStyle.groove,
              boxShadow: "inset 0 0 2cqw rgba(0,0,0,.9)",
            }}
          >
            {/* Отражения света на виниле (спекулярные дорожки) */}
            <div
              style={{
                position: "absolute",
                inset: "8%",
                borderRadius: "50%",
                border: "0.15cqw solid rgba(255,255,255,0.06)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "18%",
                borderRadius: "50%",
                border: "0.15cqw solid rgba(255,255,255,0.05)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "27%",
                borderRadius: "50%",
                border: "0.18cqw solid rgba(255,255,255,0.08)",
              }}
            />

            {/* Центральный лейбл (Яблоко пластинки) */}
            <div
              style={{
                position: "absolute",
                inset: "31%",
                borderRadius: "50%",
                overflow: "hidden",
                border: `0.3cqw solid ${pal[0] ?? "#d97706"}`,
                boxShadow: "0 0 1cqw rgba(0,0,0,.6)",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
              }}
            >
              {effectiveCover ? (
                <div
                  key={effectiveCover}
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url("${effectiveCover}")`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                    filter: "contrast(1.05) saturate(1.1)",
                    transition: "opacity 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.65) 100%)",
                    }}
                  />
                  {/* Тонкая подпись трека на яблоке */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "12%",
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      fontFamily: mono,
                      fontSize: "1.1cqw",
                      color: "#fff",
                      textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                      padding: "0 1cqw",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      opacity: 0.9,
                    }}
                  >
                    {currentSong.title}
                  </div>
                </div>
              ) : labelType === "song" ? (
                <div
                  key={`procedural-disc-${songIndex}-${currentSong.title}`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(circle at center, ${pal[songIndex % pal.length] ?? "#b45309"} 0%, #17171a 100%)`,
                    color: "#fef3c7",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1cqw",
                    boxShadow: "inset 0 0 2cqw rgba(0,0,0,0.8)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: "1.2cqw",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    TRK 0{songIndex + 1} // 33 RPM
                  </span>
                  <span
                    style={{
                      fontFamily: serif,
                      fontSize: "2cqw",
                      fontWeight: 700,
                      lineHeight: 1.1,
                      margin: "0.3cqw 0",
                      maxWidth: "85%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    }}
                  >
                    {currentSong.title}
                  </span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: "1.1cqw",
                      color: "rgba(255,255,255,0.85)",
                      maxWidth: "80%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {currentSong.artist}
                  </span>
                </div>
              ) : labelType === "vintage" ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: pal[1] ?? "#b45309",
                    color: "#fef3c7",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1cqw",
                  }}
                >
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: "1.4cqw",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      opacity: 0.8,
                    }}
                  >
                    GENESIS // 33 RPM
                  </span>
                  <span
                    style={{
                      fontFamily: serif,
                      fontSize: "2cqw",
                      fontWeight: 700,
                      lineHeight: 1.1,
                      margin: "0.5cqw 0",
                      maxWidth: "85%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {currentSong.title}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: "1.2cqw", opacity: 0.7 }}>SIDE A</span>
                </div>
              ) : labelType === "palette" ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `conic-gradient(${pal.join(", ")}, ${pal[0]})`,
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "#18181b",
                    color: "#fef08a",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: mono,
                    fontSize: "1.5cqw",
                    letterSpacing: "0.1em",
                  }}
                >
                  STEREO
                </div>
              )}

              {/* Шпиндель по центру */}
              <div
                style={{
                  position: "absolute",
                  width: "18%",
                  aspectRatio: "1",
                  borderRadius: "50%",
                  background: "#09090b",
                  border: "0.35cqw solid #d4d4d8",
                  boxShadow: "inset 0 0.2cqw 0.5cqw rgba(0,0,0,0.9)",
                  zIndex: 2,
                }}
              />
            </div>
          </div>

          {/* Индикатор Play/Pause при наведении или на паузе */}
          {!noPreview && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
                zIndex: 4,
              }}
            >
              <div
                style={{
                  width: "28%",
                  aspectRatio: "1",
                  borderRadius: "50%",
                  background: playing ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(4px)",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  boxShadow: "0 0.5cqw 1.5cqw rgba(0,0,0,0.4)",
                  border: "0.2cqw solid rgba(255,255,255,0.25)",
                  opacity: playing ? 0 : 0.95,
                  transition: "opacity 0.2s ease, transform 0.2s ease",
                }}
                className={playing ? "group-hover:!opacity-90" : ""}
              >
                {playing ? (
                  <span style={{ fontSize: "3.5cqw", letterSpacing: "-0.05em", lineHeight: 1 }}>❚❚</span>
                ) : (
                  <span style={{ fontSize: "3.5cqw", marginLeft: "0.4cqw", lineHeight: 1 }}>▶</span>
                )}
              </div>
            </div>
          )}

          {/* Название трека во вращающейся подсказке */}
          <div
            style={{
              position: "absolute",
              bottom: "-4.5cqw",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(15,15,18,0.85)",
              color: "#fff",
              padding: "0.4cqw 1.6cqw",
              borderRadius: "999px",
              fontFamily: mono,
              fontSize: "1.9cqw",
              whiteSpace: "nowrap",
              letterSpacing: "0.04em",
              pointerEvents: "none",
              boxShadow: "0 0.5cqw 1.5cqw rgba(0,0,0,0.3)",
              border: "0.1cqw solid rgba(255,255,255,0.15)",
              opacity: 0,
              transition: "opacity 0.2s ease",
            }}
            className="group-hover:!opacity-100"
          >
            ♪ {currentSong.title} — {currentSong.artist}
          </div>
        </div>
      );
    }

    case "weather": {
      const w = day.weather;
      if (!w) return null;
      const v = it.variant || "card";

      if (v === "glass") {
        return (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.45)",
              backdropFilter: "blur(12px)",
              color: th.dark ? "#fff" : "#111",
              border: "0.2cqw solid rgba(255, 255, 255, 0.5)",
              boxShadow: "0 1cqw 3cqw rgba(0,0,0,0.18)",
              padding: "1.4cqw 2cqw",
              borderRadius: "2cqw",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "6.5cqw", lineHeight: 1 }}>{GLYPH[w.kind]}</div>
            <div style={{ fontFamily: serif, fontSize: "6cqw", fontWeight: 700, lineHeight: 1.1 }}>
              {w.temp > 0 ? "+" : ""}
              {w.temp}°
            </div>
            <div style={{ fontFamily: mono, fontSize: "2cqw", textTransform: "uppercase", opacity: 0.8 }}>
              {w.label} · {w.wind} км/ч
            </div>
          </div>
        );
      }

      if (v === "stamp") {
        return (
          <div
            style={{
              border: `0.4cqw dashed ${th.fg}`,
              borderRadius: "1.2cqw",
              padding: "1.2cqw 1.6cqw",
              fontFamily: mono,
              textAlign: "center",
              color: th.fg,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div style={{ fontSize: "5cqw", lineHeight: 1 }}>{GLYPH[w.kind]}</div>
            <div style={{ fontSize: "4.5cqw", fontWeight: 700 }}>
              {w.temp > 0 ? "+" : ""}
              {w.temp}°C
            </div>
            <div style={{ fontSize: "1.8cqw", letterSpacing: "0.1em", textTransform: "uppercase" }}>{w.label}</div>
          </div>
        );
      }

      // Classic Card
      return (
        <div style={{ ...card, fontFamily: mono, padding: "1.8cqw", borderRadius: "1.6cqw", textAlign: "center" }}>
          <div style={{ fontSize: "7cqw", lineHeight: 1 }}>{GLYPH[w.kind]}</div>
          <div style={{ fontFamily: serif, fontSize: "6.5cqw", fontWeight: 700, lineHeight: 1.1, marginTop: "0.4cqw" }}>
            {w.temp > 0 ? "+" : ""}
            {w.temp}°
          </div>
          <div
            style={{
              fontSize: "2cqw",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              opacity: 0.75,
              marginTop: "0.2cqw",
            }}
          >
            {w.label} · {w.wind} км/ч
          </div>
        </div>
      );
    }

    case "map": {
      const g = day.geo;
      if (!g) return null;
      const t = tile(g);
      const v = it.variant || "tile";
      const placeName = it.text || g.place || `${g.lat}, ${g.lon}`;

      if (v === "ticket") {
        return (
          <div
            style={{
              background: "#faf5ea",
              color: "#292524",
              border: "0.25cqw solid #d6d3d1",
              borderRadius: "1.2cqw",
              padding: "1.5cqw 2cqw",
              boxShadow: "0 1cqw 3cqw rgba(0,0,0,.25)",
              fontFamily: mono,
              position: "relative",
            }}
          >
            <div
              style={{
                fontSize: "1.6cqw",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#78716c",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>BOARDING // PASS</span>
              <span>GEO:{g.lat}°</span>
            </div>
            <div
              style={{
                fontFamily: serif,
                fontSize: "4.5cqw",
                fontWeight: 700,
                marginTop: "0.5cqw",
                lineHeight: 1.1,
              }}
            >
              📍 {placeName}
            </div>
            <div
              style={{
                fontSize: "1.8cqw",
                marginTop: "0.8cqw",
                borderTop: "0.15cqw dashed #a8a29e",
                paddingTop: "0.6cqw",
                opacity: 0.7,
              }}
            >
              COORD {g.lat}, {g.lon} · ARCHIVE
            </div>
          </div>
        );
      }

      // Classic Tile Map
      return (
        <div style={{ ...card, padding: "1.4cqw", borderRadius: "1.4cqw" }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "1.1",
              overflow: "hidden",
              borderRadius: "0.8cqw",
              background: th.bg,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.url}
              alt=""
              draggable={false}
              onError={(e) => (e.currentTarget.style.display = "none")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "grayscale(.5) sepia(.3) contrast(.95)",
              }}
            />
            <div style={{ position: "absolute", inset: 0, background: pal[0], mixBlendMode: "multiply", opacity: 0.3 }} />
            <span
              style={{
                position: "absolute",
                left: `${t.px}%`,
                top: `${t.py}%`,
                width: "3.6cqw",
                aspectRatio: "1",
                borderRadius: "50%",
                background: pal[1] ?? th.fg,
                border: `0.5cqw solid ${th.bg}`,
                transform: "translate(-50%,-50%)",
                boxShadow: "0 0 2cqw rgba(0,0,0,.6)",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: hand,
              fontSize: "4.8cqw",
              marginTop: "1cqw",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {placeName}
          </div>
        </div>
      );
    }

    case "place":
      return (
        <div
          style={{
            background: it.color || pal[1] || pal[0] || "#eab308",
            color: "#18181b",
            fontFamily: hand,
            fontSize: "5.5cqw",
            fontWeight: 600,
            padding: "0.8cqw 2.4cqw",
            borderRadius: "999px",
            boxShadow: "0 0.8cqw 2.5cqw rgba(0,0,0,.28)",
            textAlign: "center",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          📍 {it.text || day.geo?.place || "здесь"}
        </div>
      );

    case "note": {
      const cKey = it.variant && NOTE_COLORS[it.variant] ? it.variant : "yellow";
      const c = NOTE_COLORS[cKey];
      const font = it.font === "mono" ? mono : it.font === "serif" ? serif : hand;
      const fontSize = it.font === "mono" ? "3.2cqw" : it.font === "serif" ? "3.6cqw" : "5cqw";

      return (
        <div
          style={{
            position: "relative",
            background: c.bg,
            color: c.fg,
            fontFamily: font,
            fontSize,
            lineHeight: 1.25,
            padding: "2.4cqw 2.2cqw",
            boxShadow: "0 1.2cqw 3.5cqw rgba(0,0,0,.28), 0 0.2cqw 0.8cqw rgba(0,0,0,.15)",
            whiteSpace: "pre-wrap",
            borderRadius: "0.4cqw",
            minHeight: "10cqw",
          }}
        >
          {/* Скотч сверху записки */}
          <div
            style={{
              position: "absolute",
              top: "-1.8cqw",
              left: "50%",
              transform: "translateX(-50%)",
              width: "45%",
              height: "3.5cqw",
              background: c.tape,
              backdropFilter: "blur(2px)",
              clipPath: "polygon(0 0, 5% 50%, 0 100%, 100% 100%, 95% 50%, 100% 0)",
              boxShadow: "0 0.2cqw 0.5cqw rgba(0,0,0,0.1)",
            }}
          />
          {it.text || "Запомнить этот момент"}
        </div>
      );
    }

    case "sticker":
      return (
        <div
          style={{
            fontSize: it.text && it.text.length > 2 ? "4cqw" : "13cqw",
            lineHeight: 1,
            textAlign: "center",
            filter: "drop-shadow(0 0.8cqw 1.5cqw rgba(0,0,0,.35))",
            userSelect: "none",
          }}
        >
          {it.text && it.text.length > 2 ? (
            <div
              style={{
                background: it.color || pal[0] || "#f59e0b",
                color: "#18181b",
                fontFamily: mono,
                fontSize: "2.8cqw",
                fontWeight: 700,
                letterSpacing: "0.12em",
                padding: "0.8cqw 1.8cqw",
                borderRadius: "0.6cqw",
                border: "0.2cqw solid rgba(0,0,0,0.2)",
                boxShadow: "0 0.6cqw 1.8cqw rgba(0,0,0,0.25)",
                textTransform: "uppercase",
              }}
            >
              {it.text}
            </div>
          ) : (
            it.text ?? "✨"
          )}
        </div>
      );

    case "tape":
      return (
        <div
          style={{
            height: "5.5cqw",
            background: it.color || pal[1] || pal[0] || "rgba(245, 158, 11, 0.75)",
            opacity: 0.85,
            clipPath: "polygon(0 0, 3% 50%, 0 100%, 100% 100%, 97% 50%, 100% 0)",
            boxShadow: "0 0.4cqw 1cqw rgba(0,0,0,0.15)",
          }}
        />
      );

    case "stamp": {
      const v = it.variant || "round";
      if (v === "round") {
        return (
          <div
            style={{
              width: "100%",
              aspectRatio: "1",
              borderRadius: "50%",
              border: `0.45cqw double ${th.fg}`,
              color: th.fg,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: mono,
              padding: "1cqw",
              textAlign: "center",
              opacity: 0.85,
              mixBlendMode: th.dark ? "screen" : "multiply",
            }}
          >
            <div style={{ fontSize: "1.6cqw", letterSpacing: "0.2em" }}>★ GENESIS ★</div>
            <div
              style={{
                fontSize: "2.8cqw",
                fontWeight: 700,
                letterSpacing: "0.1em",
                margin: "0.3cqw 0",
                textTransform: "uppercase",
              }}
            >
              {it.text ?? stampText(day)}
            </div>
            <div style={{ fontSize: "1.6cqw", opacity: 0.75 }}>{day.date}</div>
          </div>
        );
      }

      return (
        <div
          style={{
            color: th.fg,
            border: `0.5cqw solid ${th.fg}`,
            borderRadius: "0.8cqw",
            fontFamily: mono,
            fontSize: "3.5cqw",
            fontWeight: 700,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            textAlign: "center",
            padding: "1.2cqw 1.8cqw",
            opacity: 0.85,
            mixBlendMode: th.dark ? "screen" : "multiply",
            boxShadow: "inset 0 0 0 0.15cqw currentColor",
          }}
        >
          {it.text ?? stampText(day)}
        </div>
      );
    }

    case "wave": {
      const barDelays = [0.1, 0.45, 0.2, 0.7, 0.3, 0.85, 0.15, 0.6, 0.35, 0.8, 0.25, 0.5, 0.18, 0.65];
      return (
        <div
          style={{
            background: "rgba(17, 24, 39, 0.88)",
            backdropFilter: "blur(12px)",
            color: "#fff",
            borderRadius: "1.4cqw",
            padding: "1.4cqw 2cqw",
            border: "0.15cqw solid rgba(255,255,255,0.2)",
            boxShadow: "0 1.2cqw 3.5cqw rgba(0,0,0,0.45)",
            fontFamily: mono,
            minWidth: "26cqw",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1cqw" }}>
            <span style={{ fontSize: "1.6cqw", letterSpacing: "0.15em", opacity: 0.75, textTransform: "uppercase" }}>
              {playing ? "PLAYING" : "PAUSED"}
            </span>
            <span style={{ fontSize: "1.4cqw", opacity: 0.6 }}>33 RPM</span>
          </div>

          <div
            style={{
              fontFamily: serif,
              fontSize: "3cqw",
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: "0.3cqw",
              lineHeight: 1.2,
            }}
          >
            {currentSong.title}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.4cqw",
              height: "4cqw",
              marginTop: "1cqw",
              padding: "0.2cqw 0",
            }}
          >
            {barDelays.map((delay, i) => (
              <span
                key={i}
                className={playing ? "eq-bar" : ""}
                style={{
                  flex: 1,
                  background: pal[i % pal.length] ?? "#38bdf8",
                  height: playing ? undefined : `${20 + (i % 4) * 10}%`,
                  borderRadius: "0.25cqw",
                  animationDelay: `-${delay}s`,
                  animationDuration: `${0.65 + (i % 3) * 0.25}s`,
                  transition: "height 0.3s ease",
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    case "cassette": {
      return (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1.58",
            borderRadius: "1.4cqw",
            background: it.variant === "cream" ? "#f5f0e6" : "#17171a",
            color: it.variant === "cream" ? "#222" : "#f4f4f5",
            boxShadow: "0 1.5cqw 4cqw rgba(0,0,0,0.5), inset 0 0.2cqw 0.4cqw rgba(255,255,255,0.15)",
            border: "0.25cqw solid rgba(255,255,255,0.14)",
            padding: "1.2cqw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* 4 винта по углам */}
          <span style={{ position: "absolute", top: "0.8cqw", left: "0.8cqw", width: "1.2cqw", height: "1.2cqw", borderRadius: "50%", background: "#444", border: "0.1cqw solid #777" }} />
          <span style={{ position: "absolute", top: "0.8cqw", right: "0.8cqw", width: "1.2cqw", height: "1.2cqw", borderRadius: "50%", background: "#444", border: "0.1cqw solid #777" }} />
          <span style={{ position: "absolute", bottom: "0.8cqw", left: "0.8cqw", width: "1.2cqw", height: "1.2cqw", borderRadius: "50%", background: "#444", border: "0.1cqw solid #777" }} />
          <span style={{ position: "absolute", bottom: "0.8cqw", right: "0.8cqw", width: "1.2cqw", height: "1.2cqw", borderRadius: "50%", background: "#444", border: "0.1cqw solid #777" }} />

          {/* Наклейка с названием кассеты */}
          <div
            style={{
              background: pal[1] ?? "#fef08a",
              color: "#1c1917",
              padding: "0.6cqw 1.2cqw",
              borderRadius: "0.4cqw",
              fontFamily: mono,
              boxShadow: "inset 0 0 0.5cqw rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.6cqw", opacity: 0.8, letterSpacing: "0.1em" }}>
              <span>MIXTAPE // DAY SOUNDTRACK</span>
              <span>SIDE A</span>
            </div>
            <div style={{ fontFamily: hand, fontSize: "4.2cqw", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {it.text || currentSong.title}
            </div>
          </div>

          {/* Окошко с двумя вращающимися катушками */}
          <div
            style={{
              position: "relative",
              margin: "0.6cqw auto",
              width: "75%",
              height: "8cqw",
              borderRadius: "0.8cqw",
              background: "rgba(0,0,0,0.85)",
              border: "0.2cqw solid rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", inset: "32% 16%", background: "#3b2112", borderRadius: "1cqw" }} />
            <div
              className={playing ? "animate-spin" : ""}
              style={{
                width: "5cqw",
                aspectRatio: "1",
                borderRadius: "50%",
                background: "#f1f5f9",
                border: "0.4cqw solid #94a3b8",
                display: "grid",
                placeItems: "center",
                animationDuration: "2.8s",
                zIndex: 2,
              }}
            >
              <div style={{ width: "2.2cqw", aspectRatio: "1", borderRadius: "50%", background: "#0f172a" }} />
            </div>
            <div
              className={playing ? "animate-spin" : ""}
              style={{
                width: "5cqw",
                aspectRatio: "1",
                borderRadius: "50%",
                background: "#f1f5f9",
                border: "0.4cqw solid #94a3b8",
                display: "grid",
                placeItems: "center",
                animationDuration: "2.8s",
                zIndex: 2,
              }}
            >
              <div style={{ width: "2.2cqw", aspectRatio: "1", borderRadius: "50%", background: "#0f172a" }} />
            </div>
          </div>

          <div style={{ textAlign: "center", fontFamily: mono, fontSize: "1.8cqw", letterSpacing: "0.15em", opacity: 0.7 }}>
            HIGH OUTPUT · STEREO C-90
          </div>
        </div>
      );
    }

    case "playlist": {
      const tracklist = day.playlist && day.playlist.length > 0 ? day.playlist : [day.song];
      return (
        <div
          style={{
            ...card,
            padding: "1.8cqw 2cqw",
            borderRadius: "1.4cqw",
            fontFamily: mono,
            minWidth: "28cqw",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "0.15cqw dashed currentColor", paddingBottom: "0.6cqw", marginBottom: "1cqw", fontSize: "1.8cqw", letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.75 }}>
            <span>TRACKLIST</span>
            <span>{tracklist.length} {tracklist.length === 1 ? "TRACK" : "TRACKS"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6cqw" }}>
            {tracklist.slice(0, 5).map((s, idx) => {
              const isActive = currentSong.title === s.title;
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.8cqw", fontSize: "2.4cqw", lineHeight: 1.2, fontWeight: isActive ? 700 : 400 }}>
                  <span style={{ opacity: 0.6, fontSize: "2cqw" }}>{String(idx + 1).padStart(2, "0")}.</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</span>
                  {isActive && <span style={{ color: pal[0] ?? "#e11d48", fontSize: "2cqw" }}>▶</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }
}

type Props = {
  day: DayPassport;
  items: SceneItem[];
  setItems: Dispatch<SetStateAction<SceneItem[]>>;
  edit: boolean;
  sel: string | null;
  setSel: (id: string | null) => void;
  playing: boolean;
  noPreview: boolean;
  onDisc: () => void;
  activeSong?: Song;
  currentSongIndex?: number;
};

/** Слой элементов поверх сцены: в режиме редактирования элементы свободно перетаскиваются мышью/тачем. */
export default function Overlay({
  day,
  items,
  setItems,
  edit,
  sel,
  setSel,
  playing,
  noPreview,
  onDisc,
  activeSong,
  currentSongIndex = 0,
}: Props) {
  const box = useRef<HTMLDivElement>(null);

  function down(e: React.PointerEvent, it: SceneItem) {
    if (!edit) return;
    e.preventDefault();
    e.stopPropagation();
    setSel(it.id);

    const r = box.current!.getBoundingClientRect();
    const ox = e.clientX,
      oy = e.clientY,
      sx = it.x,
      sy = it.y;

    const mv = (m: PointerEvent) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === it.id
            ? {
              ...i,
              x: cl(sx + ((m.clientX - ox) / r.width) * 100),
              y: cl(sy + ((m.clientY - oy) / r.height) * 100),
            }
            : i,
        ),
      );
    };

    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  // Интерактивное вращение мышью/тачем прямо за крутилку над элементом
  function startRotate(e: React.PointerEvent, it: SceneItem) {
    e.preventDefault();
    e.stopPropagation();
    const r = box.current!.getBoundingClientRect();
    const centerX = r.left + (it.x / 100) * r.width;
    const centerY = r.top + (it.y / 100) * r.height;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startDeg = it.r || 0;

    const mv = (m: PointerEvent) => {
      const currentAngle = Math.atan2(m.clientY - centerY, m.clientX - centerX);
      const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
      let newDeg = Math.round(startDeg + deltaDeg);
      newDeg = ((((newDeg + 180) % 360) + 360) % 360) - 180;
      if (Math.abs(newDeg) < 3) newDeg = 0;
      else if (Math.abs(newDeg - 90) < 3) newDeg = 90;
      else if (Math.abs(newDeg + 90) < 3) newDeg = -90;
      else if (Math.abs(Math.abs(newDeg) - 180) < 3) newDeg = 180;

      setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, r: newDeg } : i)));
    };

    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  // Интерактивное масштабирование мышью/тачем за угловые маркеры
  function startResize(e: React.PointerEvent, it: SceneItem) {
    e.preventDefault();
    e.stopPropagation();
    const r = box.current!.getBoundingClientRect();
    const centerX = r.left + (it.x / 100) * r.width;
    const centerY = r.top + (it.y / 100) * r.height;
    const startDist = Math.max(10, Math.hypot(e.clientX - centerX, e.clientY - centerY));
    const startScale = it.s || 1;

    const mv = (m: PointerEvent) => {
      const currentDist = Math.hypot(m.clientX - centerX, m.clientY - centerY);
      const ratio = currentDist / startDist;
      const newScale = Math.min(3, Math.max(0.35, Number((startScale * ratio).toFixed(2))));

      setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, s: newScale } : i)));
    };

    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  // Масштабирование колесиком мыши прямо по выделенному элементу
  function handleWheel(e: React.WheelEvent, it: SceneItem) {
    if (!edit || sel !== it.id) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    const nextScale = Math.min(3, Math.max(0.35, Number(((it.s || 1) + delta).toFixed(2))));
    setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, s: nextScale } : i)));
  }

  function updateScale(id: string, delta: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, s: Math.min(3, Math.max(0.35, Number(((i.s || 1) + delta).toFixed(2)))) } : i
      )
    );
  }

  function updateRotate(id: string, delta: number | "reset") {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (delta === "reset") return { ...i, r: 0 };
        let r = ((i.r || 0) + delta) % 360;
        if (r > 180) r -= 360;
        if (r < -180) r += 360;
        return { ...i, r };
      })
    );
  }

  function moveZInline(id: string, dir: "up" | "down") {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const copy = [...prev];
      const target = dir === "up" ? Math.min(copy.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (target === idx) return prev;
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
  }

  function duplicateInline(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const nextId = `${item.kind}-${Date.now()}`;
      const clone = { ...item, id: nextId, x: Math.min(90, item.x + 4), y: Math.min(90, item.y + 4) };
      setSel(nextId);
      const next = [...prev, clone];
      return next.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
  }

  function removeInline(id: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      return next.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
    setSel(null);
  }

  return (
    <div
      ref={box}
      onClick={(e) => {
        if (edit && (e.target as HTMLElement) === box.current) {
          setSel(null);
        }
      }}
      className="pointer-events-none absolute inset-0"
      style={{ containerType: "inline-size" }}
    >
      {items.map((it, idx) => {
        const baseW = it.size || WIDTH[it.kind] || 28;
        const width = baseW * (it.s || 1);
        const zIndex = it.zIndex ?? (idx + 1) * 10;

        // Wrapper for the item — position, rotation, zIndex all here
        // Маркеры и панель рендерим в отдельном div, который НЕ вращается вместе с элементом
        // — это позволяет плавающей панели всегда оставаться горизонтальной
        return (
          <div
            key={it.id}
            style={{
              position: "absolute",
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: `${width}cqw`,
              zIndex,
              // НЕ применяем transform сюда — он только на внутреннем элементе,
              // чтобы position:absolute маркеры могли выходить за край без обрезки
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            {/* Элемент сцены с вращением */}
            <div
              data-item
              data-disc={it.kind === "disc" ? "" : undefined}
              onPointerDown={(e) => down(e, it)}
              onWheel={(e) => handleWheel(e, it)}
              onClick={(e) => {
                if (!edit && it.kind === "disc" && !noPreview) {
                  e.stopPropagation();
                  onDisc();
                } else if (edit) {
                  e.stopPropagation();
                  setSel(it.id);
                }
              }}
              title={
                it.kind === "disc"
                  ? noPreview
                    ? "превью песни недоступно"
                    : playing
                      ? "нажмите, чтобы выключить музыку"
                      : "нажмите, чтобы включить музыку"
                  : edit
                    ? "Потяните для перемещения · Колесико для масштаба"
                    : undefined
              }
              style={{
                position: "relative",
                width: "100%",
                transform: `rotate(${it.r}deg)`,
                pointerEvents: edit || it.kind === "disc" ? "auto" : "none",
                cursor: edit ? "grab" : it.kind === "disc" ? "pointer" : "default",
                touchAction: edit ? "none" : "auto",
                userSelect: "none",
                outline: edit && sel === it.id ? "0.35cqw dashed #e11d48" : "none",
                outlineOffset: "0.8cqw",
                borderRadius: it.kind === "disc" ? "50%" : "0.6cqw",
                transition: edit ? "none" : "transform 0.15s ease",
              }}
            >
              <Body
                it={it}
                day={day}
                playing={playing}
                noPreview={noPreview}
                activeSong={activeSong}
                currentSongIndex={currentSongIndex}
              />
            </div>

            {/* Интерактивные маркеры управления — рендерятся поверх, БЕЗ вращения */}
            {edit && sel === it.id && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  overflow: "visible",
                }}
              >
                {/* 4 угловых маркера масштабирования */}
                <div
                  onPointerDown={(e) => startResize(e, it)}
                  title="Потяните для изменения размера (или крутите колесико мыши)"
                  style={{
                    position: "absolute",
                    top: "-1.5cqw",
                    left: "-1.5cqw",
                    width: "3cqw",
                    height: "3cqw",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    border: "0.4cqw solid #e11d48",
                    boxShadow: "0 0.4cqw 1cqw rgba(0,0,0,0.4)",
                    cursor: "nwse-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                    zIndex: 10,
                  }}
                />
                <div
                  onPointerDown={(e) => startResize(e, it)}
                  title="Потяните для изменения размера (или крутите колесико мыши)"
                  style={{
                    position: "absolute",
                    top: "-1.5cqw",
                    right: "-1.5cqw",
                    width: "3cqw",
                    height: "3cqw",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    border: "0.4cqw solid #e11d48",
                    boxShadow: "0 0.4cqw 1cqw rgba(0,0,0,0.4)",
                    cursor: "nesw-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                    zIndex: 10,
                  }}
                />
                <div
                  onPointerDown={(e) => startResize(e, it)}
                  title="Потяните для изменения размера (или крутите колесико мыши)"
                  style={{
                    position: "absolute",
                    bottom: "-1.5cqw",
                    left: "-1.5cqw",
                    width: "3cqw",
                    height: "3cqw",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    border: "0.4cqw solid #e11d48",
                    boxShadow: "0 0.4cqw 1cqw rgba(0,0,0,0.4)",
                    cursor: "nesw-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                    zIndex: 10,
                  }}
                />
                <div
                  onPointerDown={(e) => startResize(e, it)}
                  title="Потяните для изменения размера (или крутите колесико мыши)"
                  style={{
                    position: "absolute",
                    bottom: "-1.5cqw",
                    right: "-1.5cqw",
                    width: "3cqw",
                    height: "3cqw",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    border: "0.4cqw solid #e11d48",
                    boxShadow: "0 0.4cqw 1cqw rgba(0,0,0,0.4)",
                    cursor: "nwse-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                    zIndex: 10,
                  }}
                />

                {/* Ножка крутилки */}
                <div
                  style={{
                    position: "absolute",
                    top: "-5cqw",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "0.4cqw",
                    height: "5cqw",
                    backgroundColor: "#e11d48",
                    pointerEvents: "none",
                    zIndex: 9,
                  }}
                />
                {/* Ручка вращения */}
                <div
                  onPointerDown={(e) => startRotate(e, it)}
                  title="Потяните для вращения элемента"
                  style={{
                    position: "absolute",
                    top: "-8.5cqw",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "3.8cqw",
                    height: "3.8cqw",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    border: "0.4cqw solid #e11d48",
                    boxShadow: "0 0.5cqw 1.5cqw rgba(0,0,0,0.4)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "2cqw",
                    cursor: "grab",
                    pointerEvents: "auto",
                    touchAction: "none",
                    userSelect: "none",
                    zIndex: 10,
                  }}
                >
                  🔄
                </div>

                {/* Плавающая панель быстрого управления — всегда горизонтальная */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 10cqw)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 20,
                    pointerEvents: "auto",
                    whiteSpace: "nowrap",
                    fontSize: "12px",
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-900/95 px-2.5 py-1.5 text-white shadow-2xl backdrop-blur border border-white/20 select-none font-mono"
                >
                  <button
                    type="button"
                    onClick={() => updateScale(it.id, -0.1)}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 transition text-sm"
                    title="Уменьшить"
                  >
                    −
                  </button>
                  <span style={{ fontSize: "11px", color: "#d6d3d1", minWidth: "3em", textAlign: "center" }}>
                    {(it.s || 1).toFixed(2)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => updateScale(it.id, 0.1)}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 transition text-sm"
                    title="Увеличить"
                  >
                    +
                  </button>

                  <span style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.2)", margin: "0 2px", display: "inline-block" }} />

                  <button
                    type="button"
                    onClick={() => updateRotate(it.id, -15)}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 transition"
                    title="−15°"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRotate(it.id, "reset")}
                    style={{ fontSize: "11px", color: "#d6d3d1", minWidth: "3em", textAlign: "center" }}
                    className="hover:text-white transition"
                    title="Сбросить угол"
                  >
                    {Math.round(it.r || 0)}°
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRotate(it.id, 15)}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 transition"
                    title="+15°"
                  >
                    ↻
                  </button>

                  <span style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.2)", margin: "0 2px", display: "inline-block" }} />

                  <button
                    type="button"
                    onClick={() => moveZInline(it.id, "up")}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 transition"
                    title="Слой выше"
                  >
                    ⬆
                  </button>
                  <button
                    type="button"
                    onClick={() => moveZInline(it.id, "down")}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 transition"
                    title="Слой ниже"
                  >
                    ⬇
                  </button>

                  <span style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.2)", margin: "0 2px", display: "inline-block" }} />

                  <button
                    type="button"
                    onClick={() => duplicateInline(it.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 transition"
                    title="Дублировать"
                  >
                    📋
                  </button>
                  <button
                    type="button"
                    onClick={() => removeInline(it.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-rose-600 transition"
                    title="Удалить"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
