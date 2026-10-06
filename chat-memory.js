(() => {
  const STORAGE_KEY = "jarvis-chat-history-v1";
  const MAX_MESSAGES = 40;
  const chat = document.querySelector("#chat");
  const form = document.querySelector("#askForm");
  if (!chat || !form || typeof conversation === "undefined") return;

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) return [];
      return saved
        .filter(m => (m?.role === "user" || m?.role === "assistant") && String(m?.content || "").trim())
        .slice(-MAX_MESSAGES)
        .map(m => ({ role: m.role, content: String(m.content) }));
    } catch {
      return [];
    }
  }

  function addBubble(message) {
    const div = document.createElement("div");
    div.className = "message " + (message.role === "user" ? "user" : "jarvis");
    div.textContent = message.content;
    chat.appendChild(div);
  }

  const saved = loadHistory();
  let restoring = true;
  if (saved.length) {
    chat.innerHTML = "";
    conversation.length = 0;
    saved.forEach(message => {
      conversation.push({ ...message });
      addBubble(message);
    });
    chat.scrollTop = chat.scrollHeight;
  }
  restoring = false;

  function shouldSkip(text) {
    return !text ||
      text === "Thinking…" ||
      text.startsWith("Jarvis is online.") ||
      text.startsWith("The interface is ready.") ||
      text.startsWith("The secure router code is ready") ||
      text.startsWith("Jarvis could not reach a free model:");
  }

  let saveTimer;
  function saveFromScreen() {
    if (restoring) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const history = [...chat.querySelectorAll(".message")]
        .map(node => ({
          role: node.classList.contains("user") ? "user" : "assistant",
          content: node.textContent.trim()
        }))
        .filter(m => !shouldSkip(m.content))
        .slice(-MAX_MESSAGES);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch {}
    }, 120);
  }

  new MutationObserver(saveFromScreen).observe(chat, {
    childList: true,
    subtree: true,
    characterData: true
  });

  const routerHead = document.querySelector(".router-head");
  if (routerHead && !document.querySelector("#newChatBtn")) {
    const button = document.createElement("button");
    button.id = "newChatBtn";
    button.className = "text-btn";
    button.type = "button";
    button.textContent = "New chat";
    button.title = "Clear this device's saved Jarvis conversation";
    routerHead.appendChild(button);

    button.addEventListener("click", () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      conversation.length = 0;
      chat.innerHTML = '<div class="message jarvis">Jarvis is online. Ask me anything.</div>';
    });
  }
})();
