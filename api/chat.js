export default async function handler(req, res) {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    // Vercel sometimes gives body as object, sometimes string
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    // Bob Chat sends: message, personalization, conversation, files:[{text,...}]
    const message = String(body.message || "");
    const system = String(body.system || body.personalization || "");
    const conversation = Array.isArray(body.conversation) ? body.conversation : [];
    const files = Array.isArray(body.files) ? body.files : [];

    const filesText = files
      .map(f => (f && typeof f.text === "string" ? f.text : ""))
      .filter(Boolean)
      .join("\n\n---\n\n")
      .slice(0, 120000);

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const input = [
      system ? { role: "system", content: system } : null,
      filesText
        ? { role: "user", content: `Uploaded file text:\n\n${filesText}` }
        : null,
      // keep some history if provided
      ...conversation.slice(-12).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "")
      })),
      { role: "user", content: message }
    ].filter(Boolean);

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input
      })
    });

    const data = await r.json();

    // ✅ If OpenAI fails, return the real error (so Bob Chat shows it)
    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI request failed",
        raw: data
      });
    }

    const reply =
      data?.output?.[0]?.content?.find(c => c.type === "output_text")?.text ||
      data?.output_text;

    if (!reply) {
      return res.status(500).json({ error: "No reply returned by model", raw: data });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
