/** Только на сервере: ключ не попадает в браузер. */
export async function askJson(system: string, user: string): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text: string = j?.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}
