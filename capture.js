(() => {
  const KEY = "jarvis-capture-v1";
  const MAX = 80;
  const form = document.querySelector("#askForm");
  const chat = document.querySelector("#chat");
  if (!form || !chat || typeof conversation === "undefined") return;

  function readNotes() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value.slice(-MAX) : [];
    } catch { return []; }
  }

  function writeNotes(notes) {
    try { localStorage.setItem(KEY, JSON.stringify(notes.slice(-MAX))); } catch {}
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
      addBubble("assistant", note ? `Saved note: “${note.text}”` : "I couldn’t save that note.");
      return;
    }

    const notes = [...readNotes()].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.created || "").localeCompare(String(a.created || "")));
    if (command.type === "list") {
      addBubble("assistant", notes.length ? "Your saved notes:\n" + notes.slice(0, 10).map((n, i) => `${i + 1}. ${n.text}`).join("\n") : "You have no saved notes.");
      return;
    }

    const note = notes[command.index];
    if (!note) return addBubble("assistant", "I couldn’t find that note number.");
    deleteNote(note.id);
    addBubble("assistant", `Deleted note: “${note.text}”`);
  }, true);

  // Keep note context available to Jarvis without rendering Quick Capture on Home.
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
        if (last?.role === "user" && /\b(note|notes|inbox|capture|captured|saved thought|saved thoughts|what did i save)\b/i.test(q)) {
          const notes = readNotes();
          const context = notes.length
            ? "JARVIS SAVED NOTES (device-local):\n" + notes.slice(-12).map((n, i) => `${i + 1}. ${n.text}`).join("\n")
            : "JARVIS SAVED NOTES: no saved notes on this device.";
          body.messages = [...messages.slice(0, -1), { role: "user", content: context }, last];
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
    }
    return previousFetch(inputArg, init);
  };
})();