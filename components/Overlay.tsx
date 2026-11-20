"use client";
import { useRef, type Dispatch, type SetStateAction } from "react";
import { GLYPH, tile } from "@/lib/env";
import { theme } from "@/lib/style";
import type { DayPassport, SceneItem } from "@/lib/types";

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
};

const TOD = { morning: "утро", day: "день", evening: "вечер", night: "ночь" } as const;
export const stampText = (day: DayPassport) => TOD[day.context.timeOfDay];

export function defaultItems(day: DayPassport): SceneItem[] {
  const it: SceneItem[] = [
    {
      id: "disc",
      kind: "disc",
      x: 75,
      y: 71,
      s: 1.2,
      r: 0,
      size: 40,
      variant: "black",
      text: "photo",
    },
  ];
  if (day.weather) {
    it.push({
      id: "weather",
      kind: "weather",
      x: 23,
      y: 73,
      s: 1.1,
      r: -3,
      variant: "card",
    });
  }
  if (day.geo) {
    it.push({
      id: "map",
      kind: "map",
      x: 80,
      y: 25,
      s: 1.05,
      r: 3,
      variant: "tile",
    });
  }
  return it;
}

const mono = '"JetBrains Mono", monospace';
const serif = "Fraunces, serif";
const hand = "Caveat, cursive";
const cl = (x: number) => Math.min(100, Math.max(0, x));

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
}: {
  it: SceneItem;
  day: DayPassport;
  playing: boolean;
  noPreview: boolean;
}) {
  const th = theme(day);
  const pal = day.style.params.palette;
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
      const spinSpeed = (5.5 - 3.8 * day.style.params.tempo).toFixed(1);

      // Вариант центрального лейбла: photo | vintage | palette | minimal
      const labelType = it.text || "photo";
      const photoUrl = day.photos[0];

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
              {labelType === "photo" && photoUrl ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url("${photoUrl}")`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                    filter: "contrast(1.05) saturate(1.1)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)",
                    }}
                  />
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
                    {day.song.title}
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
            ♪ {day.song.title} — {day.song.artist}
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
      return (
        <div
          style={{
            background: "rgba(15, 15, 18, 0.85)",
            backdropFilter: "blur(8px)",
            color: "#fff",
            borderRadius: "1.4cqw",
            padding: "1.4cqw 2cqw",
            border: "0.15cqw solid rgba(255,255,255,0.18)",
            boxShadow: "0 1cqw 3cqw rgba(0,0,0,0.35)",
            fontFamily: mono,
          }}
        >
          <div style={{ fontSize: "1.8cqw", letterSpacing: "0.1em", opacity: 0.7, textTransform: "uppercase" }}>
            NOW PLAYING
          </div>
          <div
            style={{
              fontFamily: serif,
              fontSize: "3.2cqw",
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: "0.2cqw",
            }}
          >
            {day.song.title}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4cqw", height: "3.5cqw", marginTop: "0.8cqw" }}>
            {[0.4, 0.8, 0.5, 0.9, 0.3, 0.7, 1.0, 0.6, 0.4, 0.8, 0.5].map((h, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  background: pal[i % pal.length] ?? "#38bdf8",
                  height: playing ? `${h * 100}%` : "30%",
                  borderRadius: "0.2cqw",
                  transition: "height 0.2s ease",
                }}
              />
            ))}
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

  return (
    <div
      ref={box}
      onClick={(e) => {
        if (edit && (e.target as HTMLElement) === box.current) {
          setSel(null);
        }
      }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ containerType: "inline-size" }}
    >
      {items.map((it, idx) => {
        const baseW = it.size || WIDTH[it.kind] || 28;
        const width = baseW * (it.s || 1);
        const zIndex = it.zIndex ?? (it.id === sel ? 50 : idx + 10);

        return (
          <div
            key={it.id}
            data-item
            data-disc={it.kind === "disc" ? "" : undefined}
            onPointerDown={(e) => down(e, it)}
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
                : undefined
            }
            style={{
              position: "absolute",
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: `${width}cqw`,
              transform: `translate(-50%,-50%) rotate(${it.r}deg)`,
              pointerEvents: edit || it.kind === "disc" ? "auto" : "none",
              cursor: edit ? "grab" : it.kind === "disc" ? "pointer" : "default",
              touchAction: edit ? "none" : "auto",
              userSelect: "none",
              zIndex,
              outline: edit && sel === it.id ? "0.35cqw dashed #e11d48" : "none",
              outlineOffset: "0.8cqw",
              borderRadius: it.kind === "disc" ? "50%" : "0.6cqw",
              transition: edit ? "none" : "transform 0.15s ease",
            }}
          >
            <Body it={it} day={day} playing={playing} noPreview={noPreview} />
          </div>
        );
      })}
    </div>
  );
}
