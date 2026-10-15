(() => {
  const TASK_KEY = "jarvis-tasks-v1";
  const home = document.querySelector("#home");
  if (!home) return;

  let briefStories = [];
  let movesSignals = [];
  let lastUpdated = null;

  function localDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function readTasks() {
    try {
      const value = JSON.parse(localStorage.getItem(TASK_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function todayTasks() {
    const today = localDate();
    return readTasks()
      .filter(t => !t?.done && (t?.due === today || !t?.due))
      .sort((a, b) => String(a?.due || "9999").localeCompare(String(b?.due || "9999")));
  }

  function overdueTasks() {
    const today = localDate();
    return readTasks().filter(t => !t?.done && t?.due && t.due < today);
  }

  function discoverTitle() {
    return document.querySelector("#homeDiscoverTitle")?.textContent?.trim() || "Today’s Discover story";
  }

  function topMove() {
    return [...movesSignals]
      .filter(move => Number(move?.moveScore || 0) >= 45)
      .sort((a,b) => Number(b?.moveScore || 0) - Number(a?.moveScore || 0))[0] || null;
  }

  function moveLabel(move) {
    if (!move) return "No notable move";
    const actor=move.investor ? `${move.investor} · ` : "";
    return `${actor}${move.direction === "SELL" ? "sold" : "bought"} ${move.symbol || move.company || ""}`.trim();
  }

  function ensureCard() {
    let card = document.querySelector("#jarvisTodayCard");
    if (card) return card;
    card = document.createElement("article");
    card.id = "jarvisTodayCard";
    card.className = "card glass jarvis-today";
    card.innerHTML = `
      <div class="jarvis-today-head">
        <div><p class="eyebrow">TODAY</p><h3>Your day at a glance</h3></div>
        <button type="button" class="text-btn" id="refreshToday">Refresh</button>
      </div>
      <div class="jarvis-today-grid">
        <div class="jarvis-today-block"><small>FOCUS</small><b id="todayFocus">Checking tasks…</b><span id="todayFocusMeta"></span></div>
        <div class="jarvis-today-block"><small>BRIEFLY</small><b id="todayNews">Checking news…</b><span id="todayNewsMeta"></span></div>
        <div class="jarvis-today-block"><small>MOVES</small><b id="todayMove">Checking disclosures…</b><span id="todayMoveMeta"></span></div>
        <div class="jarvis-today-block"><small>DISCOVER</small><b id="todayDiscover">Loading…</b><span>Today’s learning pick</span></div>
      </div>
      <button type="button" class="jarvis-today-ask" id="askAboutToday">✦ Ask Jarvis what to focus on today</button>`;
    const askbar = home.querySelector(".askbar");
    if (askbar) askbar.insertAdjacentElement("afterend", card);
    else home.prepend(card);

    card.querySelector("#refreshToday")?.addEventListener("click", refreshAll);
    card.querySelector("#askAboutToday")?.addEventListener("click", () => {
      const askNav = document.querySelector('[data-go="ask"]');
      if (askNav) askNav.click();
      const input = document.querySelector("#askInput");
      if (input) {
        input.value = "What should I focus on today? Give me a short practical brief.";
        input.focus();
      }
    });
    return card;
  }

  function render() {
    ensureCard();
    const due = todayTasks();
    const overdue = overdueTasks();
    const focus = document.querySelector("#todayFocus");
    const focusMeta = document.querySelector("#todayFocusMeta");
    const news = document.querySelector("#todayNews");
    const newsMeta = document.querySelector("#todayNewsMeta");
    const move = document.querySelector("#todayMove");
    const moveMeta = document.querySelector("#todayMoveMeta");
    const discover = document.querySelector("#todayDiscover");

    if (focus) {
      if (overdue.length) focus.textContent = `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}`;
      else if (due.length) focus.textContent = due[0]?.text || "Task ready";
      else focus.textContent = "No urgent tasks";
    }
    if (focusMeta) {
      const open = readTasks().filter(t => !t?.done).length;
      focusMeta.textContent = `${due.length} for today · ${open} open total`;
    }

    if (news) news.textContent = briefStories[0]?.title || "No fresh story loaded";
    if (newsMeta) {
      const count = briefStories.length;
      newsMeta.textContent = count ? `${count} fresh ${count === 1 ? "story" : "stories"}${lastUpdated ? " · live feed" : ""}` : "Briefly feed unavailable";
    }

    const strongest=topMove();
    if (move) move.textContent=moveLabel(strongest);
    if (moveMeta) moveMeta.textContent=strongest ? `${strongest.market || ""} · ${strongest.signal || "Notable"} · ${Number(strongest.moveScore || 0)}/100` : "No high-signal disclosure loaded";
    if (discover) discover.textContent = discoverTitle();
  }

  async function refreshBriefly() {
    try {
      const response = await fetch("../Briefly/data.json?today=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("Briefly unavailable");
      const data = await response.json();
      briefStories = Array.isArray(data?.stories) ? data.stories.slice(0, 6) : [];
      lastUpdated = data?.updated || null;
    } catch {
      briefStories = [];
      lastUpdated = null;
    }
  }

  async function refreshMoves() {
    try {
      const response=await fetch("../Briefly/moves-intelligence.json?todayMoves="+Date.now(),{cache:"no-store"});
      if(!response.ok)throw new Error("Moves unavailable");
      const data=await response.json();
      movesSignals=Array.isArray(data?.records)?data.records.slice(0,40):[];
    }catch{movesSignals=[];}
  }

  async function refreshAll() {
    await Promise.all([refreshBriefly(),refreshMoves()]);
    render();
  }

  const style = document.createElement("style");
  style.textContent = `
    .jarvis-today{margin:14px 0}.jarvis-today-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.jarvis-today-head h3{margin:.15rem 0 0}.jarvis-today-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.jarvis-today-block{padding:12px;border:1px solid rgba(100,100,100,.1);border-radius:16px;display:grid;gap:5px;min-width:0}.jarvis-today-block small{opacity:.55;font-size:.72rem;letter-spacing:.08em}.jarvis-today-block b{font-size:.96rem;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.jarvis-today-block span{opacity:.6;font-size:.78rem}.jarvis-today-ask{width:100%;margin-top:12px;border:0;border-radius:14px;padding:12px 14px;background:rgba(100,100,100,.08);color:inherit;font:inherit;text-align:left;cursor:pointer}@media(max-width:620px){.jarvis-today-grid{grid-template-columns:1fr 1fr}.jarvis-today-block{min-height:88px}}@media(max-width:390px){.jarvis-today-grid{grid-template-columns:1fr}.jarvis-today-block{min-height:0}}
  `;
  document.head.appendChild(style);

  render();
  refreshAll();
  setTimeout(render, 500);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAll();
  });
  window.addEventListener("storage", render);

  const previousFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
    if (method === "POST" && /\/chat(?:\?|$)/.test(url) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const last = messages[messages.length - 1];
        const q = String(last?.content || "");
        const wantsToday = /\b(today|my day|focus|priorit|morning brief|daily brief|day look like|what should i do|plan my day)\b/i.test(q);
        if (last?.role === "user" && wantsToday) {
          const due = todayTasks();
          const overdue = overdueTasks();
          const open = readTasks().filter(t => !t?.done);
          const strongest=topMove();
          const context = [
            "JARVIS TODAY CONTEXT (device-local dashboard and Briefly intelligence; use only for this question):",
            `Date on device: ${localDate()}`,
            `Overdue tasks: ${overdue.length ? overdue.map((t,i)=>`${i+1}. ${t.text} — due ${t.due}`).join(" | ") : "none"}`,
            `Today/no-date tasks: ${due.length ? due.slice(0,6).map((t,i)=>`${i+1}. ${t.text}${t.due ? ` — due ${t.due}` : ""}`).join(" | ") : "none"}`,
            `Open tasks total: ${open.length}`,
            `Top Briefly stories: ${briefStories.length ? briefStories.slice(0,3).map((s,i)=>`${i+1}. ${s?.title || "Untitled"}${s?.why?` — why: ${s.why}`:""}`).join(" | ") : "unavailable"}`,
            strongest ? `Strongest current Moves signal: ${moveLabel(strongest)} — ${strongest.market || ""}; ${strongest.signal || ""}; Move Score ${Number(strongest.moveScore||0)}/100; why notable: ${strongest.whyNotable || "not supplied"}. Treat this as disclosure intelligence, not a recommendation.` : "Strongest current Moves signal: unavailable",
            `Today’s Discover item: ${discoverTitle()}`
          ].join("\n");
          body.messages = [...messages.slice(0, -1), { role: "user", content: context }, last];
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
    }
    return previousFetch(input, init);
  };
})();
