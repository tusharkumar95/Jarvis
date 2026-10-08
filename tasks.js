(() => {
  const KEY = "jarvis-tasks-v1";
  const MAX_TASKS = 100;
  const form = document.querySelector("#askForm");
  const chat = document.querySelector("#chat");
  const list = document.querySelector("#taskList");
  const input = document.querySelector("#taskInput");
  const dateInput = document.querySelector("#taskDate");
  const addButton = document.querySelector("#addTaskBtn");
  if (!form || !chat || !list || !input || !addButton || typeof conversation === "undefined") return;

  function readTasks() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value.slice(-MAX_TASKS) : [];
    } catch { return []; }
  }

  function writeTasks(tasks) {
    try { localStorage.setItem(KEY, JSON.stringify(tasks.slice(-MAX_TASKS))); } catch {}
    render();
  }

  function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function inferDue(text) {
    const lower = String(text || "").toLowerCase();
    const now = new Date();
    if (/\btoday\b|\btonight\b/.test(lower)) return isoDate(now);
    if (/\btomorrow\b/.test(lower)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return isoDate(d);
    }
    const explicit = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return explicit ? explicit[1] : "";
  }

  function cleanTaskText(text) {
    return String(text || "")
      .replace(/\b(today|tonight|tomorrow)\b[.!]?/ig, "")
      .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "")
      .replace(/\s+/g, " ")
      .replace(/[.!]+$/, "")
      .trim();
  }

  function addTask(text, due = "") {
    const clean = cleanTaskText(text).slice(0, 240);
    if (!clean) return null;
    const tasks = readTasks();
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text: clean,
      due: due || "",
      done: false,
      created: new Date().toISOString()
    };
    tasks.push(task);
    writeTasks(tasks);
    return task;
  }

  function updateTask(id, patch) {
    writeTasks(readTasks().map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function deleteTask(id) {
    writeTasks(readTasks().filter(t => t.id !== id));
  }

  function openTasks() {
    const button = document.querySelector('[data-go="tasks"]');
    if (button) button.click();
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user" : "jarvis");
    div.textContent = text;
    chat.appendChild(div);
    conversation.push({ role: role === "user" ? "user" : "assistant", content: text });
    chat.scrollTop = chat.scrollHeight;
  }

  function activeTasks() {
    return readTasks().filter(t => !t.done);
  }

  function taskSummary() {
    const tasks = activeTasks();
    if (!tasks.length) return "You have no open tasks on this device.";
    return "Your open tasks:\n" + tasks.map((t, i) => `${i + 1}. ${t.text}${t.due ? ` — due ${t.due}` : ""}`).join("\n");
  }

  function parseCommand(text) {
    let m;
    m = text.match(/^(?:please\s+)?(?:add|create)\s+(?:a\s+)?task(?:\s+to)?\s+(.+)$/i);
    if (m) return { type: "add", text: m[1] };
    m = text.match(/^(?:please\s+)?remind me to\s+(.+)$/i);
    if (m) return { type: "add", text: m[1], reminderWord: true };
    if (/^(?:show|list|what are)\s+(?:my\s+)?(?:tasks|to[- ]?dos)\??$/i.test(text.trim())) return { type: "list" };
    m = text.match(/^(?:mark|complete|finish)\s+task\s+(\d+)\s*(?:done|complete|completed)?$/i);
    if (m) return { type: "done", index: Number(m[1]) - 1 };
    m = text.match(/^(?:delete|remove)\s+task\s+(\d+)$/i);
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
      const due = inferDue(command.text);
      const task = addTask(command.text, due);
      if (!task) return addBubble("assistant", "I couldn't create that task.");
      addBubble("assistant", `Added task: “${task.text}”${task.due ? ` for ${task.due}` : ""}.${command.reminderWord ? " I’ll keep it in Jarvis Tasks; push notifications are not enabled yet." : ""}`);
      return;
    }
    if (command.type === "list") {
      addBubble("assistant", taskSummary());
      return;
    }
    const tasks = activeTasks();
    const task = tasks[command.index];
    if (!task) return addBubble("assistant", "I couldn’t find that open task number.");
    if (command.type === "done") {
      updateTask(task.id, { done: true, completed: new Date().toISOString() });
      addBubble("assistant", `Completed: “${task.text}”`);
    } else if (command.type === "delete") {
      deleteTask(task.id);
      addBubble("assistant", `Deleted task: “${task.text}”`);
    }
  }, true);

  addButton.addEventListener("click", () => {
    const task = addTask(input.value, dateInput?.value || "");
    if (!task) return;
    input.value = "";
    if (dateInput) dateInput.value = "";
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addButton.click();
    }
  });

  function friendlyDue(due) {
    if (!due) return "";
    const today = isoDate(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = isoDate(tomorrowDate);
    if (due === today) return "Today";
    if (due === tomorrow) return "Tomorrow";
    return due;
  }

  function render() {
    const tasks = readTasks();
    const open = tasks.filter(t => !t.done);
    const homeCount = document.querySelector("#homeTaskCount");
    if (homeCount) homeCount.textContent = open.length;
    list.innerHTML = "";

    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No tasks yet. Add one here or tell Ask Jarvis: “Add a task to …”";
      list.appendChild(empty);
      return;
    }

    [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || String(a.due || "9999").localeCompare(String(b.due || "9999"))).forEach(task => {
      const row = document.createElement("div");
      row.className = "jarvis-task glass" + (task.done ? " done" : "");

      const check = document.createElement("button");
      check.type = "button";
      check.className = "jarvis-task-check";
      check.setAttribute("aria-label", task.done ? "Mark task open" : "Mark task done");
      check.textContent = task.done ? "✓" : "○";
      check.addEventListener("click", () => updateTask(task.id, { done: !task.done, completed: !task.done ? new Date().toISOString() : null }));

      const body = document.createElement("div");
      body.className = "jarvis-task-body";
      const text = document.createElement("b");
      text.textContent = task.text;
      body.appendChild(text);
      if (task.due) {
        const due = document.createElement("small");
        due.textContent = friendlyDue(task.due);
        body.appendChild(due);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "jarvis-task-delete";
      remove.setAttribute("aria-label", "Delete task");
      remove.textContent = "×";
      remove.addEventListener("click", () => deleteTask(task.id));

      row.append(check, body, remove);
      list.appendChild(row);
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    .task-entry{display:grid;grid-template-columns:1fr auto;gap:10px;padding:14px;margin-bottom:14px}
    .task-entry-main{display:grid;gap:8px}.task-entry input{width:100%;box-sizing:border-box;border:0;outline:0;background:transparent;font:inherit;color:inherit}
    .task-entry-date{font-size:.9rem;opacity:.8}.task-entry button{align-self:center}
    .jarvis-task-list{display:grid;gap:10px}.jarvis-task{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:14px 16px}
    .jarvis-task-check,.jarvis-task-delete{border:0;background:transparent;color:inherit;font:inherit;font-size:1.25rem;cursor:pointer;padding:4px}
    .jarvis-task-body{display:grid;gap:3px;min-width:0}.jarvis-task-body b{font-weight:650;line-height:1.3}.jarvis-task-body small{opacity:.65}
    .jarvis-task.done .jarvis-task-body{opacity:.5}.jarvis-task.done .jarvis-task-body b{text-decoration:line-through}
    @media(max-width:560px){.task-entry{grid-template-columns:1fr}.task-entry button{width:100%}}
  `;
  document.head.appendChild(style);

  render();

  // Give the AI task context only for task-related questions that were not handled locally.
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
        if (last?.role === "user" && /\b(task|tasks|to[- ]?do|things to do|what do i need to do)\b/i.test(q)) {
          const tasks = activeTasks();
          const context = tasks.length
            ? "JARVIS TASKS (open tasks stored on this device):\n" + tasks.map((t, i) => `${i + 1}. ${t.text}${t.due ? ` — due ${t.due}` : ""}`).join("\n")
            : "JARVIS TASKS: no open tasks on this device.";
          body.messages = [...messages.slice(0, -1), { role: "user", content: context }, last];
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
    }
    return previousFetch(inputArg, init);
  };
})();
