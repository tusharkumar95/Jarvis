(() => {
  const TASK_KEY = "jarvis-tasks-v1";
  const home = document.querySelector("#home");
  if (!home) return;

  let briefStories = [];
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
    const discover = document.querySelector("#todayDiscover");

    if (focus) {
      if (overdue.length) focus.textContent = `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}`;
      else if (due.length) focus.textContent = due[0]?.text || "Task ready";
      else focus.textContent = "No urgent tasks";
    }
    if (focusMeta) {
      const open = readTasks().filter(t => !t?.done).length;
      focusMeta.textContent = overdue.length ? `${due.length} for today · ${open} open total` : `${due.length} for today · ${open} open total`;
    }

    if (news) news.textContent = briefStories[0]?.title || "No fresh story loaded";
    if (newsMeta) {
      const count = briefStories.length;
      newsMeta.textContent = count ? `${count} fresh ${count === 1 ? "story" : "stories"}${lastUpdated ? " · live feed" : ""}` : "Briefly feed unavailable";
    }
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

  async function refreshAll() {
    await refreshBriefly();
    render();
  }

  const style = document.createElement("style");
  style.textContent = `
    .jarvis-today{margin:14px 0}.jarvis-today-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.jarvis-today-head h3{margin:.15rem 0 0}.jarvis-today-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.jarvis-today-block{padding:12px;border:1px solid rgba(100,100,100,.1);border-radius:16px;display:grid;gap:5px;min-width:0}.jarvis-today-block small{opacity:.55;font-size:.72rem;letter-spacing:.08em}.jarvis-today-block b{font-size:.96rem;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.jarvis-today-block span{opacity:.6;font-size:.78rem}.jarvis-today-ask{width:100%;margin-top:12px;border:0;border-radius:14px;padding:12px 14px;background:rgba(100,100,100,.08);color:inherit;font:inherit;text-align:left;cursor:pointer}@media(max-width:620px){.jarvis-today-grid{grid-template-columns:1fr}.jarvis-today-block{grid-template-columns:auto 1fr;column-gap:10px}.jarvis-today-block small{grid-column:1}.jarvis-today-block b{grid-column:2;grid-row:1}.jarvis-today-block span{grid-column:2;grid-row:2}}
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
          const context = [
            "JARVIS TODAY CONTEXT (device-local dashboard data; use only for this question):",
            `Date on device: ${localDate()}`,
            `Overdue tasks: ${overdue.length ? overdue.map((t,i)=>`${i+1}. ${t.text} — due ${t.due}`).join(" | ") : "none"}`,
            `Today/no-date tasks: ${due.length ? due.slice(0,6).map((t,i)=>`${i+1}. ${t.text}${t.due ? ` — due ${t.due}` : ""}`).join(" | ") : "none"}`,
            `Open tasks total: ${open.length}`,
            `Top Briefly stories: ${briefStories.length ? briefStories.slice(0,3).map((s,i)=>`${i+1}. ${s?.title || "Untitled"}`).join(" | ") : "unavailable"}`,
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
