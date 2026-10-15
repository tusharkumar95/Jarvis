import researchWorker from "./research-plus.js";

const BUILD = "lab-app-builder-v1";
const ALLOWED_ORIGINS = new Set([
  "https://tusharkumar95.github.io",
  "http://localhost:8788",
  "http://127.0.0.1:8788"
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      const response = await researchWorker.fetch(request, env, ctx);
      if (!response.ok) return response;
      try {
        const data = await response.json();
        return jsonWithHeaders({ ...data, labAppBuilder:true, labAppBuilderBuild:BUILD }, 200, response.headers);
      } catch { return response; }
    }

    if (url.pathname !== "/build-app" || request.method !== "POST") {
      return researchWorker.fetch(request, env, ctx);
    }

    let body = {};
    try { body = await request.json(); }
    catch { return json({ error:"Invalid JSON body" }, 400, request); }

    const prompt = String(body?.prompt || "").trim().slice(0, 14000);
    if (!prompt) return json({ error:"Describe the app you want to build." }, 400, request);

    const current = normalizeCurrent(body?.current);
    const system = [
      "You are Jarvis Lab, an expert product engineer building runnable personal web apps.",
      "Return ONLY one valid JSON object. No markdown fences and no prose outside JSON.",
      "The JSON schema is: {\"name\":string,\"description\":string,\"html\":string,\"css\":string,\"js\":string,\"notes\":string}.",
      "Build a polished mobile-first single-page app that runs inside a sandboxed browser iframe using the supplied HTML, CSS and vanilla JavaScript.",
      "Make the requested core interaction genuinely work whenever it can be implemented client-side. A Tetris request should produce a playable Tetris game, not a mockup.",
      "Avoid build tools and package installation. Prefer no external dependencies. If a CDN is truly useful, use a stable HTTPS CDN and keep the app functional without secrets.",
      "Never embed API keys, passwords or private credentials.",
      "When the request implies servers, accounts, payments, databases, push notifications or real-time multi-user features, build the strongest useful local/front-end prototype possible and state the missing production backend requirements in notes.",
      "For security-sensitive apps such as encrypted messengers, do not falsely claim production security. A front-end prototype must clearly be described as a prototype unless production-grade key management, identity verification, audited cryptography and a secure backend actually exist.",
      "If the user asks to clone, reverse engineer or recreate a proprietary product, independently implement similar publicly observable workflows and product ideas. Do not claim access to proprietary source code and do not copy proprietary branding, text, artwork or assets.",
      "Do not output tracking, ads, analytics or unnecessary network calls.",
      "Use accessible controls, touch-friendly sizing and responsive layout.",
      current ? "This is a REVISION. Preserve working features unless the user's new instruction asks to change them. Return the complete replacement app, not a patch." : "This is a NEW BUILD. Choose sensible defaults without asking follow-up questions.",
      "JSON strings must be valid JSON-escaped strings. The html field should contain body markup only, not another complete HTML document."
    ].join(" ");

    const user = [
      current ? `CURRENT APP:\n${JSON.stringify(current)}` : "",
      `USER REQUEST:\n${prompt}`
    ].filter(Boolean).join("\n\n");

    try {
      const result = await callProvider(system, user, env);
      const app = parseApp(result.text);
      if (!app) return json({ error:"The builder returned invalid app code. Try the build again.", provider:result.provider }, 502, request);
      return json({ ok:true, app, provider:result.provider, model:result.model, build:BUILD }, 200, request);
    } catch (error) {
      return json({ error:String(error?.message || error).slice(0,400) || "No free builder model is available right now." }, 503, request);
    }
  }
};

function normalizeCurrent(value) {
  if (!value || typeof value !== "object") return null;
  const html = String(value.html || "").slice(0, 24000);
  const css = String(value.css || "").slice(0, 18000);
  const js = String(value.js || "").slice(0, 26000);
  if (!html && !css && !js) return null;
  return {
    name:String(value.name || "Current App").slice(0,120),
    description:String(value.description || "").slice(0,500),
    html, css, js,
    notes:String(value.notes || "").slice(0,1200)
  };
}

async function callProvider(system, user, env) {
  const errors = [];
  if (env.GROQ_API_KEY) {
    try {
      const model = env.GROQ_MODEL || "openai/gpt-oss-120b";
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST",
        headers:{ Authorization:"Bearer " + env.GROQ_API_KEY, "Content-Type":"application/json" },
        body:JSON.stringify({ model, messages:[{role:"system",content:system},{role:"user",content:user}], max_completion_tokens:6200, temperature:0.2, response_format:{type:"json_object"} })
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(`Groq ${response.status}`);
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Groq returned an empty build");
      return { provider:"groq", model, text };
    } catch (error) { errors.push(String(error?.message || error)); }
  }

  if (env.OPENROUTER_API_KEY) {
    try {
      const model = "openrouter/free";
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method:"POST",
        headers:{ Authorization:"Bearer " + env.OPENROUTER_API_KEY, "Content-Type":"application/json", "HTTP-Referer":"https://tusharkumar95.github.io/Jarvis/", "X-Title":"Jarvis Lab" },
        body:JSON.stringify({ model, messages:[{role:"system",content:system},{role:"user",content:user}], max_tokens:6200, temperature:0.2, provider:{zdr:true,data_collection:"deny"} })
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("OpenRouter returned an empty build");
      return { provider:"openrouter", model, text };
    } catch (error) { errors.push(String(error?.message || error)); }
  }

  if (env.ALLOW_GEMINI_FREE === "true" && env.GEMINI_API_KEY) {
    try {
      const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ systemInstruction:{parts:[{text:system}]}, contents:[{role:"user",parts:[{text:user}]}], generationConfig:{maxOutputTokens:6200,temperature:0.2,responseMimeType:"application/json"} })
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(`Gemini ${response.status}`);
      const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
      if (!text) throw new Error("Gemini returned an empty build");
      return { provider:"gemini", model, text };
    } catch (error) { errors.push(String(error?.message || error)); }
  }

  throw new Error(errors.join("; ") || "No free builder model is available");
}

function parseApp(text) {
  let value = String(text || "").trim();
  value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(value.slice(start, end + 1));
    const app = {
      name:String(data?.name || "New App").trim().slice(0,120),
      description:String(data?.description || "").trim().slice(0,600),
      html:String(data?.html || ""),
      css:String(data?.css || ""),
      js:String(data?.js || ""),
      notes:String(data?.notes || "").trim().slice(0,1800)
    };
    if (!app.html || app.html.length > 50000 || app.css.length > 40000 || app.js.length > 60000) return null;
    return app;
  } catch { return null; }
}

async function parseJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { return { raw:text.slice(0,500) }; }
}

function cors(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://tusharkumar95.github.io",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary":"Origin"
  };
}

function jsonWithHeaders(data, status, sourceHeaders) {
  const headers = new Headers(sourceHeaders || {});
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers });
}

function json(data, status=200, request=null) {
  const headers = new Headers({"Content-Type":"application/json"});
  if (request) Object.entries(cors(request)).forEach(([key,value]) => headers.set(key,value));
  return new Response(JSON.stringify(data), { status, headers });
}
