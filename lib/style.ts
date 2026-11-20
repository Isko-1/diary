import { clampChroma, converter, formatHex, parse } from "culori";
import type { DayContext, DayPassport, PhotoStats, Song, Technique, Weather } from "./types";

const toOklch = converter("oklch");
const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** Центры техник на карте настроений (x = arousal, y = valence). */
const CENTERS: Record<Technique, { a: number; v: number }> = {
  monet: { a: 0.25, v: 0.75 },
  matisse: { a: 0.8, v: 0.8 },
  kandinsky: { a: 0.8, v: 0.25 },
  minimal: { a: 0.2, v: 0.25 },
};

const NAMES: Record<Technique, string> = {
  monet: "Моне",
  matisse: "Матисс",
  kandinsky: "Кандинский",
  minimal: "Минимализм",
};
export const techniqueName = (t: Technique) => NAMES[t];

export function dominant(w: Record<Technique, number>): Technique {
  return (Object.keys(w) as Technique[]).sort((x, y) => w[y] - w[x])[0];
}

const WHY_TECH: Record<Technique, string> = {
  monet: "спокойно и тепло → мазки Моне: мягкий свет, размытые края",
  matisse: "живо и радостно → вырезанные формы Матисса",
  kandinsky: "напряжённо и ритмично → линии и круги Кандинского",
  minimal: "тихо и пусто → цветовые поля, много воздуха",
};

function shortestHueLerp(h: number, target: number, t: number) {
  let d = ((target - h + 540) % 360) - 180;
  return (h + d * t + 360) % 360;
}

const TOD_L: Record<string, number> = { morning: 0.05, day: 0, evening: -0.05, night: -0.12 };
const SEASON_H: Record<string, number> = { winter: -8, spring: 6, summer: 12, autumn: 14 };

/** Палитра берётся из фото и сдвигается настроением в OKLCH. */
export function shiftPalette(
  base: string[],
  mood: { valence: number; arousal: number },
  ctx: DayContext,
  mode?: 0 | 1,
) {
  const src = base.length ? base : ["#c9a24b", "#8a6b3a", "#e8d9b5"];
  const cold = clamp((0.5 - mood.valence) * 1.4 + (mode === 0 ? 0.25 : 0));
  return src.map((hex) => {
    const o = toOklch(parse(hex));
    if (!o) return hex;
    const h = shortestHueLerp((o.h ?? 0) + (SEASON_H[ctx.season] ?? 0), 250, cold * 0.5);
    const c = (o.c ?? 0) * (1 - cold * 0.5) * (0.8 + 0.5 * mood.arousal);
    const l = Math.min(0.92, Math.max(0.18, o.l + (TOD_L[ctx.timeOfDay] ?? 0)));
    return formatHex(clampChroma({ mode: "oklch", l, c, h }, "oklch")) ?? hex;
  });
}

export function pickStyle(
  mood: { valence: number; arousal: number },
  song: Song,
  ctx: DayContext,
  photo: PhotoStats,
): { style: DayPassport["style"]; why: string[] } {
  const sigma = 0.3;
  const raw = {} as Record<Technique, number>;
  let sum = 0;
  (Object.keys(CENTERS) as Technique[]).forEach((k) => {
    const d2 = (mood.arousal - CENTERS[k].a) ** 2 + (mood.valence - CENTERS[k].v) ** 2;
    raw[k] = Math.exp(-d2 / (2 * sigma * sigma));
    sum += raw[k];
  });
  const weights = {} as Record<Technique, number>;
  (Object.keys(raw) as Technique[]).forEach((k) => (weights[k] = raw[k] / sum));

  const f = song.features;
  const tempo = f?.tempo ? clamp((f.tempo - 60) / 120) : mood.arousal;
  const palette = shiftPalette(photo.palette, mood, ctx, f?.mode);

  const top = dominant(weights);
  return {
    style: {
      weights,
      params: {
        grain: 0.12 + 0.18 * (1 - mood.valence) + 0.06 * (ctx.timeOfDay === "night" ? 1 : 0),
        softness: clamp(1 - mood.arousal),
        tempo,
        density: clamp(0.15 + 0.85 * mood.arousal),
        palette,
      },
    },
    why: [
      `${WHY_TECH[top]} (вес ${weights[top].toFixed(2)})`,
      `время суток «${ctx.timeOfDay}» → светлота палитры, сезон «${ctx.season}» → базовый оттенок`,
    ],
  };
}

/** Погода двигает фактуру и ритм, а не цвет: «дождь» не значит «синий». */
export function weatherTweak(style: DayPassport["style"], w: Weather) {
  const p = { ...style.params };
  const why: string[] = [];
  if (w.kind === "rain" || w.kind === "storm") {
    p.softness = clamp(p.softness + 0.2);
    p.grain += 0.04;
    why.push(`${w.label} → мягче края, больше зерна, по кадру идут капли`);
  } else if (w.kind === "fog") {
    p.softness = clamp(p.softness + 0.3);
    why.push("туман → размытые края, дымка внизу кадра");
  } else if (w.kind === "snow") {
    p.softness = clamp(p.softness + 0.15);
    p.tempo = clamp(p.tempo * 0.8);
    why.push("снег → тише и медленнее, по кадру падают хлопья");
  } else if (w.kind === "clear") {
    p.grain = Math.max(0.08, p.grain - 0.03);
    why.push("ясно → чище свет, меньше зерна");
  }
  if (w.wind >= 20) {
    p.tempo = clamp(p.tempo + 0.15);
    why.push(`ветер ${w.wind} км/ч → быстрее движение`);
  }
  return { style: { ...style, params: p }, why };
}

/** Фон и цвет текста постоянных элементов — из палитры дня. */
export function theme(day: DayPassport) {
  const dark = day.context.timeOfDay === "night" || day.context.timeOfDay === "evening";
  const p0 = toOklch(parse(day.style.params.palette[0] ?? "#888")) ?? { h: 60 };
  const mk = (l: number, c: number) =>
    formatHex(clampChroma({ mode: "oklch", l, c, h: p0.h ?? 60 }, "oklch")) ?? "#111";
  return {
    dark,
    bg: dark ? mk(0.18, 0.03) : mk(0.95, 0.02),
    fg: dark ? mk(0.93, 0.02) : mk(0.2, 0.02),
  };
}
