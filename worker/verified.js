import baseWorker from "./index.js";

const DECLINE_TEXT = "I couldn’t verify enough reliable information to answer that confidently. I’d rather say I don’t know than make up details. Try rephrasing the question or ask me to check a more specific fact.";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      const response = await baseWorker.fetch(request, env, ctx);
      if (!response.ok) return response;
      try {
        const data = await response.json();
        return jsonWithHeaders({
          ...data,
          verificationGate: true,
          verificationPolicy: "verify-or-decline",
          factualAnswerPasses: 2
        }, 200, response.headers);
      } catch {
        return response;
      }
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return baseWorker.fetch(request, env, ctx);
    }

    let rawBody = "";
    let body = {};
    try {
      rawBody = await request.text();
      body = JSON.parse(rawBody || "{}");
    } catch {
      return baseWorker.fetch(new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: rawBody || undefined
      }), env, ctx);
    }

    const draftRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: rawBody
    });
    const draftResponse = await baseWorker.fetch(draftRequest, env, ctx);
    if (!draftResponse.ok) return draftResponse;

    let draft;
    try { draft = await draftResponse.json(); }
    catch { return draftResponse; }

    const lastUser = lastUserMessage(body.messages);
    if (!lastUser || !needsVerification(lastUser)) {
      return jsonWithHeaders({ ...draft, verified: false, verification: "not-required" }, 200, draftResponse.headers);
    }

    const auditPrompt = buildAuditPrompt(lastUser, String(draft?.text || ""));
    const auditBody = JSON.stringify({
      mode: body.mode === "public" ? "public" : "private",
      messages: [{ role: "user", content: auditPrompt }]
    });

    const auditRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: auditBody
    });

    let auditResponse;
    try {
      auditResponse = await baseWorker.fetch(auditRequest, env, ctx);
    } catch {
      return decline(draft, draftResponse.headers, "verification-call-failed");
    }

    if (!auditResponse.ok) {
      return decline(draft, draftResponse.headers, "verification-unavailable");
    }

    let audit;
    try { audit = await auditResponse.json(); }
    catch { return decline(draft, draftResponse.headers, "verification-invalid"); }

    const checked = parseAudit(String(audit?.text || ""));
    if (!checked.verified || !checked.answer) {
      return decline({ ...draft, provider: audit?.provider || draft?.provider }, draftResponse.headers, "unverified");
    }

    return jsonWithHeaders({
      ...draft,
      text: checked.answer,
      provider: audit?.provider || draft?.provider,
      model: audit?.model || draft?.model,
      verified: true,
      verification: "double-pass",
      draftProvider: draft?.provider || null,
      draftModel: draft?.model || null
    }, 200, draftResponse.headers);
  }
};

function lastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return String(messages[i]?.content || "").trim();
  }
  return "";
}

function needsVerification(text) {
  const q = String(text || "").trim();
  if (!q) return false;

  // Pure writing/creative transformations do not need factual auditing unless they explicitly ask for facts.
  if (/^(write|rewrite|rephrase|proofread|draft|translate|shorten|polish|make this|create a poem|write a story|write an email|write a message)\b/i.test(q) &&
      !/\b(fact|factual|research|accurate|history|science|health|medical|current|latest|source)\b/i.test(q)) return false;

  if (/^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening)[.! ]*$/i.test(q)) return false;
  if (/^[\d\s+\-*/().%=]+$/.test(q)) return false;

  return /\?|\b(tell me|what|who|when|where|why|how|which|is|are|was|were|does|do|did|can|could|should|compare|difference|explain|teach|learn|history|origin|food|nutrition|ingredient|science|research|study|evidence|health|medical|medicine|stock|share|company|brand|product|news|current|latest|today|law|rule|travel|country|city|person|president|ceo|price|cost|recommend|best)\b/i.test(q);
}

function buildAuditPrompt(question, draft) {
  return [
    "FACT VERIFICATION AUDIT.",
    "You are the second-pass verifier for Jarvis. Do not trust the draft merely because another model produced it.",
    "Independently use Jarvis's available research retrieval for the original question.",
    "Check every material factual claim, date, number, named event, causal claim, health/science claim, current fact and source in the draft.",
    "If a claim is unsupported, stale, contradicted, overly precise, or cannot be verified from reliable retrieved evidence, remove or correct it.",
    "Do not fill gaps from imagination or uncertain model memory.",
    "For historical or disputed topics, preserve uncertainty and competing interpretations where the evidence requires it.",
    "For current/freshness-sensitive questions, if current evidence is unavailable, do not substitute old knowledge.",
    "For health/science, do not turn a study title into a conclusion and do not overstate causality.",
    "If enough reliable evidence remains to answer the core question, output exactly this first line: VERIFIED",
    "Then provide the complete corrected final answer for the user, including only claims you are willing to stand behind.",
    "If the core answer cannot be reliably verified, output exactly this first line: UNVERIFIED",
    "Then give one short sentence explaining what could not be verified. Do not provide the unsupported draft.",
    "Do not output any other status word before the first line.",
    "",
    `ORIGINAL QUESTION:\n${question}`,
    "",
    `DRAFT TO AUDIT:\n${draft}`
  ].join("\n");
}

function parseAudit(text) {
  const clean = String(text || "").trim();
  if (!clean) return { verified: false, answer: "" };
  const lines = clean.split(/\r?\n/);
  const status = (lines.shift() || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (status !== "VERIFIED") return { verified: false, answer: "" };
  const answer = lines.join("\n").trim();
  if (!answer || /^UNVERIFIED\b/i.test(answer)) return { verified: false, answer: "" };
  return { verified: true, answer };
}

function decline(draft, headers, reason) {
  return jsonWithHeaders({
    ...draft,
    text: DECLINE_TEXT,
    verified: false,
    verification: reason
  }, 200, headers);
}

function jsonWithHeaders(data, status, sourceHeaders) {
  const headers = new Headers(sourceHeaders || {});
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers });
}
