(() => {
  const MEMORY_KEY = "jarvis-personal-memory-v1";
  const MAX_MEMORIES = 24;
  const MAX_LENGTH = 320;
  const form = document.querySelector("#askForm");
  const chat = document.querySelector("#chat");
  if (!form || !chat || typeof conversation === "undefined") return;

  function readMemories() {
    try {
      const value = JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
      if (!Array.isArray(value)) return [];
      return value
        .filter(item => item && String(item.text || "").trim())
        .slice(-MAX_MEMORIES)
        .map(item => ({
          id: String(item.id || ""),
          text: String(item.text || "").trim().slice(0, MAX_LENGTH),
          created: item.created || null
        }));
    } catch {
      return [];
    }
  }

  function writeMemories(items) {
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(items.slice(-MAX_MEMORIES))); } catch {}
    renderMemoryPanel();
  }

  function saveMemory(text) {
    const clean = String(text || "").trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH);
    if (!clean) return { saved: false, text: "" };
    const items = readMemories();
    const duplicate = items.find(item => item.text.toLowerCase() === clean.toLowerCase());
    if (duplicate) return { saved: false, duplicate: true, text: duplicate.text };
    items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), text: clean, created: new Date().toISOString() });
    writeMemories(items);
    return { saved: true, text: clean };
  }

  function removeMemory(id) {
    writeMemories(readMemories().filter(item => item.id !== id));
  }

  function clearMemories() {
    try { localStorage.removeItem(MEMORY_KEY); } catch {}
    renderMemoryPanel();
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user" : "jarvis");
    div.textContent = text;
    chat.appendChild(div);
    conversation.push({ role: role === "user" ? "user" : "assistant", content: text });
    chat.scrollTop = chat.scrollHeight;
  }

  function memorySummary() {
    const items = readMemories();
    if (!items.length) return "I don’t have any long-term memories saved on this device yet.";
    return "Here’s what I remember on this device:\n" + items.map((item, index) => `${index + 1}. ${item.text}`).join("\n");
  }

  function forgetMatching(text) {
    const needle = String(text || "").trim().toLowerCase();
    if (!needle) return null;
    const items = readMemories();
    let index = items.findIndex(item => item.text.toLowerCase() === needle);
    if (index < 0) index = items.findIndex(item => item.text.toLowerCase().includes(needle) || needle.includes(item.text.toLowerCase()));
    if (index < 0) return null;
    const [removed] = items.splice(index, 1);
    writeMemories(items);
    return removed;
  }

  function parseLocalCommand(value) {
    const text = String(value || "").trim();
    let match;

    match = text.match(/^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i);
    if (match && !/^what\b/i.test(match[1])) return { type: "remember", value: match[1].replace(/[.!]+$/, "").trim() };

    if (/^(?:what do you remember(?: about me)?|what have you remembered(?: about me)?|show (?:me )?(?:my )?memories|show (?:me )?what you remember(?: about me)?)\??$/i.test(text)) {
      return { type: "list" };
    }

    if (/^(?:forget|clear|delete)\s+(?:everything|all)(?:\s+(?:you\s+)?remember)?(?:\s+about me)?[.!]?$/i.test(text)) {
      return { type: "clear" };
    }

    match = text.match(/^forget(?:\s+that)?\s+(.+)$/i);
    if (match) return { type: "forget", value: match[1].replace(/[.!]+$/, "").trim() };

    return null;
  }

  form.addEventListener("submit", event => {
    const input = document.querySelector("#askInput");
    const value = input?.value?.trim() || "";
    const command = parseLocalCommand(value);
    if (!command) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (!value) return;

    addBubble("user", value);
    input.value = "";

    if (command.type === "remember") {
      const result = saveMemory(command.value);
      addBubble("assistant", result.duplicate ? `I already have that saved: “${result.text}”` : `Remembered on this device: “${result.text}”`);
      return;
    }

    if (command.type === "list") {
      addBubble("assistant", memorySummary());
      return;
    }

    if (command.type === "clear") {
      const count = readMemories().length;
      clearMemories();
      addBubble("assistant", count ? `Cleared ${count} saved ${count === 1 ? "memory" : "memories"} from this device.` : "There weren’t any long-term memories saved on this device.");
      return;
    }

    if (command.type === "forget") {
      const removed = forgetMatching(command.value);
      addBubble("assistant", removed ? `Forgot on this device: “${removed.text}”` : "I couldn’t find a matching saved memory on this device.");
    }
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .jarvis-memory-panel{margin-top:14px;padding:0;overflow:hidden}
    .jarvis-memory-panel summary{cursor:pointer;list-style:none;padding:16px 18px;font-weight:650;display:flex;justify-content:space-between;gap:12px;align-items:center}
    .jarvis-memory-panel summary::-webkit-details-marker{display:none}
    .jarvis-memory-body{padding:0 18px 16px}
    .jarvis-memory-note{margin:0 0 12px;opacity:.7;font-size:.9rem}
    .jarvis-memory-list{display:grid;gap:8px}
    .jarvis-memory-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid rgba(100,100,100,.12)}
    .jarvis-memory-item span{line-height:1.35}
    .jarvis-memory-remove{border:0;background:transparent;font:inherit;opacity:.65;padding:2px 4px;cursor:pointer}
    .jarvis-memory-actions{display:flex;justify-content:flex-end;margin-top:12px}
  `;
  document.head.appendChild(style);

  const routerCard = document.querySelector(".router-card");
  if (routerCard && !document.querySelector("#jarvisMemoryPanel")) {
    const panel = document.createElement("details");
    panel.id = "jarvisMemoryPanel";
    panel.className = "note glass jarvis-memory-panel";
    panel.innerHTML = `
      <summary><span>Personal memory</span><span id="jarvisMemoryCount">0 saved</span></summary>
      <div class="jarvis-memory-body">
        <p class="jarvis-memory-note">Stored only on this device. Say “Remember that …” to add something useful.</p>
        <div id="jarvisMemoryList" class="jarvis-memory-list"></div>
        <div class="jarvis-memory-actions"><button type="button" class="text-btn" id="clearJarvisMemory">Clear memories</button></div>
      </div>`;
    routerCard.insertAdjacentElement("afterend", panel);
    panel.querySelector("#clearJarvisMemory")?.addEventListener("click", () => {
      const count = readMemories().length;
      if (!count) return;
      clearMemories();
    });
  }

  function renderMemoryPanel() {
    const items = readMemories();
    const count = document.querySelector("#jarvisMemoryCount");
    const list = document.querySelector("#jarvisMemoryList");
    if (count) count.textContent = `${items.length} saved`;
    if (!list) return;
    list.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "subtle";
      empty.textContent = "Nothing saved yet.";
      list.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "jarvis-memory-item";
      const text = document.createElement("span");
      text.textContent = item.text;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "jarvis-memory-remove";
      remove.setAttribute("aria-label", "Forget this memory");
      remove.textContent = "×";
      remove.addEventListener("click", () => removeMemory(item.id));
      row.append(text, remove);
      list.appendChild(row);
    });
  }
  renderMemoryPanel();

  const previousFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();

    if (method === "POST" && /\/chat(?:\?|$)/.test(url) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const last = messages[messages.length - 1];
        const question = String(last?.content || "");
        const memories = readMemories();
        const likelyPersonal = /\b(my|me|i|mine|recommend|suggest|prefer|preference|choose|best for me|should i|plan|routine|food|restaurant|travel|workout|shopping|buy|wear|work|home|project)\b/i.test(question);

        if (last?.role === "user" && memories.length && likelyPersonal) {
          const memoryContext = [
            "JARVIS PERSONAL MEMORY (user-controlled notes saved on this device; use only when relevant and never present them as verified facts beyond what the user saved):",
            ...memories.map((item, index) => `${index + 1}. ${item.text}`)
          ].join("\n");
          body.messages = [
            ...messages.slice(0, -1),
            { role: "user", content: memoryContext },
            last
          ];
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
    }

    return previousFetch(input, init);
  };
})();
