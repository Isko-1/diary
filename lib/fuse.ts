import type { DayPassport } from "./types";

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const wavg = (a: [number, number][]) => {
  const s = a.reduce((x, [w]) => x + w, 0);
  return clamp(a.reduce((x, [w, v]) => x + w * v, 0) / s);
};

type In = Pick<DayPassport, "textMood" | "photoStats" | "song">;

/**
 * Слияние источников. Веса перенормируются по доступным источникам.
 *
 * Правило «текст главнее музыки»: если напряжённость текста однозначна (≤0.25 или ≥0.75),
 * она получает основной вес, а итоговый arousal нельзя увести музыкой на другую сторону.
 * Так тревожная ночь с дедлайном не превращается в «тихо и пусто» из-за медленного трека.
 */
export function fuse(p: In) {
  const f = p.song.features;
  const src = p.song.featuresSource;
  const why: string[] = [];

  const v: [number, number][] = [
    [0.5, p.textMood.valence],
    [0.15, p.photoStats.warmth],
  ];
  if (f?.valence != null) v.push([0.35, f.valence]);

  // «Энергия песни» бывает двух видов: настоящая (energy из ReccoBeats или оценка модели)
  // и просто темп BPM, пересчитанный в 0..1. Это разные вещи, и в объяснении они различаются.
  let songEnergy: number | null = null;
  let energyKind: "energy" | "tempo" | null = null;
  if (f?.energy != null) {
    songEnergy = clamp(f.energy);
    energyKind = "energy";
  } else if (f?.tempo) {
    songEnergy = clamp((f.tempo - 60) / 120);
    energyKind = "tempo";
  }

  const ta = p.textMood.arousal;
  const isHighTension = ta >= 0.70;
  const isLowTension = ta <= 0.30;
  const textDecisive = isHighTension || isLowTension || Math.abs(ta - 0.5) >= 0.25;

  // Темп без измеренной энергии — слабое свидетельство (91 BPM у синтвейва Kavinsky Nightcall не делает день спокойным).
  // Если текст однозначно напряжённый (дедлайн, стресс) или спокойный (какао, парк), он доминирует над музыкой!
  const songW =
    songEnergy == null
      ? 0
      : isHighTension
        ? 0.1 // При дедлайне музыка не может разбавить тревогу до «минимализма»
        : energyKind === "tempo"
          ? 0.15
          : textDecisive
            ? 0.2
            : 0.4;
  const textW = isHighTension ? 0.75 : textDecisive ? 0.65 : 0.4;

  const a: [number, number][] = [
    [textW, ta],
    [textDecisive ? 0.1 : 0.2, p.photoStats.contrast],
  ];
  if (songEnergy != null) a.push([songW, songEnergy]);

  let arousal = wavg(a);
  if (isHighTension) {
    // Жёсткая фиксация: напряжённый текст гарантирует arousal >= 0.74, активируя стиль Кандинского
    arousal = Math.max(arousal, Math.max(0.74, ta * 0.95));
  } else if (textDecisive) {
    const bound = 0.5 + (ta - 0.5) * 0.8;
    arousal = ta > 0.5 ? Math.max(arousal, bound) : Math.min(arousal, bound);
  }

  const mood = { valence: wavg(v), arousal: clamp(arousal) };

  if (songEnergy != null) {
    const e = songEnergy.toFixed(2);
    const label =
      energyKind === "tempo"
        ? `темп ${Math.round(f!.tempo!)} BPM (энергия трека не измерена)`
        : src === "llm"
          ? `энергия песни ≈${e} (оценка модели, не измерение)`
          : `энергия песни ${e}`;
    why.push(
      songEnergy < 0.4
        ? `${label} → медленный ритм, больше воздуха`
        : songEnergy > 0.65
          ? `${label} → быстрый ритм, плотнее кадры`
          : `${label} → умеренный ритм`,
    );
  }
  if (isHighTension) {
    why.push(
      `напряжённость текста ${ta.toFixed(2)} (дедлайн/тревога) переопределяет темп музыки → доминирует стиль Кандинского (напряжённо и ритмично)`,
    );
  } else if (textDecisive) {
    const tense = ta > 0.5;
    const against = songEnergy != null && (tense ? songEnergy < 0.4 : songEnergy > 0.65);
    why.push(
      against
        ? `текст однозначен (напряжённость ${ta.toFixed(2)}) и перекрывает ${tense ? "медленную" : "быструю"} песню`
        : `текст однозначен (напряжённость ${ta.toFixed(2)}) → он главнее музыки`,
    );
  }
  if (f?.mode === 0) why.push("минор в песне → тона холоднее и приглушённее");
  if (f?.mode === 1) why.push("мажор в песне → тона светлее и чище");
  if (src === "llm" && f?.mode != null) why.push("тональность оценена моделью по названию и исполнителю (не измерена)");
  if (!f) why.push("признаков песни нет → оформление держится на тексте и фото");
  why.push(`тон записи ${p.textMood.valence.toFixed(2)}, напряжённость ${ta.toFixed(2)}`);
  why.push(`тепло фото ${p.photoStats.warmth.toFixed(2)}, контраст ${p.photoStats.contrast.toFixed(2)}`);

  return { mood, why, songEnergy };
}
