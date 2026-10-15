import baseWorker from "./index.js";
import { inspectWebsite } from "./library-inspect.js";

const DECLINE_TEXT = "I couldn’t verify enough reliable information to answer that confidently. I’d rather say I don’t know than make up details. Try rephrasing the question or ask me to check a more specific fact.";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/inspect-url" && request.method === "POST") {
      return inspectWebsite(request, env, ctx);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      const response = await baseWorker.fetch(request, env, ctx);
      if (!response.ok) return response;
      try {
        const data = await response.json();
        return jsonWithHeaders({
          ...data,
          verificationGate: true,
          verificationPolicy: "verify-or-decline",
          factualAnswerPasses: 2,
          verificationResearchTarget: "original-question",
          verificationPreservesAppContext: true,
          websiteLibraryInspection: true
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
      return baseWorker.fetch(rebuildRequest(request, rawBody), env, ctx);
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

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = lastUserMessage(messages);
    if (!lastUser || !needsVerification(lastUser)) {
      return jsonWithHeaders({ ...draft, verified: false, verification: "not-required" }, 200, draftResponse.headers);
    }

    const researchQuestion = originalQuestionForResearch(lastUser);
    const priorContext = messages.slice(Math.max(0, messages.length - 7), Math.max(0, messages.length - 1));
    const specialistContext = String(lastUser).trim() !== String(researchQuestion).trim()
      ? lastUser
      : "";

    const auditMessages = [
      ...priorContext,
      ...(specialistContext ? [{ role: "user", content: specialistContext }] : []),
      { role: "assistant", content: `DRAFT TO AUDIT:\n${String(draft?.text || "")}` },
      { role: "user", content: buildAuditPacket(researchQuestion) }
    ];

    const auditBody = JSON.stringify({
      mode: body.mode === "public" ? "public" : "private",
      messages: auditMessages
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
      verification: "double-pass-original-question",
      draftProvider: draft?.provider || null,
      draftModel: draft?.model || null
    }, 200, draftResponse.headers);
  }
};

function rebuildRequest(request, raw) {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: raw || undefined
  });
}

function lastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return String(messages[i]?.content || "").trim();
  }
  return "";
}

function originalQuestionForResearch(text) {
  const value = String(text || "").trim();
  const markers = [
    /ORIGINAL USER REQUEST:\s*([\s\S]+)$/i,
    /ORIGINAL QUESTION:\s*([\s\S]+)$/i
  ];
  for (const pattern of markers) {
    const match = value.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim().slice(0, 14000);
  }
  return value.slice(0, 14000);
}

function needsVerification(text) {
  const q = String(text || "").trim();
  if (!q) return false;

  if (/^(write|rewrite|rephrase|proofread|draft|translate|shorten|polish|make this|create a poem|write a story|write an email|write a message)\b/i.test(q) &&
      !/\b(fact|factual|research|accurate|history|science|health|medical|current|latest|source)\b/i.test(q)) return false;

  if (/^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening)[.! ]*$/i.test(q)) return false;
  if (/^[\d\s+\-*/().%=]+$/.test(q)) return false;

  return /\?|\b(tell me|what|who|when|where|why|how|which|is|are|was|were|does|do|did|can|could|should|compare|difference|explain|teach|learn|history|origin|food|nutrition|ingredient|science|research|study|evidence|health|medical|medicine|stock|share|company|brand|product|news|current|latest|today|law|rule|travel|country|city|person|president|ceo|price|cost|recommend|best)\b/i.test(q);
}

function buildAuditPacket(researchQuestion) {
  return [
    researchQuestion,
    "",
    "JARVIS VERIFICATION CONTEXT",
    "FACT CHECK PASS.",
    "The text before this marker is the user's question and the subject to check.",
    "Audit the preceding draft against the retrieved evidence.",
    "Check material factual claims, dates, numbers, names, causal relationships and cited sources.",
    "Remove or correct anything unsupported, contradicted, overly precise or uncertain.",
    "Do not fill evidence gaps from model memory.",
    "When sources disagree, preserve the uncertainty.",
    "For time-sensitive facts, rely on dated evidence and do not substitute stale information.",
    "For empirical claims, do not infer causation beyond what the evidence supports.",
    "If enough evidence remains to answer the core question, output exactly this first line: VERIFIED",
    "Then provide the complete corrected answer.",
    "If the core question cannot be supported well enough, output exactly this first line: UNVERIFIED",
    "Then give one short sentence explaining what could not be established.",
    "Do not put anything before the status line."
  ].join("\n");
}

function parseAudit(text) {
  const clean = String(text || "").trim();
  if (!clean) return { verified: false, answer: "" };
  const lines = clean.split(/\r?\n/);
  const first = (lines.shift() || "").trim();
  const normalized = first.toUpperCase().replace(/[^A-Z]/g, "");
  if (normalized !== "VERIFIED") return { verified: false, answer: "" };
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
