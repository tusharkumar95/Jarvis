(() => {
  const nativeFetch = window.fetch.bind(window);
  const LAB_KEY = "jarvis-lab-projects-v1";
  let brieflyStories = [];
  let brieflyMeta = {};
  let moves = [];
  let movesMeta = {};
  let markets = {};
  let marketsMeta = {};

  function normalized(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function syncBrieflySummaries() {
    if (!brieflyStories.length) return;
    const byTitle = new Map(brieflyStories.map(story => [normalized(story?.title), story]));
    document.querySelectorAll("#brieflyList .news-item").forEach(card => {
      const title = card.querySelector("h3");
      const summary = card.querySelector("p[id^='jarvis-news-summary-']");
      if (!title || !summary) return;
      const story = byTitle.get(normalized(title.textContent));
      if (!story?.summary) return;
      summary.textContent = String(story.summary).trim();
      card.querySelector("[data-jarvis-news]")?.remove();
    });
  }

  async function refreshBriefly() {
    try {
      const response = await nativeFetch("../Briefly/data.json?jarvisContext=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      brieflyStories = Array.isArray(data?.stories) ? data.stories.slice(0, 10) : [];
      brieflyMeta = {
        updated: data?.updated || "",
        engine: data?.engine || "",
        editor: data?.editor || ""
      };
      window.JarvisBriefly = {
        updated: brieflyMeta.updated,
        engine: brieflyMeta.engine,
        editor: brieflyMeta.editor,
        stories: brieflyStories.map(story => ({ ...story }))
      };
      document.dispatchEvent(new CustomEvent("jarvis:briefly-data", { detail: window.JarvisBriefly }));
      requestAnimationFrame(syncBrieflySummaries);
    } catch {}
  }

  async function refreshMoves() {
    try {
      const response = await nativeFetch("../Briefly/moves-intelligence.json?jarvisMoves=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      moves = Array.isArray(data?.records) ? data.records.slice(0, 160) : [];
      movesMeta = {
        updated: data?.updated || "",
        engine: data?.engine || "Moves Intelligence",
        policy: data?.policy || "",
        sources: data?.sources || {}
      };
      window.JarvisMoves = { ...movesMeta, records: moves.map(move => ({ ...move })) };
    } catch {}
  }

  async function refreshMarkets() {
    try {
      const response = await nativeFetch("../Briefly/market-intelligence.json?jarvisMarkets=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      markets = data?.markets && typeof data.markets === "object" ? data.markets : {};
      marketsMeta = {
        updated: data?.updated || "",
        engine: data?.engine || "Briefly Markets Intelligence",
        policy: data?.policy || ""
      };
      window.JarvisMarkets = {
        ...marketsMeta,
        markets: Object.fromEntries(Object.entries(markets).map(([key, value]) => [key, { ...value }]))
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

  function storyLine(story, index) {
    const title = String(story?.title || "Untitled").trim();
    const source = String(story?.source || "Briefly").trim();
    const category = String(story?.cat || story?.category || "News").trim();
    const summary = String(story?.summary || "").trim().slice(0, 430);
    const why = String(story?.why || "").trim().slice(0, 220);
    const sourceCount = Math.max(1, Number(story?.sourceCount || story?.sources?.length || 1));
    const score = Number(story?.importanceScore || 0);
    const trust = story?.verified === true ? "verified" : `source-backed/${String(story?.confidence || "unknown")}`;
    const status = String(story?.status || "").trim();
    const parts = [
      `${index + 1}. [${category}] ${title}`,
      `source: ${source}${sourceCount > 1 ? ` (${sourceCount} sources)` : ""}`,
      `trust: ${trust}${score ? `; importance ${score}` : ""}${status ? `; ${status}` : ""}`,
      summary ? `summary: ${summary}` : "",
      why ? `why it matters: ${why}` : ""
    ].filter(Boolean);
    return parts.join(" — ");
  }

  function wantsMovesContext(question) {
    return /\b(moves?|smart money|insider buying|insider selling|insiders?|accumulat(?:e|es|ed|ing|ion)|bulk deal|block deal|ownership activity|large buyer|large seller|who (?:is|has been) buying|who (?:is|has been) selling|institutional buying|institutional selling)\b/i.test(String(question || ""));
  }

  function matchMove(move, question) {
    const q = String(question || "").toLowerCase();
    if (/\b(canada|canadian|tsx|tsxv|cse)\b/.test(q) && move.market !== "Canada") return false;
    if (/\b(india|indian|nse|bse)\b/.test(q) && move.market !== "India") return false;
    if (/\binsider buying\b/.test(q) && !(move.tags || []).map(x => String(x).toLowerCase()).includes("insider buying")) return false;
    if (/\binsider selling\b/.test(q) && move.direction !== "SELL") return false;
    if (/\baccumulat/.test(q) && !(move.tags || []).map(x => String(x).toLowerCase()).includes("accumulating")) return false;
    if (/\b(?:selling|seller|sold|sell)\b/.test(q) && !/\b(?:buy|buyer|buying|accumulat)/.test(q) && move.direction !== "SELL") return false;
    return true;
  }

  function moveMoney(move) {
    if (move.market === "India") return `₹${Number(move.valueCr || 0).toFixed(2)} Cr`;
    const value = Number(move.valueCAD || 0);
    return value ? `CAD ${Math.round(value).toLocaleString("en-CA")}` : "value unavailable";
  }

  function moveLine(move, index) {
    const tags = Array.isArray(move.tags) ? move.tags.join(", ") : "";
    return [
      `${index + 1}. ${move.market || ""} — ${move.company || "Unknown company"}${move.symbol ? ` (${move.symbol})` : ""}`,
      `actor: ${move.investor || "Unknown"}${move.role ? `; role: ${move.role}` : move.actorType ? `; type: ${move.actorType}` : ""}`,
      `action: ${move.direction || ""}; disclosure type: ${move.dealType || ""}; value: ${moveMoney(move)}`,
      `signal: ${move.signal || ""}; Move Score: ${Number(move.moveScore || 0)}/100 (${move.strength || "unrated"}); observed days: ${Number(move.observedDays || 1)}`,
      tags ? `tags: ${tags}` : "",
      move.whyNotable ? `why notable: ${move.whyNotable}` : "",
      `source quality: ${move.sourceQuality || "public disclosure"}`,
      move.sourceUrl ? `source: ${move.sourceUrl}` : ""
    ].filter(Boolean).join(" — ");
  }

  function buildMovesContext(question) {
    if (!moves.length) return "Briefly Moves Intelligence is currently unavailable.";
    let selected = moves.filter(move => matchMove(move, question));
    if (!selected.length) selected = [...moves];
    selected.sort((a, b) => (Number(b.moveScore || 0) - Number(a.moveScore || 0)) || String(b.date || "").localeCompare(String(a.date || "")));
    const sourceNote = movesMeta?.sources?.Canada?.automation || "Canadian activity is published only after public-disclosure verification.";
    return [
      `Moves feed: ${movesMeta.engine || "Moves Intelligence"}${movesMeta.updated ? `; updated ${movesMeta.updated}` : ""}.`,
      "Use only the records below for claims about disclosed ownership activity. Do not infer undisclosed holdings, investor intent, future price performance, or investment merit.",
      "Move Score ranks disclosure significance from observed data; it is not a buy/sell score or expected-return forecast.",
      "India records come from official NSE bulk/block disclosures. A bulk or block trade is not automatically bullish; market intermediaries are deliberately discounted.",
      `Canada rule: ${sourceNote} Never call a Canadian record insider buying unless the supplied role/tags establish an insider open-market purchase.`,
      selected.slice(0, 12).map(moveLine).join("\n")
    ].join("\n");
  }

  function wantsMarketContext(question) {
    return /\b(why did|why is|why are|what moved|market move|markets move|tsx|s&p\/tsx|nifty|sensex|canadian market|canada market|indian market|india market|market driver|market drivers|what drove|drove the market)\b/i.test(String(question || ""));
  }

  function marketLine(name, market) {
    if (!market) return `${name}: unavailable.`;
    const drivers = Array.isArray(market.drivers) ? market.drivers.slice(0, 5) : [];
    const driverText = drivers.length
      ? drivers.map(item => `${String(item?.kind || "context").toUpperCase()}: ${item?.label || "Unnamed factor"}${item?.detail ? ` — ${item.detail}` : ""}`).join(" | ")
      : "No driver evidence supplied.";
    return [
      `${name}: ${market.move || market.headline || "market move unavailable"}`,
      market.headline ? `headline: ${market.headline}` : "",
      market.why ? `Briefly explanation: ${market.why}` : "",
      `confidence: ${market.confidence || "unknown"}`,
      `drivers/context: ${driverText}`,
      market.primaryIndex?.source ? `index source: ${market.primaryIndex.source}` : "",
      Array.isArray(market.sources) ? `evidence count: ${market.sources.length}` : ""
    ].filter(Boolean).join(" — ");
  }

  function buildMarketsContext(question) {
    if (!Object.keys(markets).length) return "Briefly Markets Intelligence is currently unavailable.";
    const q = String(question || "").toLowerCase();
    const selected = [];
    if (/\b(canada|canadian|tsx|s&p\/tsx)\b/.test(q) && markets.Canada) selected.push(["Canada", markets.Canada]);
    if (/\b(india|indian|nifty|sensex)\b/.test(q) && markets.India) selected.push(["India", markets.India]);
    if (!selected.length) {
      if (markets.Canada) selected.push(["Canada", markets.Canada]);
      if (markets.India) selected.push(["India", markets.India]);
    }
    return [
      `Markets feed: ${marketsMeta.engine || "Briefly Markets Intelligence"}${marketsMeta.updated ? `; updated ${marketsMeta.updated}` : ""}.`,
      marketsMeta.policy || "Treat a factor as a causal driver only when the evidence explicitly connects it to the same-direction final market move; otherwise call it context.",
      "Do not convert market-driver evidence into personalized buy/sell advice.",
      selected.map(([name, market]) => marketLine(name, market)).join("\n")
    ].join("\n");
  }

  function buildContext(question) {
    const sections = [];
    const q = String(question || "");

    const wantsProjects = /\b(project|projects|lab|app idea|app ideas|saved idea|saved ideas|my ideas|build idea|build ideas)\b/i.test(q);
    const wantsNews = /\b(briefly|news|headline|headlines|latest story|latest stories|news story|news stories|today.?s news|current news|what happened|overnight|what matters today|important today)\b/i.test(q);

    if (wantsProjects) {
      const projects = labProjects();
      sections.push(
        projects.length
          ? `Saved Lab projects on this device:\n${projects.map(projectLine).join("\n")}`
          : "Saved Lab projects on this device: none."
      );
    }

    if (wantsNews) {
      const meta = [
        brieflyMeta.engine ? `engine=${brieflyMeta.engine}` : "",
        brieflyMeta.updated ? `updated=${brieflyMeta.updated}` : "",
        brieflyMeta.editor ? `editor=${brieflyMeta.editor}` : ""
      ].filter(Boolean).join("; ");
      sections.push(
        brieflyStories.length
          ? `Current Briefly intelligence feed${meta ? ` (${meta})` : ""}:\n${brieflyStories.slice(0, 8).map(storyLine).join("\n")}`
          : "Current Briefly feed: unavailable right now."
      );
    }

    if (wantsMovesContext(q)) sections.push(buildMovesContext(q));
    if (wantsMarketContext(q)) sections.push(buildMarketsContext(q));

    if (!sections.length) return "";
    return [
      "JARVIS APP CONTEXT (use only when relevant to the user's question; do not claim this context is broader than shown. Respect each story's verification/trust label and do not upgrade source-backed items to verified facts without independent support):",
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

  document.addEventListener("click", event => {
    if (!event.target.closest?.('[data-go="briefly"]')) return;
    requestAnimationFrame(syncBrieflySummaries);
  });

  refreshBriefly();
  refreshMoves();
  refreshMarkets();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshBriefly();
      refreshMoves();
      refreshMarkets();
    }
  });

  const memoryScript = document.createElement("script");
  memoryScript.src = "personal-memory.js?v=1";
  document.body.appendChild(memoryScript);
})();
