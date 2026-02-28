export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { prompt = "", size = "1024x1024" } = req.body || {};
    if (!prompt.trim()) return res.status(400).json({ error: "Missing prompt" });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI error",
        raw: data,
      });
    }

    const url = data?.data?.[0]?.url;
    if (!url) return res.status(500).json({ error: "No image URL returned", raw: data });

    return res.status(200).json({ url });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
