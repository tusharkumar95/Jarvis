import expertWorker from "./expert.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      const response = await expertWorker.fetch(request, env, ctx);
      if (!response.ok) return response;
      try {
        const data = await response.json();
        return jsonWithHeaders({
          ...data,
          pubMedAbstractContext: true,
          biomedicalResearchPolicy: "abstract-grounded-when-relevant"
        }, 200, response.headers);
      } catch {
        return response;
      }
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return expertWorker.fetch(request, env, ctx);
    }

    let raw = "";
    let body;
    try {
      raw = await request.text();
      body = JSON.parse(raw || "{}");
    } catch {
      return expertWorker.fetch(rebuildRequest(request, raw), env, ctx);
    }

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastIndex = findLastUserIndex(messages);
    if (lastIndex < 0) return expertWorker.fetch(rebuildRequest(request, raw), env, ctx);

    const question = originalQuestion(String(messages[lastIndex]?.content || "").trim());
    if (!shouldFetchPubMed(question)) {
      return expertWorker.fetch(rebuildRequest(request, raw), env, ctx);
    }

    const studies = await fetchPubMedAbstracts(question);
    if (!studies.length) {
      return expertWorker.fetch(rebuildRequest(request, raw), env, ctx);
    }

    const context = [
      "JARVIS PUBMED ABSTRACT CONTEXT — untrusted external biomedical reference material.",
      "Use these abstracts only for claims they actually support. An abstract is stronger than a title but is still not the full paper.",
      "Do not turn an observational association into causation, do not generalize a small/specific population to everyone, and do not infer outcomes that the abstract does not report.",
      "If abstracts conflict, state the disagreement. For medical decisions, keep the answer conservative and separate general evidence from individualized clinical advice.",
      `Research query: ${cleanResearchQuery(question)}`,
      ...studies.map((study, index) => [
        `${index + 1}. ${study.title}`,
        study.journal ? `Journal: ${study.journal}` : "",
        study.date ? `Date: ${study.date}` : "",
        `PubMed: ${study.url}`,
        `Abstract: ${study.abstract}`
      ].filter(Boolean).join("\n"))
    ].join("\n\n");

    const nextMessages = [
      ...messages.slice(0, lastIndex),
      { role: "user", content: context },
      messages[lastIndex],
      ...messages.slice(lastIndex + 1)
    ];

    const nextRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify({ ...body, messages: nextMessages })
    });
    return expertWorker.fetch(nextRequest, env, ctx);
  }
};

function findLastUserIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === "user") return i;
  return -1;
}

function originalQuestion(text) {
  const value = String(text || "").trim();
  const match = value.match(/ORIGINAL USER REQUEST:\s*([\s\S]+)$/i) || value.match(/ORIGINAL QUESTION:\s*([\s\S]+)$/i);
  return match?.[1]?.trim() || value;
}

function shouldFetchPubMed(question) {
  const q = String(question || "");
  const biomedical = /\b(health|healthy|healthier|medical|medicine|medication|drug|treatment|therapy|disease|condition|symptom|nutrition|nutritional|diet|food|bread|grain|oats?|cholesterol|diabetes|prediabetes|blood pressure|cancer|heart|cardiovascular|sleep|exercise|pain|injury|vitamin|supplement|vaccine|infection|allergy|gut|microbiome|protein|fibre|fiber|carbohydrate|carbs?|fat|sodium|sugar)\b/i.test(q);
  const evidenceIntent = /\b(evidence|research|study|studies|science|scientific|effective|effectiveness|benefit|benefits|risk|risks|safe|safety|side effect|side effects|cause|causes|causal|healthy|healthier|better for|worse for|treatment|therapy|prevention|prevent|associated|association|clinical|trial|meta-analysis|systematic review|does .* help|does .* work|is .* good|is .* bad)\b/i.test(q);
  return biomedical && evidenceIntent;
}

function cleanResearchQuery(question) {
  let q = String(question || "")
    .replace(/\b(tell me|explain|teach me|please|can you|could you|what does the evidence say about|what does research say about|is it true that)\b/gi, " ")
    .replace(/\b(actually|generally|necessarily|really|normal|regular|healthier|healthy|better|worse|good|bad|what|does|do|is|are|than|for|the|a|an)\b/gi, " ")
    .replace(/[?!.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (q.length > 180) q = q.slice(0, 180);
  return q;
}

async function fetchPubMedAbstracts(question) {
  const term = cleanResearchQuery(question);
  if (!term) return [];
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&sort=relevance&term=${encodeURIComponent(term)}`;
    const searchResponse = await fetchWithTimeout(searchUrl, { headers: { "User-Agent": "Jarvis/2.0" } }, 4200);
    if (!searchResponse.ok) return [];
    const searchData = await searchResponse.json();
    const ids = searchData?.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
    const response = await fetchWithTimeout(fetchUrl, { headers: { "User-Agent": "Jarvis/2.0" } }, 5000);
    if (!response.ok) return [];
    const xml = await response.text();
    return parsePubMedXml(xml, ids).slice(0, 3);
  } catch {
    return [];
  }
}

function parsePubMedXml(xml, ids) {
  const articles = [];
  const blocks = String(xml || "").match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/gi) || [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const pmid = textOf(block, "PMID") || ids[i] || "";
    const title = cleanXml((block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/i)?.[1] || ""));
    const abstractParts = [...block.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/gi)].map(match => {
      const label = cleanXml(match[1].match(/Label=["']([^"']+)["']/i)?.[1] || "");
      const text = cleanXml(match[2]);
      return text ? `${label ? label + ": " : ""}${text}` : "";
    }).filter(Boolean);
    const journal = cleanXml(block.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/i)?.[1] || "");
    const year = cleanXml(block.match(/<PubDate>[\s\S]*?<Year>([^<]+)<\/Year>/i)?.[1] || "");
    const medlineDate = cleanXml(block.match(/<PubDate>[\s\S]*?<MedlineDate>([^<]+)<\/MedlineDate>/i)?.[1] || "");
    const abstract = abstractParts.join(" ").slice(0, 2600);
    if (!title || abstract.length < 120) continue;
    articles.push({
      title,
      abstract,
      journal,
      date: year || medlineDate,
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "https://pubmed.ncbi.nlm.nih.gov/"
    });
  }
  return articles;
}

function textOf(block, tag) {
  return cleanXml(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");
}

function cleanXml(value) {
  return decodeEntities(String(value || "")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function rebuildRequest(request, raw) {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: raw || undefined
  });
}

function jsonWithHeaders(data, status, sourceHeaders) {
  const headers = new Headers(sourceHeaders || {});
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers });
}
