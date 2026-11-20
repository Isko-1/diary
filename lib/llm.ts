/**
 * Запрос к LLM для анализа текста.
 * Поддерживает как OpenAI / OpenRouter (OPENAI_API_KEY), так и Anthropic (ANTHROPIC_API_KEY).
 * Работает строго на сервере (ключи не передаются в браузер).
 */
export async function askJson(system: string, user: string): Promise<any | null> {
  // 1. Проверяем OpenAI / OpenRouter
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && openAiKey !== "секрет") {
    try {
      const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
      // Если указано несколько моделей через запятую — берём первую
      const rawModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const model = rawModel.split(",")[0].trim();

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
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (r.ok) {
        const j = await r.json();
        const content: string = j?.choices?.[0]?.message?.content ?? "";
        const m = content.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
      }
    } catch {}
  }

  // 2. Проверяем Anthropic (Claude)
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
          max_tokens: 700,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (r.ok) {
        const j = await r.json();
        const text: string = j?.content?.[0]?.text ?? "";
        const m = text.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
      }
    } catch {}
  }

  // Если ключ не задан или запрос упал — вернётся null,
  // и сработает встроенный локальный эвристический анализ.
  return null;
}
