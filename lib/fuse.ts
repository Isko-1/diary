import type { DayPassport } from "./types";

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const wavg = (a: [number, number][]) => {
  const s = a.reduce((x, [w]) => x + w, 0);
  return clamp(a.reduce((x, [w, v]) => x + w * v, 0) / s);
};

type In = Pick<DayPassport, "textMood" | "photoStats" | "song">;

/** Слияние источников. Веса перенормируются по доступным источникам. */
export function fuse(p: In) {
  const f = p.song.features;
  const why: string[] = [];

  const v: [number, number][] = [
    [0.5, p.textMood.valence],
    [0.15, p.photoStats.warmth],
  ];
  if (f?.valence != null) v.push([0.35, f.valence]);

  let songEnergy: number | null = null;
  if (f?.energy != null) songEnergy = clamp(f.energy);
  else if (f?.tempo) songEnergy = clamp((f.tempo - 60) / 120);

  const a: [number, number][] = [
    [0.4, p.textMood.arousal],
    [0.2, p.photoStats.contrast],
  ];
  if (songEnergy != null) a.push([0.4, songEnergy]);

  const mood = { valence: wavg(v), arousal: wavg(a) };

  const src = p.song.featuresSource;
  if (songEnergy != null) {
    const e = songEnergy.toFixed(2);
    why.push(
      songEnergy < 0.4
        ? `энергия песни ${e} → медленный ритм, больше воздуха`
        : songEnergy > 0.65
          ? `энергия песни ${e} → быстрый ритм, плотнее кадры`
          : `энергия песни ${e} → умеренный ритм`,
    );
  }
  if (f?.mode === 0) why.push("минор в песне → тона холоднее и приглушённее");
  if (f?.mode === 1) why.push("мажор в песне → тона светлее и чище");
  if (src === "llm") why.push("признаки песни оценены по названию и исполнителю (не измерены)");
  if (!f) why.push("признаков песни нет → оформление держится на тексте и фото");
  why.push(
    `тон записи ${p.textMood.valence.toFixed(2)}, напряжённость ${p.textMood.arousal.toFixed(2)}`,
  );
  why.push(`тепло фото ${p.photoStats.warmth.toFixed(2)}, контраст ${p.photoStats.contrast.toFixed(2)}`);

  return { mood, why, songEnergy };
}
