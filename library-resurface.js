(() => {
  const LIBRARY_KEY = "jarvis-link-library-v1";
  const CHAT_KEY = "jarvis-chat-history-v1";
  const TASK_KEY = "jarvis-tasks-v1";
  const LEARN_KEY = "jarvis-learn-history-v1";
  const home = document.querySelector("#home");
  if (!home) return;

  const stop = new Set(["the","and","for","that","this","with","from","your","you","are","was","were","have","has","had","about","into","what","when","where","which","would","could","should","want","need","jarvis","today","please","just","some","more"]);

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function tokens(value) {
    return [...new Set((String(value || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(token => !stop.has(token)))];
  }

  function searchable(item) {
    return [item?.title,item?.url,item?.description,item?.note,...(item?.topics || []),...(item?.bestFor || [])].filter(Boolean).join(" ");
  }

  function recentContext() {
    const chats = read(CHAT_KEY).filter(row => row?.role === "user").slice(-6).map(row => row?.content || "");
    const tasks = read(TASK_KEY).filter(row => !row?.done).slice(0, 8).map(row => row?.text || "");
    const lessons = read(LEARN_KEY).slice(-4).map(row => row?.topic || row?.summary || "");
    return [...chats, ...tasks, ...lessons].join(" ");
  }

  function rank() {
    const context = tokens(recentContext());
    if (!context.length) return null;
    const contextSet = new Set(context);
    let best = null;
    for (const item of read(LIBRARY_KEY)) {
      const itemTokens = tokens(searchable(item));
      let score = 0;
      for (const token of itemTokens) if (contextSet.has(token)) score += 2;
      const topicText = `${(item?.topics || []).join(" ")} ${(item?.bestFor || []).join(" ")}`.toLowerCase();
      if (/learn|study|course|skill|knowledge/.test(topicText) && context.some(t => /learn|study|course|skill|excel|sql|vba|photograph|invest/.test(t))) score += 2;
      if (!best || score > best.score) best = { item, score };
    }
    return best && best.score >= 4 ? best : null;
  }

  function ensureCard() {
    let card = document.querySelector("#jarvisLibraryResurface");
    if (card) return card;
    card = document.createElement("article");
    card.id = "jarvisLibraryResurface";
    card.className = "card glass jarvis-library-resurface";
    card.hidden = true;
    card.innerHTML = `
      <div class="jarvis-library-resurface-head"><div><p class="eyebrow">FROM YOUR LIBRARY</p><h3>Worth bringing back</h3></div><span>Relevant now</span></div>
      <h4 id="jarvisLibraryResurfaceTitle"></h4>
      <p id="jarvisLibraryResurfaceWhy" class="subtle"></p>
      <div class="jarvis-library-resurface-actions"><a id="jarvisLibraryResurfaceOpen" target="_blank" rel="noopener">Open ↗</a><button id="jarvisLibraryResurfaceAsk" type="button">Ask Jarvis</button></div>`;
    const today = document.querySelector("#jarvisTodayCard");
    if (today) today.insertAdjacentElement("afterend", card);
    else home.querySelector(".askbar")?.insertAdjacentElement("afterend", card);

    const style = document.createElement("style");
    style.textContent = `.jarvis-library-resurface{margin:12px 0;padding:16px}.jarvis-library-resurface-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.jarvis-library-resurface-head h3{margin:.15rem 0 0}.jarvis-library-resurface-head>span{font-size:10px;color:var(--muted);white-space:nowrap}.jarvis-library-resurface h4{margin:13px 0 5px;font-size:18px}.jarvis-library-resurface .subtle{margin:0}.jarvis-library-resurface-actions{display:flex;gap:8px;margin-top:12px}.jarvis-library-resurface-actions a,.jarvis-library-resurface-actions button{border:1px solid var(--line);border-radius:12px;padding:9px 11px;background:transparent;color:var(--ink);font:inherit;font-size:12px;text-decoration:none}.jarvis-library-resurface-actions button{background:var(--ink);color:var(--bg);border-color:var(--ink)}`;
    document.head.appendChild(style);
    return card;
  }

  function render() {
    const card = ensureCard();
    const match = rank();
    if (!match?.item) {
      card.hidden = true;
      return;
    }
    const item = match.item;
    card.hidden = false;
    const title = card.querySelector("#jarvisLibraryResurfaceTitle");
    const why = card.querySelector("#jarvisLibraryResurfaceWhy");
    const open = card.querySelector("#jarvisLibraryResurfaceOpen");
    const ask = card.querySelector("#jarvisLibraryResurfaceAsk");
    if (title) title.textContent = item.title || item.url || "Saved resource";
    if (why) why.textContent = item.note || item.description || "This saved resource matches something you have been working on recently.";
    if (open) open.href = item.url || "#";
    if (ask) {
      ask.onclick = () => {
        document.querySelector('[data-go="ask"]')?.click();
        const input = document.querySelector("#askInput");
        if (!input) return;
        input.value = `How can ${item.title || item.url || "this saved resource"} help with what I am working on right now?`;
        input.focus();
      };
    }
  }

  render();
  setTimeout(render, 700);
  document.querySelector("#askForm")?.addEventListener("submit", () => setTimeout(render, 150));
  document.addEventListener("click", event => {
    if (event.target.closest?.("#librarySave,.library-delete")) setTimeout(render, 700);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") render();
  });
  window.addEventListener("storage", render);
})();
