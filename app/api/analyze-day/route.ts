import { NextResponse } from "next/server";
import { askJson } from "@/lib/llm";
import { textEnergy } from "@/lib/textEnergy";
import type { Season, TimeOfDay } from "@/lib/types";

const TOD = ["morning", "day", "evening", "night"];
const SEASON = ["winter", "spring", "summer", "autumn"];
const clamp = (x: unknown, d = 0.5) => (typeof x === "number" && isFinite(x) ? Math.min(1, Math.max(0, x)) : d);
const arr = (x: unknown) => (Array.isArray(x) ? x.filter((s) => typeof s === "string").slice(0, 6) : []);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// ───────────────────────── настроение и контекст ─────────────────────────

const MOOD_SYSTEM = `Ты анализируешь запись личного дневника. Верни СТРОГО JSON без пояснений:
{"textMood":{"valence":0..1,"arousal":0..1,"warmth":0..1},
 "context":{"timeOfDay":"morning|day|evening|night","season":"winter|spring|summer|autumn","people":[],"places":[],"keywords":[]}}
valence — приятность настроения (0 неприятно, 1 приятно).
arousal — энергия текста, это отдельная ось от valence: шум, драйв, движение, восклицания, концерт, спорт, спешка, дедлайн дают 0.75–1 (и радостный концерт, и тревожный дедлайн); покой, неспешность, тишина, уют, грусть дают 0–0.3.
warmth — душевное тепло.
Это описание тона текста, а не диагноз.`;

const seasonOfMonth = (m: number): Season => (m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn");

function monthOf(date: unknown): number {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return Number(date.slice(5, 7));
  return new Date().getMonth() + 1;
}

function fallbackMood(text: string, date: unknown) {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  const kw = [...new Set(text.toLowerCase().match(/[а-яёa-z]{5,}/g) ?? [])].slice(0, 4);
  return {
    fallback: true,
    textMood: {
      valence: has("тепл", "счаст", "радост", "уют", "смех", "какао", "весел", "круто", "здорово") ? 0.75 : has("устал", "груст", "тревог", "срочн", "дедлайн", "одинок", "тоск", "печал") ? 0.3 : 0.5,
      arousal: 0.5, // настоящее значение берётся из textEnergy() в POST
      warmth: has("тепл", "какао", "обнял", "друг") ? 0.8 : 0.4,
    },
    context: {
      timeOfDay: has("ноч") ? "night" : has("вечер") ? "evening" : has("утр") ? "morning" : "day",
      season: has("осен", "листь") ? "autumn" : has("зим", "снег") ? "winter" : has("лет", "жар") ? "summer" : has("весн") ? "spring" : seasonOfMonth(monthOf(date)),
      people: [] as string[],
      places: [] as string[],
      keywords: kw,
    },
  };
}

// ───────────────────────────── название дня ─────────────────────────────

const TITLE_SYSTEM = `Ты придумываешь красивое название для воспоминания в личном дневнике по тексту записи.
Верни СТРОГО JSON: {"title":"..."}.
Требования к названию:
- от 3 до 7 слов, на русском языке (или языке записи);
- с заглавной буквы, остальные слова со строчной (кроме имён);
- одно назывное словосочетание без глаголов, одного спокойного тона (как подпись в фотоальбоме);
- без кавычек, без точки на конце, без эмодзи;
- обязательно сохраняй предлоги и союзы, слова должны быть согласованы грамматически;
- включи ключевые образы дня: место, время года/суток, погоду, состояние, предмет или спутника;
- не используй пустые слова «день», «сегодня», «весь» как главный образ.
Примеры: «Осенний парк и какао», «Ночь в офисе перед сдачей», «Дождь, одиночество и чай».`;

const STOP_END = new Set(["и", "в", "во", "с", "со", "на", "по", "у", "к", "о", "об", "от", "из", "за", "для", "без", "над", "под", "при", "а", "но", "или"]);

/** Приводит ответ к формату названия или возвращает null, если формат нарушен. */
function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let t = raw
    .replace(/["«»“”„'`]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[.!?…,;:\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const n = words(t);
  if (n < 3 || n > 7) return null;
  // «День и чай»: пустое слово в главной роли — отказ, выберем эвристику
  if (/^(день|сегодня|весь|вся|всё)(?![а-яё])/i.test(t)) return null;
  const last = t.split(" ").pop()!.toLowerCase();
  if (STOP_END.has(last)) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Gender = "m" | "f" | "n" | "p";
const GI: Record<Gender, number> = { m: 0, f: 1, n: 2, p: 3 };
const SEASON_ADJ: Record<Season, string[]> = {
  autumn: ["осенний", "осенняя", "осеннее", "осенние"],
  winter: ["зимний", "зимняя", "зимнее", "зимние"],
  spring: ["весенний", "весенняя", "весеннее", "весенние"],
  summer: ["летний", "летняя", "летнее", "летние"],
};
const TOD_WORDS: Record<TimeOfDay, { nom: string; g: Gender; adv: string }> = {
  morning: { nom: "утро", g: "n", adv: "утром" },
  day: { nom: "день", g: "m", adv: "днём" },
  evening: { nom: "вечер", g: "m", adv: "вечером" },
  night: { nom: "ночь", g: "f", adv: "ночью" },
};

const L = "(?<![а-яё])"; // граница слова для кириллицы (\b её не понимает)
const E = "(?![а-яё])";

const PLACES: { re: RegExp; nom: string; prep: string; g: Gender }[] = [
  { re: new RegExp(`${L}парк`), nom: "парк", prep: "парке", g: "m" },
  { re: new RegExp(`${L}пруд`), nom: "пруд", prep: "пруду", g: "m" },
  { re: new RegExp(`${L}озер`), nom: "озеро", prep: "озере", g: "n" },
  { re: new RegExp(`${L}(?:река|реке|реку|речк)`), nom: "река", prep: "реке", g: "f" },
  { re: new RegExp(`${L}мор[еяю]${E}`), nom: "море", prep: "море", g: "n" },
  { re: new RegExp(`${L}лес(?:у|а|ом)?${E}`), nom: "лес", prep: "лесу", g: "m" },
  { re: new RegExp(`${L}пляж`), nom: "пляж", prep: "пляже", g: "m" },
  { re: new RegExp(`${L}набережн`), nom: "набережная", prep: "набережной", g: "f" },
  { re: new RegExp(`${L}офис`), nom: "офис", prep: "офисе", g: "m" },
  { re: new RegExp(`${L}кофейн`), nom: "кофейня", prep: "кофейне", g: "f" },
  { re: new RegExp(`${L}кафе${E}`), nom: "кафе", prep: "кафе", g: "n" },
  { re: new RegExp(`${L}дач[аеуи]${E}`), nom: "дача", prep: "даче", g: "f" },
  { re: new RegExp(`${L}кухн`), nom: "кухня", prep: "кухне", g: "f" },
  { re: new RegExp(`${L}квартир`), nom: "квартира", prep: "квартире", g: "f" },
  { re: new RegExp(`${L}двор(?:е|у|а|ом)?${E}`), nom: "двор", prep: "дворе", g: "m" },
  { re: new RegExp(`${L}гор(?:ы|ах|ам|ами)${E}`), nom: "горы", prep: "горах", g: "p" },
  { re: new RegExp(`${L}университет|${L}универ${E}`), nom: "университет", prep: "университете", g: "m" },
  { re: new RegExp(`${L}библиотек`), nom: "библиотека", prep: "библиотеке", g: "f" },
  { re: new RegExp(`${L}площад`), nom: "площадь", prep: "площади", g: "f" },
  { re: new RegExp(`${L}улиц`), nom: "улица", prep: "улице", g: "f" },
  { re: new RegExp(`${L}сад(?:у|а|ом)?${E}`), nom: "сад", prep: "саду", g: "m" },
  { re: new RegExp(`${L}город(?:е|у|а|ом)?${E}`), nom: "город", prep: "городе", g: "m" },
];

/**
 * Ключевые образы дня. k: 0 — погода и природа, 1 — состояние, 2 — предмет или событие.
 * В название берётся по одному образу каждого вида, в этом порядке: «Дождь, одиночество и чай».
 * Пустые слова («день», «сегодня», «весь») сюда не попадают по построению.
 */
const NOUNS: { re: RegExp; nom: string; k: 0 | 1 | 2 }[] = [
  { re: /дожд|ливень|морос/, nom: "дождь", k: 0 },
  { re: /снегопад|метел/, nom: "метель", k: 0 },
  { re: new RegExp(`${L}снег`), nom: "снег", k: 0 },
  { re: /гроз[аыу]/, nom: "гроза", k: 0 },
  { re: /туман/, nom: "туман", k: 0 },
  { re: /закат/, nom: "закат", k: 0 },
  { re: /рассвет/, nom: "рассвет", k: 0 },
  { re: new RegExp(`${L}ветер|${L}ветр`), nom: "ветер", k: 0 },
  { re: new RegExp(`${L}солнц|${L}солнечн`), nom: "солнце", k: 0 },

  { re: /одинок|одиночеств|в одиночку/, nom: "одиночество", k: 1 },
  { re: /груст|печал|тоск/, nom: "грусть", k: 1 },
  { re: /тревог|волнени/, nom: "тревога", k: 1 },
  { re: /счасть|счастлив|радост|радовал/, nom: "радость", k: 1 },
  { re: /любов|влюбл/, nom: "любовь", k: 1 },
  { re: new RegExp(`тишин|${L}тих(?:о|ий|ая|ое)${E}`), nom: "тишина", k: 1 },
  { re: /устал/, nom: "усталость", k: 1 },
  { re: /скук|скучн/, nom: "скука", k: 1 },
  { re: /ностальг/, nom: "ностальгия", k: 1 },
  { re: new RegExp(`${L}смех|${L}смеял|${L}хохот`), nom: "смех", k: 1 },

  { re: /какао/, nom: "какао", k: 2 },
  { re: new RegExp(`${L}кофе${E}`), nom: "кофе", k: 2 },
  { re: new RegExp(`${L}ча(?:й|е|ю|я|ем)${E}`), nom: "чай", k: 2 },
  { re: /концерт/, nom: "концерт", k: 2 },
  { re: /фестивал/, nom: "фестиваль", k: 2 },
  { re: /вечеринк|тусовк/, nom: "вечеринка", k: 2 },
  { re: /пикник/, nom: "пикник", k: 2 },
  { re: new RegExp(`${L}ужин`), nom: "ужин", k: 2 },
  { re: new RegExp(`фильм|${L}кино${E}`), nom: "кино", k: 2 },
  { re: new RegExp(`${L}книг|${L}читал`), nom: "книга", k: 2 },
  { re: /костр/, nom: "костёр", k: 2 },
  { re: /танц/, nom: "танцы", k: 2 },
  { re: /музык/, nom: "музыка", k: 2 },
  { re: new RegExp(`${L}гуля|${L}прогул`), nom: "прогулка", k: 2 },
];

const PEOPLE = new RegExp(
  `${L}со?\\s+(девушк(?:ой|ами)|парн(?:ем|ями)|друз(?:ьями|ей)|друг(?:ом|ами)|подруг(?:ой|ами)|семь(?:ёй|ей|ями)|мам(?:ой|ами)|пап(?:ой|ами)|брат(?:ом|ьями)|сестр(?:ой|ами)|родител(?:ями)|бабушк(?:ой|ами)|дедушк(?:ой|ами)|коллег(?:ами|ой)|собак(?:ой|ами))${E}`,
);

const DEADLINE = /дедлайн|сдач[аиеу]|срочн/;

function explicitSeason(t: string): Season | null {
  if (new RegExp(`${L}осен|листь|листопад`).test(t)) return "autumn";
  if (/зим|снег|снеж|мороз|метел/.test(t)) return "winter";
  if (/весн|подснежн|капел/.test(t)) return "spring";
  if (new RegExp(`${L}лет(?:о|ом|а|у|ний|няя|нее)${E}|жарк`).test(t)) return "summer";
  return null;
}

function explicitTod(t: string): TimeOfDay | null {
  if (/ноч/.test(t)) return "night";
  if (/вечер/.test(t)) return "evening";
  if (new RegExp(`${L}утр(?:о|а|у|ом|ам)?${E}|рассвет`).test(t)) return "morning";
  return null;
}

/**
 * Локальное название без LLM. Собирается из словарей мест и образов дня (погода, состояние, предмет)
 * с сохранением предлогов и согласованием прилагательных.
 * «Гуляли по парку… жёлтых листьях… какао» → «Осенний парк и какао»,
 * «срочная сдача… ночь в офисе» → «Ночь в офисе перед сдачей»,
 * «дождь, одиночество, грусть, чай» → «Дождь, одиночество и чай».
 */
function heuristicTitle(text: string): string {
  const t = text.toLowerCase();
  const place = PLACES.find((p) => p.re.test(t));
  const people = t.match(PEOPLE)?.[1];
  const season = explicitSeason(t);
  const tod = explicitTod(t);
  const todW = tod ? TOD_WORDS[tod] : null;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const adjFor = (g: Gender) => (season ? SEASON_ADJ[season][GI[g]] : "");
  const ok = (s: string) => {
    const n = words(s);
    return n >= 3 && n <= 7 ? cap(s.replace(/\s+/g, " ").trim()) : null;
  };

  // по одному образу каждого вида: погода → состояние → предмет
  const nouns: string[] = [];
  for (const k of [0, 1, 2] as const) {
    const n = NOUNS.find((x) => x.k === k && x.re.test(t));
    if (n) nouns.push(n.nom);
  }
  const joined =
    nouns.length >= 3 ? `${nouns[0]}, ${nouns[1]} и ${nouns[2]}` : nouns.length === 2 ? `${nouns[0]} и ${nouns[1]}` : "";

  let out: string | null = null;

  if (DEADLINE.test(t)) {
    const head = todW ? cap(todW.nom) : "День";
    out = ok(place ? `${head} в ${place.prep} перед сдачей` : `${head} перед сдачей`);
  }

  if (!out && place) {
    const head = `${adjFor(place.g)} ${place.nom}`.trim();
    const tail = nouns[0] ? ` и ${nouns[nouns.length - 1]}` : people ? ` с ${people}` : todW ? ` ${todW.adv}` : "";
    out = ok(head + tail) ?? ok(`${head} ${todW?.adv ?? "днём"}`);
  }

  if (!out && joined) out = ok(joined);

  // «день» без прилагательного — пустое слово, как главный образ не берём
  if (!out && todW && !(tod === "day" && !season)) {
    const head = `${adjFor(todW.g)} ${todW.nom}`.trim();
    const tail = nouns[0] ? ` и ${nouns[0]}` : people ? ` с ${people}` : "";
    out = ok(head + tail) ?? ok(`Один ${head}`);
  }

  if (!out && nouns[0]) out = ok(`${cap(nouns[0])} одного дня`);

  return out ?? "Один день из дневника";
}

async function makeTitle(text: string, date: unknown): Promise<{ title: string; source: "llm" | "heuristic" }> {
  const user = `${typeof date === "string" ? `Дата: ${date}\n\n` : ""}${text.slice(0, 4000)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const j = await askJson(TITLE_SYSTEM, user, { temperature: 0.5, maxTokens: 60 });
    if (!j) break; // провайдер недоступен, повтор не поможет: askJson уже пробовал все модели
    const title = cleanTitle(j.title);
    if (title) return { title, source: "llm" };
  }
  return { title: heuristicTitle(text), source: "heuristic" };
}

async function makeMood(text: string, date: unknown) {
  const user = `${typeof date === "string" ? `Дата: ${date}\n\n` : ""}${text.slice(0, 4000)}`;
  const j = await askJson(MOOD_SYSTEM, user, { temperature: 0.3, maxTokens: 300 });
  if (j && j.textMood && j.context) return { ...j, fallback: false };
  return fallbackMood(text, date);
}

export async function POST(req: Request) {
  const { text, date } = await req.json();
  if (typeof text !== "string" || text.trim().length < 5)
    return NextResponse.json({ error: "text required" }, { status: 400 });

  // Настроение и название спрашиваем отдельно и параллельно: неудача с названием
  // больше не выбрасывает настроение, и наоборот.
  const [out, t] = await Promise.all([makeMood(text, date), makeTitle(text, date)]);

  // Ось «энергия текста» считается ещё и по лексике (восклицания, «прыгали», «орали», «громко», «дедлайн»).
  // Без LLM она единственный источник; с LLM — решающий голос, если лексика однозначна.
  const lex = textEnergy(text);
  const llmA = clamp(out.textMood.arousal);
  const arousal = out.fallback
    ? lex.energy
    : Math.abs(lex.energy - 0.5) >= 0.2
      ? 0.35 * llmA + 0.65 * lex.energy
      : 0.7 * llmA + 0.3 * lex.energy;

  return NextResponse.json({
    textMood: {
      valence: clamp(out.textMood.valence),
      arousal: clamp(arousal),
      warmth: clamp(out.textMood.warmth),
    },
    context: {
      timeOfDay: TOD.includes(out.context.timeOfDay) ? out.context.timeOfDay : "day",
      season: SEASON.includes(out.context.season) ? out.context.season : seasonOfMonth(monthOf(date)),
      people: arr(out.context.people),
      places: arr(out.context.places),
      keywords: arr(out.context.keywords),
    },
    title: t.title,
    titleSource: t.source,
    energyHits: lex.hits,
  });
}
