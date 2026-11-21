/**
 * Запрос к LLM, ответ — JSON-объект.
 * Поддерживает OpenAI / OpenRouter (OPENAI_API_KEY) и Anthropic (ANTHROPIC_API_KEY).
 * Работает строго на сервере (ключи не уходят в браузер).
 *
 * Если в OPENAI_MODEL указано несколько моделей через запятую, они пробуются по очереди:
 * у бесплатных (:free) моделей OpenRouter частые 429 и таймауты, и одна первая модель
 * раньше молча роняла весь анализ в эвристику. Причины сбоев теперь пишутся в лог сервера.
 */
type Opts = { temperature?: number; maxTokens?: number };

const parseJson = (text: string) => {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
};

export async function askJson(system: string, user: string, opts: Opts = {}): Promise<any | null> {
  const { temperature = 0.7, maxTokens = 700 } = opts;

  // 1. OpenAI / OpenRouter
  const openAiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (openAiKey && openAiKey !== "секрет") {
    let baseUrl = process.env.OPENAI_BASE_URL;
    if (!baseUrl && (process.env.OPENROUTER_API_KEY || openAiKey.startsWith("sk-or-"))) {
      baseUrl = "https://openrouter.ai/api/v1";
    } else if (!baseUrl) {
      baseUrl = "https://api.openai.com/v1";
    }
    baseUrl = baseUrl.replace(/\/+$/, "");
    const models = (process.env.OPENAI_MODEL || (baseUrl.includes("openrouter") ? "openai/gpt-4o-mini,meta-llama/llama-3.3-70b-instruct" : "gpt-4o-mini"))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const model of models) {
      try {
        const r = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Genesis Diary",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) {
          console.warn(`[llm] ${model}: HTTP ${r.status}`);
          continue;
        }
        const j = await r.json();
        const out = parseJson(j?.choices?.[0]?.message?.content ?? "");
        if (out) return out;
        console.warn(`[llm] ${model}: ответ без JSON`);
      } catch (e: any) {
        console.warn(`[llm] ${model}: ${e?.name ?? "error"} ${e?.message ?? ""}`);
      }
    }
  }

  // 2. Google Gemini API (GEMINI_API_KEY)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== "секрет") {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (r.ok) {
        const j = await r.json();
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const out = parseJson(text);
        if (out) return out;
      }
    } catch (e: any) {
      console.warn(`[llm] gemini: ${e?.name ?? "error"} ${e?.message ?? ""}`);
    }
  }

  // 2. Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey !== "секрет") {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022",
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (r.ok) {
        const j = await r.json();
        const out = parseJson(j?.content?.[0]?.text ?? "");
        if (out) return out;
        console.warn("[llm] anthropic: ответ без JSON");
      } else {
        console.warn(`[llm] anthropic: HTTP ${r.status}`);
      }
    } catch (e: any) {
      console.warn(`[llm] anthropic: ${e?.name ?? "error"} ${e?.message ?? ""}`);
    }
  }

  // Ключа нет или все запросы упали — вызывающий код использует локальную эвристику.
  return null;
}
