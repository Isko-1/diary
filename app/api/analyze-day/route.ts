import { NextResponse } from "next/server";
import { askJson } from "@/lib/llm";

const TOD = ["morning", "day", "evening", "night"];
const SEASON = ["winter", "spring", "summer", "autumn"];
const clamp = (x: unknown, d = 0.5) => (typeof x === "number" && isFinite(x) ? Math.min(1, Math.max(0, x)) : d);
const arr = (x: unknown) => (Array.isArray(x) ? x.filter((s) => typeof s === "string").slice(0, 6) : []);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const SYSTEM = `Ты анализируешь запись личного дневника. Верни СТРОГО JSON без пояснений:
{"textMood":{"valence":0..1,"arousal":0..1,"warmth":0..1},
 "context":{"timeOfDay":"morning|day|evening|night","season":"winter|spring|summer|autumn","people":[],"places":[],"keywords":[]},
 "title":"название дня, 3-7 слов, на языке записи, спокойный тон, без кавычек и точки"}
valence — приятность настроения, arousal — энергия/напряжённость, warmth — душевное тепло.
Это описание тона текста, а не диагноз.`;

function fallback(text: string) {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  const kw = [...new Set(text.toLowerCase().match(/[а-яёa-z]{5,}/g) ?? [])].slice(0, 4);
  return {
    textMood: {
      valence: has("тепл", "счаст", "радост", "уют", "смех", "какао") ? 0.75 : has("устал", "груст", "тревог", "срочн", "дедлайн") ? 0.3 : 0.5,
      arousal: has("срочн", "бежал", "дедлайн", "быстр", "шум", "ночь в офисе") ? 0.8 : has("тих", "спокой", "медленн", "долго") ? 0.25 : 0.5,
      warmth: has("тепл", "какао", "обнял", "друг") ? 0.8 : 0.4,
    },
    context: {
      timeOfDay: has("ноч") ? "night" : has("вечер") ? "evening" : has("утр") ? "morning" : "day",
      season: has("осен", "листь") ? "autumn" : has("зим", "снег") ? "winter" : has("лет", "жар") ? "summer" : has("весн") ? "spring" : "autumn",
      people: [],
      places: [],
      keywords: kw,
    },
    title: kw.length >= 3 ? kw.slice(0, 3).join(" ") : "Один день из дневника",
  };
}

export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || text.trim().length < 5)
    return NextResponse.json({ error: "text required" }, { status: 400 });

  let out: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const j = await askJson(SYSTEM, text.slice(0, 4000));
    if (j && j.textMood && j.context && typeof j.title === "string" && words(j.title) >= 3 && words(j.title) <= 7) {
      out = j;
      break;
    }
  }
  if (!out) out = fallback(text);

  return NextResponse.json({
    textMood: {
      valence: clamp(out.textMood.valence),
      arousal: clamp(out.textMood.arousal),
      warmth: clamp(out.textMood.warmth),
    },
    context: {
      timeOfDay: TOD.includes(out.context.timeOfDay) ? out.context.timeOfDay : "day",
      season: SEASON.includes(out.context.season) ? out.context.season : "autumn",
      people: arr(out.context.people),
      places: arr(out.context.places),
      keywords: arr(out.context.keywords),
    },
    title: String(out.title).replace(/["«».]/g, "").trim(),
  });
}
