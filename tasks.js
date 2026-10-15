(() => {
  const KEY = "jarvis-tasks-v1";
  const MAX_TASKS = 100;
  const form = document.querySelector("#askForm");
  const chat = document.querySelector("#chat");
  const trigger = document.querySelector('[aria-label="Open Tasks"]');
  if (!form || !chat || !trigger || typeof conversation === "undefined") return;

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

  function activeTasks() {
    return readTasks().filter(t => !t.done);
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user" : "jarvis");
    div.textContent = text;
    chat.appendChild(div);
    conversation.push({ role: role === "user" ? "user" : "assistant", content: text });
    chat.scrollTop = chat.scrollHeight;
  }

  function buildSheet() {
    const sheet = document.createElement("div");
    sheet.id = "jarvisTaskSheet";
    sheet.className = "jarvis-task-sheet";
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="jarvis-task-sheet-inner">
        <div class="jarvis-task-sheet-top">
          <div><p class="eyebrow">TASKS</p><h2>What needs doing</h2></div>
          <button id="closeTaskSheet" type="button" aria-label="Close Tasks">×</button>
        </div>
        <div class="jarvis-task-entry-card glass">
          <input id="taskInput" type="text" autocomplete="off" placeholder="Add a task…" aria-label="Task" />
          <input id="taskDate" type="date" aria-label="Due date" />
          <button id="addTaskBtn" type="button">Add task</button>
        </div>
        <div class="jarvis-task-sheet-meta"><span id="homeTaskCount">0 open</span><span>Stored on this device</span></div>
        <div id="taskList" class="jarvis-task-list"></div>
        <p class="jarvis-task-hint">You can also tell Ask Jarvis: “Add a task to call the dentist tomorrow.”</p>
      </div>`;
    document.body.appendChild(sheet);

    const close = sheet.querySelector("#closeTaskSheet");
    const input = sheet.querySelector("#taskInput");
    const dateInput = sheet.querySelector("#taskDate");
    const addButton = sheet.querySelector("#addTaskBtn");

    close.addEventListener("click", closeSheet);
    sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
    addButton.addEventListener("click", () => {
      const task = addTask(input.value, dateInput.value || "");
      if (!task) return;
      input.value = "";
      dateInput.value = "";
      input.focus();
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addButton.click();
      }
    });
  }

  function openSheet() {
    const sheet = document.querySelector("#jarvisTaskSheet");
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add("task-sheet-open");
    render();
    setTimeout(() => document.querySelector("#taskInput")?.focus(), 50);
  }

  function closeSheet() {
    const sheet = document.querySelector("#jarvisTaskSheet");
    if (!sheet) return;
    sheet.hidden = true;
    document.body.classList.remove("task-sheet-open");
  }

  function render() {
    const tasks = readTasks();
    const open = tasks.filter(t => !t.done);
    const count = document.querySelector("#homeTaskCount");
    if (count) count.textContent = `${open.length} open`;

    const pulseStrong = trigger.querySelector("strong");
    if (pulseStrong) pulseStrong.textContent = open.length ? String(open.length) : "+";
    const pulseText = trigger.querySelector("span");
    if (pulseText) pulseText.textContent = open.length === 1 ? "open task" : open.length ? "open tasks" : "add & manage";

    const list = document.querySelector("#taskList");
    if (!list) return;
    list.innerHTML = "";

    const visible = [...tasks]
      .sort((a, b) => Number(a.done) - Number(b.done) || String(a.due || "9999").localeCompare(String(b.due || "9999")))
      .slice(0, 30);

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No tasks yet.";
      list.appendChild(empty);
      return;
    }

    visible.forEach(task => {
      const row = document.createElement("div");
      row.className = "jarvis-task" + (task.done ? " done" : "");

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

  function taskSummary() {
    const tasks = activeTasks();
    if (!tasks.length) return "You have no open tasks on this device.";
    return "Your open tasks:\n" + tasks.map((t, i) => `${i + 1}. ${t.text}${t.due ? ` — due ${friendlyDue(t.due)}` : ""}`).join("\n");
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
      addBubble("assistant", `Added task: “${task.text}”${task.due ? ` for ${friendlyDue(task.due)}` : ""}.${command.reminderWord ? " I’ll keep it in Jarvis Tasks; push notifications are not enabled yet." : ""}`);
      return;
    }
    if (command.type === "list") return addBubble("assistant", taskSummary());

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

  const style = document.createElement("style");
  style.textContent = `
    body.task-sheet-open{overflow:hidden}
    .jarvis-task-sheet[hidden]{display:none!important}
    .jarvis-task-sheet{position:fixed;inset:0;z-index:100;background:var(--bg);overflow-y:auto;padding:max(18px,env(safe-area-inset-top)) 16px max(28px,env(safe-area-inset-bottom))}
    .jarvis-task-sheet-inner{width:min(680px,100%);margin:0 auto}
    .jarvis-task-sheet-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:6px 2px 18px}.jarvis-task-sheet-top h2{font-size:34px;letter-spacing:-.04em;margin:5px 0 0}.jarvis-task-sheet-top>button{border:1px solid var(--line);background:var(--glass);color:var(--ink);width:42px;height:42px;border-radius:50%;font-size:27px;line-height:1}
    .jarvis-task-entry-card{border-radius:24px;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px}.jarvis-task-entry-card input{min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;padding:10px}.jarvis-task-entry-card input[type=date]{grid-column:1}.jarvis-task-entry-card>button{grid-column:2;grid-row:1 / span 2;border:0;border-radius:18px;padding:0 18px;background:var(--ink);color:var(--bg);font-weight:750}
    .jarvis-task-sheet-meta{display:flex;justify-content:space-between;gap:12px;padding:14px 4px 8px;color:var(--muted);font-size:12px}.jarvis-task-list{display:grid}.jarvis-task{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 4px;border-bottom:1px solid var(--line)}.jarvis-task-check,.jarvis-task-delete{border:0;background:transparent;color:var(--ink);font:inherit;font-size:1.3rem;padding:5px}.jarvis-task-body{display:grid;gap:3px}.jarvis-task-body b{font-weight:650;line-height:1.35}.jarvis-task-body small{color:var(--muted)}.jarvis-task.done .jarvis-task-body{opacity:.45}.jarvis-task.done .jarvis-task-body b{text-decoration:line-through}.jarvis-task-hint{color:var(--muted);font-size:12px;line-height:1.45;margin-top:16px}
    .jarvis-task-sheet .empty-state{margin-top:8px}
    @media(max-width:560px){.jarvis-task-entry-card input{font-size:16px}.jarvis-task-sheet-top h2{font-size:30px}}
  `;
  document.head.appendChild(style);

  buildSheet();
  trigger.addEventListener("click", openSheet);
  trigger.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSheet(); }
  });
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