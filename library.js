(() => {
  const KEY = "jarvis-link-library-v1";
  const MAX = 120;
  const home = document.querySelector("#home");
  const form = document.querySelector("#askForm");
  const chat = document.querySelector("#chat");
  const apiBase = () => String(window.JARVIS_API || "").replace(/\/$/, "");
  if (!home || !form || !chat || typeof conversation === "undefined") return;

  const seed = {
    id: "learn-anything-xyz",
    url: "https://learn-anything.xyz/",
    title: "Learn Anything",
    description: "An open-source learning and knowledge platform built around organizing what you know, exploring connections between topics, and curating learning paths for what you want to learn next.",
    topics: ["learning", "skill building", "learning paths", "knowledge", "study resources"],
    bestFor: ["exploring a new topic", "planning how to learn a new skill", "organizing learning resources"],
    note: "Useful when I want to learn something new.",
    created: new Date().toISOString(),
    analyzed: true,
    seeded: true
  };

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value.slice(-MAX) : [];
    } catch { return []; }
  }

  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX))); } catch {}
    render();
  }

  function ensureSeed() {
    const items = read();
    if (items.some(item => normalizeUrl(item.url) === normalizeUrl(seed.url))) return;
    items.unshift(seed);
    try { localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX))); } catch {}
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      url.hash = "";
      if (url.pathname === "/") url.pathname = "";
      return url.toString().replace(/\/$/, "").toLowerCase();
    } catch { return String(value || "").trim().toLowerCase(); }
  }

  function validUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch { return ""; }
  }

  function domain(value) {
    try { return new URL(value).hostname.replace(/^www\./, ""); }
    catch { return value; }
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user" : "jarvis");
    div.textContent = text;
    chat.appendChild(div);
    conversation.push({ role: role === "user" ? "user" : "assistant", content: text });
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  }

  async function inspect(url, note = "") {
    const base = apiBase();
    if (!base) throw new Error("Jarvis router is not connected");
    const response = await fetch(base + "/inspect-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, note })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Could not inspect this website");
    return data;
  }

  async function saveUrl(rawUrl, note = "") {
    const url = validUrl(rawUrl);
    if (!url) throw new Error("Enter a valid http or https website address.");
    const items = read();
    const existing = items.find(item => normalizeUrl(item.url) === normalizeUrl(url));
    if (existing) return { item: existing, duplicate: true };

    let meta;
    try {
      meta = await inspect(url, note);
    } catch (error) {
      meta = {
        title: domain(url),
        description: note ? `Saved for: ${note}` : "Saved website. Jarvis could not analyze the page when it was added.",
        topics: [],
        bestFor: [],
        analyzed: false,
        analysisError: String(error?.message || error)
      };
    }

    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url,
      title: String(meta?.title || domain(url)).slice(0, 160),
      description: String(meta?.description || "Saved website").slice(0, 700),
      topics: Array.isArray(meta?.topics) ? meta.topics.map(v => String(v).slice(0, 60)).filter(Boolean).slice(0, 8) : [],
      bestFor: Array.isArray(meta?.bestFor) ? meta.bestFor.map(v => String(v).slice(0, 120)).filter(Boolean).slice(0, 6) : [],
      note: String(note || "").trim().slice(0, 500),
      created: new Date().toISOString(),
      analyzed: meta?.analyzed !== false
    };
    items.unshift(item);
    write(items);
    return { item, duplicate: false };
  }

  function remove(id) { write(read().filter(item => item.id !== id)); }

  function ensureView() {
    const view = document.querySelector("#library");
    if (!view) return;
    const save = view.querySelector("#librarySave");
    const urlInput = view.querySelector("#libraryUrl");
    const noteInput = view.querySelector("#libraryNote");
    const searchInput = view.querySelector("#librarySearch");

    save?.addEventListener("click", async () => {
      if (!urlInput) return;
      save.disabled = true;
      const old = save.textContent;
      save.textContent = "Reading…";
      setStatus("Jarvis is reading the website and creating useful metadata…");
      try {
        const result = await saveUrl(urlInput.value, noteInput?.value || "");
        setStatus(result.duplicate ? "That website is already in your Library." : `Saved ${result.item.title}.`);
        if (!result.duplicate) {
          urlInput.value = "";
          if (noteInput) noteInput.value = "";
        }
      } catch (error) {
        setStatus(String(error?.message || error), true);
      } finally {
        save.disabled = false;
        save.textContent = old;
      }
    });

    urlInput?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); save?.click(); }
    });
    searchInput?.addEventListener("input", render);
  }

  function setStatus(text, error = false) {
    const el = document.querySelector("#libraryStatus");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("error", error);
  }

  function render() {
    const list = document.querySelector("#libraryList");
    const count = document.querySelector("#libraryCount");
    if (!list) return;
    const items = read();
    if (count) count.textContent = `${items.length} saved`;
    const q = String(document.querySelector("#librarySearch")?.value || "").trim().toLowerCase();
    const visible = q ? items.filter(item => searchable(item).includes(q)) : items;
    list.innerHTML = "";

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = q ? "No saved websites match that search." : "No websites saved yet.";
      list.appendChild(empty);
      return;
    }

    visible.forEach(item => {
      const card = document.createElement("article");
      card.className = "library-item glass";
      const top = document.createElement("div");
      top.className = "library-item-top";
      const titleWrap = document.createElement("div");
      const site = document.createElement("small");
      site.textContent = domain(item.url);
      const title = document.createElement("h3");
      title.textContent = item.title || domain(item.url);
      titleWrap.append(site, title);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "library-delete";
      del.setAttribute("aria-label", `Delete ${item.title || "website"}`);
      del.textContent = "×";
      del.addEventListener("click", () => remove(item.id));
      top.append(titleWrap, del);

      const desc = document.createElement("p");
      desc.className = "library-description";
      desc.textContent = item.description || "Saved website";
      card.append(top, desc);

      if (item.note) {
        const note = document.createElement("p");
        note.className = "library-note";
        note.textContent = `Your note: ${item.note}`;
        card.appendChild(note);
      }

      const tags = [...new Set([...(item.topics || []), ...(item.bestFor || []).slice(0, 2)])].slice(0, 7);
      if (tags.length) {
        const tagWrap = document.createElement("div");
        tagWrap.className = "library-tags";
        tags.forEach(value => {
          const tag = document.createElement("span");
          tag.textContent = value;
          tagWrap.appendChild(tag);
        });
        card.appendChild(tagWrap);
      }

      const actions = document.createElement("div");
      actions.className = "library-actions";
      const open = document.createElement("a");
      open.href = item.url;
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = "Open website ↗";
      const ask = document.createElement("button");
      ask.type = "button";
      ask.textContent = "Ask Jarvis about it";
      ask.addEventListener("click", () => {
        document.querySelector('[data-go="ask"]')?.click();
        const input = document.querySelector("#askInput");
        if (input) {
          input.value = `Tell me how I could use ${item.title || domain(item.url)} based on what you know about it.`;
          input.focus();
        }
      });
      actions.append(open, ask);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function searchable(item) {
    return [item.title, item.url, item.description, item.note, ...(item.topics || []), ...(item.bestFor || [])]
      .join(" ").toLowerCase();
  }

  function tokenize(text) {
    const stop = new Set(["the","a","an","and","or","to","of","for","in","on","with","my","me","i","want","would","like","can","you","jarvis","please","some","something","new","good","best"]);
    return [...new Set(String(text || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter(token => !stop.has(token));
  }

  function relevantLinks(question) {
    const items = read();
    const qTokens = tokenize(question);
    const resourceIntent = /\b(learn|learning|skill|study|course|resource|website|site|tool|research|reference|read|reading|bookmark|saved link|useful link|recommend)\b/i.test(question);
    const scored = items.map(item => {
      const tokens = new Set(tokenize(searchable(item)));
      let score = qTokens.reduce((sum, token) => sum + (tokens.has(token) ? 2 : 0), 0);
      if (resourceIntent && (item.topics || []).some(t => /learn|skill|study|resource|knowledge|course/i.test(t))) score += 2;
      if (resourceIntent && /learn|skill|study|resource|knowledge/i.test(item.description || "")) score += 1;
      return { item, score };
    }).sort((a, b) => b.score - a.score);
    return scored.filter(row => row.score >= (resourceIntent ? 2 : 3)).slice(0, 4).map(row => row.item);
  }

  function parseCommand(text) {
    const value = String(text || "").trim();
    let match = value.match(/^(?:please\s+)?(?:save|add|remember)\s+(?:this\s+)?(?:website|site|link|url)?\s*:?\s*(https?:\/\/\S+)(?:\s+(?:because|for|note)\s+(.+))?$/i);
    if (match) return { type: "save", url: match[1], note: match[2] || "" };
    if (/^(?:show|list|what are|what(?:'s| is))\s+(?:my\s+)?(?:saved\s+)?(?:websites|sites|links|resources|library)\??$/i.test(value)) return { type: "list" };
    match = value.match(/^(?:delete|remove)\s+(?:website|site|link)\s+(\d+)$/i);
    if (match) return { type: "delete", index: Number(match[1]) - 1 };
    return null;
  }

  form.addEventListener("submit", event => {
    const input = document.querySelector("#askInput");
    const value = input?.value?.trim() || "";
    const command = parseCommand(value);
    if (!command) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    addBubble("user", value);
    input.value = "";

    if (command.type === "save") {
      addBubble("assistant", "I’m reading that website before I save it…");
      const wait = chat.lastElementChild;
      saveUrl(command.url, command.note).then(result => {
        if (wait) wait.textContent = result.duplicate
          ? `${result.item.title} is already saved in your Library.`
          : `Saved ${result.item.title} to your Library. I’ll use it later when it’s relevant.`;
      }).catch(error => {
        if (wait) wait.textContent = `I couldn’t save that website: ${String(error?.message || error)}`;
      });
      return;
    }

    const items = read();
    if (command.type === "list") {
      addBubble("assistant", items.length
        ? "Your saved websites:\n" + items.slice(0, 15).map((item, i) => `${i + 1}. ${item.title} — ${item.url}`).join("\n")
        : "Your Jarvis Library is empty.");
      return;
    }

    if (command.type === "delete") {
      const item = items[command.index];
      if (!item) return addBubble("assistant", "I couldn’t find that saved website number.");
      remove(item.id);
      addBubble("assistant", `Removed ${item.title} from your Library.`);
    }
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    #library.view{max-width:820px;margin:0 auto}.library-save{padding:16px;border-radius:22px}.library-save-grid{display:grid;grid-template-columns:1fr auto;gap:9px}.library-save input,.library-search{width:100%;border:1px solid var(--line);background:rgba(127,127,127,.05);color:var(--ink);outline:0;border-radius:14px;padding:12px;font:inherit;font-size:16px}.library-save .library-note-input{grid-column:1 / -1}.library-save button{border:0;border-radius:14px;padding:0 16px;background:var(--ink);color:var(--bg);font-weight:800}.library-save button:disabled{opacity:.55}.library-status{margin:10px 2px 0;color:var(--muted);font-size:12px}.library-status.error{color:var(--accent)}.library-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 10px}.library-toolbar .library-search{max-width:280px}.library-toolbar span{color:var(--muted);font-size:12px;white-space:nowrap}.library-list{display:grid;gap:10px}.library-item{padding:16px;border-radius:22px;min-width:0}.library-item-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.library-item small{color:var(--muted);font-size:10px}.library-item h3{margin:3px 0 0;font-size:18px}.library-delete{border:0;background:transparent;color:var(--muted);font-size:22px;padding:2px 5px}.library-description{margin:10px 0 0;color:var(--muted);font-size:13px;line-height:1.5;overflow-wrap:anywhere}.library-note{margin:9px 0 0;padding:9px 10px;border-radius:12px;background:rgba(127,127,127,.06);font-size:12px;line-height:1.45}.library-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.library-tags span{padding:5px 8px;border-radius:999px;background:rgba(109,128,106,.10);color:var(--accent2);font-size:10px}.library-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.library-actions a,.library-actions button{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:12px;padding:8px 10px;font:inherit;font-size:11px;text-decoration:none}.library-actions a{background:var(--ink);color:var(--bg);border-color:transparent}@media(max-width:520px){.library-save-grid{grid-template-columns:1fr}.library-save .library-note-input{grid-column:auto}.library-save button{min-height:44px}.library-toolbar{align-items:stretch;flex-direction:column}.library-toolbar .library-search{max-width:none}}
  `;
  document.head.appendChild(style);

  ensureSeed();
  ensureView();
  render();

  const previousFetch = window.fetch.bind(window);
  window.fetch = async function(inputArg, init) {
    const url = typeof inputArg === "string" ? inputArg : String(inputArg?.url || "");
    const method = String(init?.method || (typeof inputArg !== "string" ? inputArg?.method : "GET") || "GET").toUpperCase();
    if (method === "POST" && /\/chat(?:\?|$)/.test(url) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const last = messages[messages.length - 1];
        const question = String(last?.content || "");
        const matches = last?.role === "user" ? relevantLinks(question) : [];
        if (matches.length) {
          const context = [
            "JARVIS PERSONAL WEBSITE LIBRARY (user-saved resources from this device; suggest them only when genuinely relevant):",
            ...matches.map((item, i) => [
              `${i + 1}. ${item.title}`,
              `URL: ${item.url}`,
              `Description: ${item.description || ""}`,
              item.topics?.length ? `Topics: ${item.topics.join(", ")}` : "",
              item.bestFor?.length ? `Best for: ${item.bestFor.join("; ")}` : "",
              item.note ? `User note: ${item.note}` : ""
            ].filter(Boolean).join("\n")),
            "If one of these resources clearly fits the user's current goal, remind them that they previously saved it and explain why it fits. Do not force a saved resource into the answer when it is not useful."
          ].join("\n");
          body.messages = [...messages.slice(0, -1), { role: "user", content: context }, last];
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
    }
    return previousFetch(inputArg, init);
  };
})();