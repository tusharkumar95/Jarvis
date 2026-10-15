(() => {
  const nativeFetch = window.fetch.bind(window);
  const LAB_KEY = "jarvis-lab-projects-v1";
  let brieflyStories = [];
  let brieflyMeta = {};

  async function refreshBriefly() {
    try {
      const response = await nativeFetch("../Briefly/data.json?jarvisContext=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      brieflyStories = Array.isArray(data?.stories) ? data.stories.slice(0, 10) : [];
      brieflyMeta = {
        updated: data?.updated || "",
        previousUpdated: data?.previousUpdated || "",
        engine: data?.engine || "",
        editor: data?.editor || "",
        changes: data?.changeSummary && typeof data.changeSummary === "object" ? data.changeSummary : {}
      };
      window.JarvisBriefly = {
        updated: brieflyMeta.updated,
        previousUpdated: brieflyMeta.previousUpdated,
        changes: { ...brieflyMeta.changes },
        stories: brieflyStories.map(story => ({ ...story }))
      };
    } catch {}
  }

  function labProjects() {
    try {
      const value = JSON.parse(localStorage.getItem(LAB_KEY) || "[]");
      return Array.isArray(value) ? value.slice(-8) : [];
    } catch {
      return [];
    }
  }

  function projectLine(project, index) {
    if (typeof project === "string") return `${index + 1}. ${project.slice(0, 300)}`;
    const parts = [project?.name, project?.title, project?.idea, project?.description, project?.status]
      .filter(Boolean)
      .map(value => String(value).trim())
      .filter(Boolean);
    if (parts.length) return `${index + 1}. ${parts.join(" — ").slice(0, 420)}`;
    try { return `${index + 1}. ${JSON.stringify(project).slice(0, 420)}`; }
    catch { return `${index + 1}. Saved Lab project`; }
  }

  function storyLine(story, index, includePrevious = false) {
    const title = String(story?.title || "Untitled").trim();
    const source = String(story?.source || "Briefly").trim();
    const category = String(story?.cat || story?.category || "News").trim();
    const summary = String(story?.summary || "").trim().slice(0, 520);
    const why = String(story?.why || "").trim().slice(0, 260);
    const sourceCount = Math.max(1, Number(story?.sourceCount || story?.sources?.length || 1));
    const score = Number(story?.importanceScore || 0);
    const trust = story?.verified === true ? "verified" : `source-backed/${String(story?.confidence || "unknown")}`;
    const lifecycle = String(story?.lifecycle || story?.status || "").trim();
    const changed = story?.changed === true;
    const change = String(story?.change || "").trim().slice(0, 220);
    const sourceQuality = String(story?.sourceQuality || "unknown").trim();
    const url = String(story?.url || story?.sources?.[0]?.url || "").trim();
    const previous = includePrevious && changed ? String(story?.previousSummary || "").trim().slice(0, 430) : "";
    const parts = [
      `${index + 1}. [${category}] ${title}`,
      `source: ${source}${sourceCount > 1 ? ` (${sourceCount} sources)` : ""}; source quality: ${sourceQuality}`,
      `trust: ${trust}${score ? `; importance ${score}` : ""}${lifecycle ? `; lifecycle ${lifecycle}` : ""}`,
      change ? `change note: ${change}` : "",
      summary ? `current summary: ${summary}` : "",
      previous ? `previous summary: ${previous}` : "",
      why ? `why it matters: ${why}` : "",
      url ? `primary source URL: ${url}` : ""
    ].filter(Boolean);
    return parts.join(" — ");
  }

  function looksMarketRelevant(story) {
    const text = [story?.title, story?.summary, story?.why, story?.cat].filter(Boolean).join(" ");
    return /\b(market|markets|stock|stocks|investment|investor|economy|economic|gdp|inflation|rate|rates|bank|trade|tariff|currency|rupee|loonie|oil|energy|earnings|revenue|profit|merger|acquisition|bankruptcy|regulation|chip|semiconductor|nvidia|ai|jobs|employment|housing|mortgage)\b/i.test(text);
  }

  function buildNewsSection(question) {
    const q = String(question || "");
    const wantsChanges = /\b(what changed|changed|change since|since (?:this )?(?:morning|afternoon|evening|earlier|last time)|overnight|new since|updates? since|anything new)\b/i.test(q);
    const wantsMarketImpact = /\b(invest|investment|investments|portfolio|market|markets|stock|stocks|etf|etfs|affect.*money|affect.*portfolio|market impact)\b/i.test(q);

    let stories = [...brieflyStories];
    if (wantsChanges) {
      const changedStories = stories.filter(story => story?.lifecycle === "New" || story?.changed === true);
      if (changedStories.length) stories = changedStories;
    }
    if (wantsMarketImpact) {
      const marketStories = stories.filter(looksMarketRelevant);
      if (marketStories.length) stories = marketStories;
    }

    stories.sort((a, b) => (Number(b?.importanceScore || 0) - Number(a?.importanceScore || 0)) || String(b?.publishedAt || "").localeCompare(String(a?.publishedAt || "")));

    const meta = [
      brieflyMeta.engine ? `engine=${brieflyMeta.engine}` : "",
      brieflyMeta.updated ? `current snapshot=${brieflyMeta.updated}` : "",
      brieflyMeta.previousUpdated ? `previous snapshot=${brieflyMeta.previousUpdated}` : "",
      brieflyMeta.editor ? `editor=${brieflyMeta.editor}` : "",
      brieflyMeta.changes && Object.keys(brieflyMeta.changes).length
        ? `change counts: new=${Number(brieflyMeta.changes.new || 0)}, materially updated=${Number(brieflyMeta.changes.updated || 0)}, continuing=${Number(brieflyMeta.changes.continuing || 0)}`
        : ""
    ].filter(Boolean).join("; ");

    if (!brieflyStories.length) return "Current Briefly feed: unavailable right now.";
    if (wantsChanges && !brieflyStories.some(story => story?.lifecycle === "New" || story?.changed === true)) {
      return `Briefly change check${meta ? ` (${meta})` : ""}: no material event changes are recorded between the current and previous snapshots.`;
    }

    const instruction = wantsChanges
      ? "The user is asking about changes. Compare CURRENT vs PREVIOUS only where a previous summary is supplied. Do not call a continuing event new. Prioritize material changes over re-listing unchanged headlines."
      : wantsMarketImpact
        ? "The user is asking about market/investment relevance. Rank practical transmission channels (rates, trade, sector/company exposure, risk sentiment) and clearly distinguish direct impact from possible indirect impact. Do not turn news into personalized buy/sell advice."
        : "Rank by practical significance rather than merely recency.";

    return [
      `Current Briefly intelligence feed${meta ? ` (${meta})` : ""}:`,
      instruction,
      stories.slice(0, 8).map((story, index) => storyLine(story, index, wantsChanges)).join("\n")
    ].join("\n");
  }

  function buildContext(question) {
    const sections = [];
    const q = String(question || "");

    const wantsProjects = /\b(project|projects|lab|app idea|app ideas|saved idea|saved ideas|my ideas|build idea|build ideas)\b/i.test(q);
    const wantsNews = /\b(briefly|news|headline|headlines|latest story|latest stories|news story|news stories|today.?s news|current news|what happened|overnight|what matters|important today|anything important|anything new|what changed|world today|canada today|india today|ai news|market news|economic news|affect.*investment|affect.*portfolio)\b/i.test(q);

    if (wantsProjects) {
      const projects = labProjects();
      sections.push(
        projects.length
          ? `Saved Lab projects on this device:\n${projects.map(projectLine).join("\n")}`
          : "Saved Lab projects on this device: none."
      );
    }

    if (wantsNews) sections.push(buildNewsSection(q));

    if (!sections.length) return "";
    return [
      "JARVIS APP CONTEXT (use only when relevant to the user's question; do not claim this context is broader than shown. Respect each story's verification/trust label. A source-backed story is not independently verified merely because it appears in Briefly. If current evidence is insufficient, say so rather than filling gaps from memory):",
      ...sections
    ].join("\n\n");
  }

  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();

    if (method === "POST" && /\/chat(?:\?|$)/.test(url) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          const context = buildContext(last.content);
          if (context) {
            body.messages = [
              ...messages.slice(0, -1),
              { role: "user", content: context },
              last
            ];
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch {}
    }

    return nativeFetch(input, init);
  };

  refreshBriefly();
  const brieflyTimer = setInterval(refreshBriefly, 5 * 60 * 1000);
  window.addEventListener("beforeunload", () => clearInterval(brieflyTimer), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBriefly();
  });

  const memoryScript = document.createElement("script");
  memoryScript.src = "personal-memory.js?v=1";
  document.body.appendChild(memoryScript);
})();
