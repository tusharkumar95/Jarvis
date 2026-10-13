(() => {
  const KEY = "jarvis-link-library-v1";
  const SEEDED_KEY = "jarvis-link-library-seeded-v2";
  const MAX = 120;
  const view = document.querySelector("#library");
  const home = document.querySelector("#home");
  const form = document.querySelector("#askForm");
  const chat = document.querySelector("#chat");
  if (!view || !home) return;

  const apiBase = () => String(window.JARVIS_API || "").replace(/\/$/, "");
  const seed = {
    id: "learn-anything-xyz",
    url: "https://learn-anything.xyz/",
    title: "Learn Anything",
    description: "A learning and knowledge resource built around exploring topics, connections and learning paths when you want to understand or learn something new.",
    topics: ["learning", "skill building", "learning paths", "knowledge", "study resources"],
    bestFor: ["exploring a new topic", "planning how to learn a new skill", "finding a starting point for learning"],
    note: "Useful when I want to learn something new.",
    created: new Date().toISOString(),
    analyzed: true,
    seeded: true
  };

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value.slice(0, MAX) : [];
    } catch { return []; }
  }

  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX))); } catch {}
    render();
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      url.hash = "";
      if (url.pathname === "/") url.pathname = "";
      return url.toString().replace(/\/$/, "").toLowerCase();
    } catch { return String(value || "").trim().toLowerCase(); }
  }

  function ensureSeed() {
    let seeded = false;
    try { seeded = localStorage.getItem(SEEDED_KEY) === "1"; } catch {}
    if (seeded) return;
    const items = read();
    if (!items.some(item => normalizeUrl(item.url) === normalizeUrl(seed.url))) items.unshift(seed);
    try {
      localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
      localStorage.setItem(SEEDED_KEY, "1");
    } catch {}
  }

  function validUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch { return ""; }
  }

  function domain(value) {
    try { return new URL(value).hostname.replace(/^www\./, ""); }
    catch { return String(value || ""); }
  }

  function setStatus(text, error = false) {
    const node = document.querySelector("#libraryStatus");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("error", error);
  }

  async function inspect(url, note = "") {
    const base = apiBase();
    if (!base) throw new Error("Jarvis router is not connected.");
    const response = await fetch(base + "/inspect-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, note })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Jarvis could not read this website.");
    return data;
  }

  async function saveUrl(rawUrl, note = "") {
    const url = validUrl(rawUrl);
    if (!url) throw new Error("Enter a valid website address starting with http:// or https://");

    const items = read();
    const existing = items.find(item => normalizeUrl(item.url) === normalizeUrl(url));
    if (existing) return { item: existing, duplicate: true };

    let meta;
    try {
      meta = await inspect(url, note);
    } catch (error) {
      meta = {
        title: domain(url),
        description: note ? `Saved because: ${note}` : "Saved website. Jarvis could not analyze the page when it was added.",
        topics: [],
        bestFor: [],
        analyzed: false,
        analysisError: String(error?.message || error)
      };
    }

    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url,
      title: String(meta?.title || domain(url)).trim().slice(0, 160),
      description: String(meta?.description || "Saved website").trim().slice(0, 700),
      topics: Array.isArray(meta?.topics) ? meta.topics.map(v => String(v).trim().slice(0, 60)).filter(Boolean).slice(0, 8) : [],
      bestFor: Array.isArray(meta?.bestFor) ? meta.bestFor.map(v => String(v).trim().slice(0, 120)).filter(Boolean).slice(0, 6) : [],
      note: String(note || "").trim().slice(0, 500),
      created: new Date().toISOString(),
      analyzed: meta?.analyzed !== false
    };

    items.unshift(item);
    write(items);
    return { item, duplicate: false };
  }

  function remove(id) {
    write(read().filter(item => item.id !== id));
  }

  function searchable(item) {
    return [item.title, item.url, item.description, item.note, ...(item.topics || []), ...(item.bestFor || [])]
      .join(" ").toLowerCase();
  }

  function render() {
    const list = document.querySelector("#libraryList");
    const count = document.querySelector("#libraryCount");
    const homeCount = document.querySelector("#homeLibraryCount");
    if (!list) return;

    const items = read();
    if (count) count.textContent = `${items.length} saved`;
    if (homeCount) homeCount.textContent = String(items.length);

    const q = String(document.querySelector("#librarySearch")?.value || "").trim().toLowerCase();
    const visible = q ? items.filter(item => searchable(item).includes(q)) : items;
    list.innerHTML = "";

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.innerHTML = q
        ? '<div class="library-empty-icon">⌕</div><b>No matches</b><span>Try a different word or topic.</span>'
        : '<div class="library-empty-icon">🔖</div><b>Your Library is empty</b><span>Save a useful website above. Jarvis will remember what it is good for.</span>';
      list.appendChild(empty);
      return;
    }

    visible.forEach(item => {
      const card = document.createElement("article");
      card.className = "library-item glass";

      const top = document.createElement("div");
      top.className = "library-item-top";

      const mark = document.createElement("div");
      mark.className = "library-site-mark";
      mark.textContent = String(item.title || domain(item.url) || "W").trim().charAt(0) || "W";

      const copy = document.createElement("div");
      copy.className = "library-site-copy";
      const site = document.createElement("small");
      site.textContent = domain(item.url);
      const title = document.createElement("h3");
      title.textContent = item.title || domain(item.url);
      copy.append(site, title);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "library-delete";
      del.setAttribute("aria-label", `Delete ${item.title || "website"}`);
      del.textContent = "×";
      del.addEventListener("click", () => remove(item.id));
      top.append(mark, copy, del);

      const desc = document.createElement("p");
      desc.className = "library-description";
      desc.textContent = item.description || "Saved website";
      card.append(top, desc);

      if (item.note) {
        const note = document.createElement("p");
        note.className = "library-note";
        note.textContent = item.note;
        card.appendChild(note);
      }

      const tags = [...new Set([...(item.topics || []), ...(item.bestFor || []).slice(0, 2)])].slice(0, 6);
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

  function wireLibraryForm() {
    const save = document.querySelector("#librarySave");
    const urlInput = document.querySelector("#libraryUrl");
    const noteInput = document.querySelector("#libraryNote");
    const searchInput = document.querySelector("#librarySearch");
    if (!save || !urlInput) return;

    save.addEventListener("click", async () => {
      save.disabled = true;
      const old = save.textContent;
      save.textContent = "Reading website…";
      setStatus("Jarvis is reading the page and figuring out when it will be useful.");
      try {
        const result = await saveUrl(urlInput.value, noteInput?.value || "");
        setStatus(result.duplicate ? "That website is already saved." : `Saved ${result.item.title}. Jarvis can now suggest it when relevant.`);
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

    urlInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        save.click();
      }
    });
    searchInput?.addEventListener("input", render);
  }

  function addBubble(role, text) {
    if (!chat) return;
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user" : "jarvis");
    div.textContent = text;
    chat.appendChild(div);
    try {
      if (Array.isArray(conversation)) conversation.push({ role: role === "user" ? "user" : "assistant", content: text });
    } catch {}
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

  function wireChatCommands() {
    if (!form || !chat) return;
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
            : `Saved ${result.item.title} to your Library. I’ll remind you about it when it genuinely fits what you’re trying to do.`;
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

  function wireAIContext() {
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
  }

  ensureSeed();
  wireLibraryForm();
  wireChatCommands();
  wireAIContext();
  render();
})();
