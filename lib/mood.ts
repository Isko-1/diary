/**
 * Метка настроения дня. Раньше цвет и подпись считались только по valence,
 * из-за чего «приятный» день получал подпись «Энергично», а тревожная ночь
 * (valence низкий) — «Спокойно». Теперь используются обе оси: valence и arousal.
 * Единый источник для карточек архива и легенды календаря.
 */
export type MoodKey = "energetic" | "tense" | "warm" | "calm" | "dreamy" | "quiet";

export const MOODS: Record<MoodKey, { label: string; color: string }> = {
  energetic: { label: "Энергично", color: "#ff7a59" },
  tense: { label: "Напряжённо", color: "#e11d48" },
  warm: { label: "Тепло", color: "#f59e0b" },
  calm: { label: "Спокойно", color: "#10b981" },
  dreamy: { label: "Мечтательно", color: "#a855f7" },
  quiet: { label: "Задумчиво", color: "#64748b" },
};

/** Порядок для легенды. */
export const MOOD_ORDER: MoodKey[] = ["energetic", "tense", "warm", "calm", "dreamy", "quiet"];

export function moodOf(m: { valence: number; arousal: number }): MoodKey {
  const { valence: v, arousal: a } = m;
  // Тревожная ночь, дедлайн, напряжение (высокий arousal, низкий valence)
  if (a >= 0.55 && v < 0.50) return "tense";
  // Высокая энергия, радость, веселье (высокий arousal, высокий valence)
  if (a >= 0.55 && v >= 0.50) return "energetic";
  // Тёплый, приятный, уютный день (парк, какао, прогулка)
  if (v >= 0.65) return "warm";
  // Спокойный день (низкая напряженность, ровное или хорошее настроение)
  if (v >= 0.45 && a < 0.45) return "calm";
  // Мечтательный тон
  if (v >= 0.40) return "dreamy";
  // Задумчиво / тихо / меланхолично
  return "quiet";
}

export const moodColor = (m: { valence: number; arousal: number }) => MOODS[moodOf(m)].color;
export const moodLabel = (m: { valence: number; arousal: number }) => MOODS[moodOf(m)].label;
