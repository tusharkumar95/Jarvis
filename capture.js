(() => {
  const KEY = "jarvis-capture-v1";
  const MAX = 80;
  const home = document.querySelector("#home");
  const form = document.querySelector("#askForm");
  const chat = document.querySelector("#chat");
  if (!home || !form || !chat || typeof conversation === "undefined") return;

  function readNotes() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value.slice(-MAX) : [];
    } catch { return []; }
  }

  function writeNotes(notes) {
    try { localStorage.setItem(KEY, JSON.stringify(notes.slice(-MAX))); } catch {}
    render();
  }

  function addNote(text) {
    const clean = String(text || "").trim().replace(/\s+/g, " ").slice(0, 500);
    if (!clean) return null;
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text: clean,
      created: new Date().toISOString(),
      pinned: false
    };
    const notes = readNotes();
    notes.push(note);
    writeNotes(notes);
    return note;
  }

  function updateNote(id, patch) {
    writeNotes(readNotes().map(n => n.id === id ? { ...n, ...patch } : n));
  }

  function deleteNote(id) {
    writeNotes(readNotes().filter(n => n.id !== id));
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user" : "jarvis");
    div.textContent = text;
    chat.appendChild(div);
    conversation.push({ role: role === "user" ? "user" : "assistant", content: text });
    chat.scrollTop = chat.scrollHeight;
  }

  function ensurePanel() {
    if (document.querySelector("#jarvisCapturePanel")) return;
    const panel = document.createElement("article");
    panel.id = "jarvisCapturePanel";
    panel.className = "card glass jarvis-capture-panel";
    panel.innerHTML = `
      <div class="jarvis-capture-head">
        <div><p class="eyebrow">QUICK CAPTURE</p><h3>Inbox</h3></div>
        <span id="captureCount">0 notes</span>
      </div>
      <div class="jarvis-capture-entry">
        <input id="captureInput" type="text" autocomplete="off" placeholder="Save a thought, number, idea…" aria-label="Quick note" />
        <button id="captureAdd" type="button" class="secondary-btn">Save</button>
      </div>
      <div id="captureList" class="jarvis-capture-list"></div>
      <p class="jarvis-capture-hint">You can also tell Ask Jarvis: “Save a note: …”</p>`;

    const tasks = document.querySelector("#jarvisTasksPanel");
    const today = document.querySelector("#jarvisTodayCard");
    const pulse = home.querySelector(".pulse-grid");
    if (tasks) tasks.insertAdjacentElement("afterend", panel);
    else if (today) today.insertAdjacentElement("afterend", panel);
    else if (pulse) pulse.insertAdjacentElement("afterend", panel);
    else home.appendChild(panel);

    const input = panel.querySelector("#captureInput");
    const add = panel.querySelector("#captureAdd");
    add?.addEventListener("click", () => {
      if (!input) return;
      if (addNote(input.value)) input.value = "";
    });
    input?.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        add?.click();
      }
    });
  }

  function render() {
    ensurePanel();
    const notes = readNotes();
    const count = document.querySelector("#captureCount");
    const list = document.querySelector("#captureList");
    if (count) count.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
    if (!list) return;
    list.innerHTML = "";

    const visible = [...notes]
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.created || "").localeCompare(String(a.created || "")))
      .slice(0, 6);

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nothing captured yet.";
      list.appendChild(empty);
      return;
    }

    visible.forEach(note => {
      const row = document.createElement("div");
      row.className = "jarvis-capture-row";
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "jarvis-capture-pin";
      pin.textContent = note.pinned ? "★" : "☆";
      pin.setAttribute("aria-label", note.pinned ? "Unpin note" : "Pin note");
      pin.addEventListener("click", () => updateNote(note.id, { pinned: !note.pinned }));

      const text = document.createElement("span");
      text.textContent = note.text;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "jarvis-capture-delete";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Delete note");
      remove.addEventListener("click", () => deleteNote(note.id));

      row.append(pin, text, remove);
      list.appendChild(row);
    });
  }

  function parseCommand(text) {
    let m;
    m = String(text || "").trim().match(/^(?:please\s+)?(?:save|add|capture)\s+(?:a\s+)?note\s*:?\s*(.+)$/i);
    if (m) return { type: "add", value: m[1] };
    if (/^(?:show|list|what are|what(?:'s| is))\s+(?:my\s+)?(?:notes|inbox|captures)\??$/i.test(String(text || "").trim())) return { type: "list" };
    m = String(text || "").trim().match(/^(?:delete|remove)\s+note\s+(\d+)$/i);
    if (m) return { type: "delete", index: Number(m[1]) - 1 };
    return null;
  }

  form.addEventListener("submit", event => {
    const ask = document.querySelector("#askInput");
    const value = ask?.value?.trim() || "";
    const command = parseCommand(value);
    if (!command) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    addBubble("user", value);
    ask.value = "";

    if (command.type === "add") {
      const note = addNote(command.value);
      addBubble("assistant", note ? `Saved to Quick Capture: “${note.text}”` : "I couldn’t save that note.");
      return;
    }

    const notes = [...readNotes()].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.created || "").localeCompare(String(a.created || "")));
    if (command.type === "list") {
      addBubble("assistant", notes.length ? "Your saved notes:\n" + notes.slice(0, 10).map((n, i) => `${i + 1}. ${n.text}`).join("\n") : "Your Quick Capture inbox is empty.");
      return;
    }

    if (command.type === "delete") {
      const note = notes[command.index];
      if (!note) return addBubble("assistant", "I couldn’t find that note number.");
      deleteNote(note.id);
      addBubble("assistant", `Deleted note: “${note.text}”`);
    }
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .jarvis-capture-panel{margin:14px 0}.jarvis-capture-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.jarvis-capture-head h3{margin:.15rem 0 0}.jarvis-capture-head>span{opacity:.6;font-size:.88rem;white-space:nowrap}.jarvis-capture-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px 0;margin-top:8px;border-top:1px solid rgba(100,100,100,.1);border-bottom:1px solid rgba(100,100,100,.1)}.jarvis-capture-entry input{border:0;outline:0;background:transparent;color:inherit;font:inherit;min-width:0;padding:8px 4px}.jarvis-capture-list{display:grid}.jarvis-capture-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid rgba(100,100,100,.08)}.jarvis-capture-row span{line-height:1.35}.jarvis-capture-pin,.jarvis-capture-delete{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:2px 4px;opacity:.7}.jarvis-capture-hint{margin:10px 0 0;opacity:.55;font-size:.82rem}
  `;
  document.head.appendChild(style);

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
        const q = String(last?.content || "");
        const wantsNotes = /\b(note|notes|inbox|capture|captured|saved thought|saved thoughts|what did i save)\b/i.test(q);
        if (last?.role === "user" && wantsNotes) {
          const notes = readNotes();
          const context = notes.length
            ? "JARVIS QUICK CAPTURE (device-local notes):\n" + notes.slice(-12).map((n, i) => `${i + 1}. ${n.text}`).join("\n")
            : "JARVIS QUICK CAPTURE: no saved notes on this device.";
          body.messages = [...messages.slice(0, -1), { role: "user", content: context }, last];
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
    }
    return previousFetch(inputArg, init);
  };
})();