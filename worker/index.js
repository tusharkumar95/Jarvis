const ALLOWED_ORIGINS = new Set([
  "https://tusharkumar95.github.io",
  "http://localhost:8788",
  "http://127.0.0.1:8788"
]);

const SYSTEM = "You are Jarvis, a concise personal AI assistant. Be practical, clear and useful. Never claim an action was completed unless it actually was.";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://tusharkumar95.github.io",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({
        ok: true,
        freeOnly: true,
        privacyDefault: "private",
        providers: {
          groq: Boolean(env.GROQ_API_KEY),
          openrouter: Boolean(env.OPENROUTER_API_KEY),
          gemini: Boolean(env.GEMINI_API_KEY) && env.ALLOW_GEMINI_FREE === "true"
        }
      }, 200, cors);
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, cors);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON" }, 400, cors); }

    const messages = normalizeMessages(body.messages);
    if (!messages.length) return json({ error: "Message required" }, 400, cors);

    const errors = [];
    const mode = body.mode === "public" ? "public" : "private";

    // Privacy-first routing. Private mode never uses Gemini Free.
    if (env.GROQ_API_KEY) {
      try {
        const result = await callGroq(messages, env);
        return json({ ...result, mode, freeOnly: true }, 200, cors);
      } catch (e) { errors.push({ provider: "groq", error: safeError(e) }); }
    }

    if (env.OPENROUTER_API_KEY) {
      try {
        const result = await callOpenRouter(messages, env);
        return json({ ...result, mode, freeOnly: true }, 200, cors);
      } catch (e) { errors.push({ provider: "openrouter", error: safeError(e) }); }
    }

    // Gemini Free is opt-in for public/general questions only.
    if (mode === "public" && env.ALLOW_GEMINI_FREE === "true" && env.GEMINI_API_KEY) {
      try {
        const result = await callGemini(messages, env);
        return json({ ...result, mode, freeOnly: true }, 200, cors);
      } catch (e) { errors.push({ provider: "gemini", error: safeError(e) }); }
    }

    return json({
      error: "No free provider succeeded.",
      detail: errors,
      freeOnly: true
    }, 503, cors);
  }
};

function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(-12).map(m => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content || "").slice(0, 12000)
  })).filter(m => m.content.trim());
}

async function callGemini(messages, env) {
  const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
      })
    }
  );
  const data = await parse(r);
  if (!r.ok) throw new Error("Gemini " + r.status + ": " + JSON.stringify(data).slice(0, 300));
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned no text");
  return { provider: "gemini", model, text };
}

async function callGroq(messages, env) {
  const model = env.GROQ_MODEL || "openai/gpt-oss-120b";
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.GROQ_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      max_completion_tokens: 1200,
      temperature: 0.7
    })
  });
  const data = await parse(r);
  if (!r.ok) throw new Error("Groq " + r.status + ": " + JSON.stringify(data).slice(0, 300));
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned no text");
  return { provider: "groq", model, text };
}

async function callOpenRouter(messages, env) {
  const model = "openrouter/free";
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://tusharkumar95.github.io/Jarvis/",
      "X-Title": "Jarvis"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      max_tokens: 1200,
      temperature: 0.7,
      provider: { zdr: true }
    })
  });
  const data = await parse(r);
  if (!r.ok) throw new Error("OpenRouter " + r.status + ": " + JSON.stringify(data).slice(0, 300));
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned no text");
  return { provider: "openrouter", model, text };
}

async function parse(r) {
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 500) }; }
}
function safeError(e) { return String(e?.message || e).slice(0, 400); }
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}