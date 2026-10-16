(() => {
  const KEY = "jarvis-app-handoff-v1";

  function previousUserText(node) {
    let current = node?.previousElementSibling || null;
    let hops = 0;
    while (current && hops < 8) {
      if (current.classList?.contains("user")) return String(current.textContent || "").trim();
      current = current.previousElementSibling;
      hops += 1;
    }
    return "";
  }

  function isSpreadsheet(text) {
    return /\b(excel|spreadsheet|worksheet|workbook|formula|cell|range|vba|macro|power query|pivot|xlookup|vlookup|sumifs?|index.?match|google sheets|apps script|pocketsheet)\b/i.test(text);
  }

  function isInvestment(text) {
    return /\b(stock|stocks|share|shares|etf|portfolio|invest|investment|ticker|tsx|tsxv|nse|bse|valuation|small[ -]?cap|dividend|earnings|revenue growth|market cap|fundamental|price target|watchlist)\b/i.test(text);
  }

  function tickerFrom(text) {
    const explicit = String(text || "").match(/\b([A-Z]{1,5})(?:\.(TO|V|CN|NS|BO))?\b/g) || [];
    const blocked = new Set(["I","AI","ETF","TSX","TSXV","NSE","BSE","CAD","USD","RRSP","TFSA","EPS","PE","P/E"]);
    const candidate = explicit.map(v => v.toUpperCase()).find(v => !blocked.has(v.split(".")[0]));
    return candidate || "";
  }

  function investmentRoute(text) {
    if (/\betf|exchange traded fund|fund overlap\b/i.test(text)) return "etf";
    if (/\bportfolio|allocation|holdings|diversif/i.test(text)) return "portfolio";
    if (/\bsmall[ -]?cap\b/i.test(text)) return "smallcap";
    if (tickerFrom(text) || /\b(stock|share|company|valuation|fundamental|earnings)\b/i.test(text)) return "custom";
    return "home";
  }

  function marketFrom(text, ticker) {
    if (/\b(india|indian|nse|bse)\b/i.test(text) || /\.(NS|BO)$/i.test(ticker)) return "India";
    if (/\b(canada|canadian|tsx|tsxv|cse)\b/i.test(text) || /\.(TO|V|CN)$/i.test(ticker)) return "Canada";
    return "";
  }

  function save(payload) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...payload, created: new Date().toISOString() })); }
    catch {}
  }

  function addButton(container, label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    container.appendChild(button);
  }

  function attach(node, answer) {
    if (!node || node.dataset.handoffReady === "1") return;
    const prompt = previousUserText(node);
    const combined = `${prompt}\n${answer}`;
    const spreadsheet = isSpreadsheet(combined);
    const investment = isInvestment(combined);
    if (!spreadsheet && !investment) return;

    const actions = document.createElement("div");
    actions.className = "answer-actions answer-handoff-actions";

    if (spreadsheet) {
      addButton(actions, "Continue in PocketSheet", "handoff-pocket", () => {
        save({ target:"pocketsheet", prompt, answer });
        window.location.href = "../PocketSheet/?from=jarvis";
      });
    }

    if (investment) {
      addButton(actions, "Open in Investment Radar", "handoff-radar", () => {
        const ticker = tickerFrom(prompt);
        const route = investmentRoute(combined);
        const market = marketFrom(prompt, ticker);
        save({ target:"investment-radar", prompt, answer, ticker, route, market });
        window.location.href = "../Investment_Radar/jarvis.html?from=jarvis";
      });
    }

    if (actions.childElementCount) {
      node.appendChild(actions);
      node.dataset.handoffReady = "1";
    }
  }

  document.addEventListener("jarvis:answer-rendered", event => {
    attach(event.detail?.node, String(event.detail?.text || ""));
  });
})();
