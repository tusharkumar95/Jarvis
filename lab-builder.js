(() => {
  const STORAGE = "jarvis-lab-projects-v1";
  const MAX_PROJECTS = 12;
  let activeId = null;
  let activeCodeTab = "html";

  function readProjects() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function writeProjects(projects) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
      return true;
    } catch {
      setStatus("This build is too large for on-device storage. The preview still works, but remove an older Lab project before saving more.", "error");
      return false;
    }
  }

  function uid() {
    return `lab-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function mount() {
    const root = document.querySelector("#lab");
    if (!root) return;
    root.innerHTML = `
      <div class="page-head lab-hero">
        <p class="eyebrow">LAB · AI APP BUILDER</p>
        <h2>Describe it. Jarvis builds it.</h2>
        <p class="subtle">Narrate the app you want. Lab writes the code, runs it here, remembers the project and lets you keep changing it with plain English.</p>
      </div>

      <section class="lab-builder-card glass">
        <div class="lab-builder-top"><div><strong>What should I build?</strong><span>Be as simple or specific as you want.</span></div><span class="lab-beta">Builder v1</span></div>
        <textarea id="labPrompt" rows="5" placeholder="Example: Build a playable Tetris game with touch controls, score, levels and a clean dark interface."></textarea>
        <div class="lab-examples">
          <button type="button" data-lab-example="Build a playable Tetris game with touch controls, score, levels, pause and restart.">Tetris</button>
          <button type="button" data-lab-example="Build a clean personal expense tracker that works offline, lets me add categories and shows monthly totals.">Expense tracker</button>
          <button type="button" data-lab-example="Build an independently designed secure-messenger prototype inspired by privacy-first messengers. Include contacts, chats, verification indicators and local demo messages. Clearly label anything that would require a production backend or audited encryption.">Messenger prototype</button>
        </div>
        <button id="labBuild" class="lab-primary" type="button">✦ Build app</button>
        <p id="labStatus" class="lab-status">Uses your existing free AI router. Client-side apps can run immediately; backend-heavy features are prototyped honestly.</p>
      </section>

      <section id="labWorkspace" class="lab-workspace" hidden>
        <div class="lab-workspace-head">
          <div><p class="eyebrow">CURRENT BUILD</p><h3 id="labAppName">New App</h3><p id="labAppDescription" class="subtle"></p></div>
          <button id="labNew" class="secondary-btn" type="button">New app</button>
        </div>

        <div class="lab-tabs glass" role="tablist">
          <button class="active" type="button" data-lab-tab="preview">Preview</button>
          <button type="button" data-lab-tab="code">Code</button>
          <button type="button" data-lab-tab="notes">Notes</button>
        </div>

        <div id="labPreviewPanel" class="lab-panel">
          <div class="lab-device glass"><iframe id="labPreview" title="App preview" sandbox="allow-scripts allow-forms allow-modals allow-downloads"></iframe></div>
          <button id="labOpenPreview" class="secondary-btn lab-open-preview" type="button">Open full preview ↗</button>
        </div>

        <div id="labCodePanel" class="lab-panel" hidden>
          <div class="lab-code-tabs"><button class="active" data-code-tab="html" type="button">HTML</button><button data-code-tab="css" type="button">CSS</button><button data-code-tab="js" type="button">JavaScript</button><button id="labCopyCode" type="button">Copy</button></div>
          <pre id="labCode"><code></code></pre>
        </div>

        <div id="labNotesPanel" class="lab-panel glass" hidden><p id="labNotes"></p></div>

        <div class="lab-revise glass">
          <label for="labRevision">Change this app</label>
          <textarea id="labRevision" rows="3" placeholder="Example: Make the game board larger and add swipe controls."></textarea>
          <button id="labRevise" class="lab-primary" type="button">✦ Update app</button>
        </div>
      </section>

      <div class="projects-head"><h3>Your apps</h3><button id="labClearProjects" class="text-btn" type="button">Clear all</button></div>
      <div id="labProjects" class="projects-list"></div>
    `;

    bind();
    renderProjects();
  }

  function bind() {
    document.querySelectorAll("[data-lab-example]").forEach(button => button.addEventListener("click", () => {
      document.querySelector("#labPrompt").value = button.dataset.labExample || "";
      document.querySelector("#labPrompt").focus();
    }));
    document.querySelector("#labBuild")?.addEventListener("click", () => build(false));
    document.querySelector("#labRevise")?.addEventListener("click", () => build(true));
    document.querySelector("#labNew")?.addEventListener("click", newApp);
    document.querySelector("#labClearProjects")?.addEventListener("click", () => {
      if (!confirm("Clear all Lab projects from this device?")) return;
      writeProjects([]); activeId = null; hideWorkspace(); renderProjects();
    });
    document.querySelector("#labOpenPreview")?.addEventListener("click", openFullPreview);
    document.querySelector("#labCopyCode")?.addEventListener("click", copyActiveCode);
    document.querySelectorAll("[data-lab-tab]").forEach(button => button.addEventListener("click", () => showTab(button.dataset.labTab)));
    document.querySelectorAll("[data-code-tab]").forEach(button => button.addEventListener("click", () => {
      activeCodeTab = button.dataset.codeTab;
      document.querySelectorAll("[data-code-tab]").forEach(b => b.classList.toggle("active", b === button));
      renderCode();
    }));
  }

  async function build(isRevision) {
    const promptEl = isRevision ? document.querySelector("#labRevision") : document.querySelector("#labPrompt");
    const prompt = String(promptEl?.value || "").trim();
    if (!prompt) { setStatus(isRevision ? "Tell Jarvis what you want to change." : "Describe the app you want to build.", "error"); return; }

    const currentProject = activeProject();
    if (isRevision && !currentProject?.app) { setStatus("Open or build an app before revising it.", "error"); return; }

    setBusy(true, isRevision ? "Jarvis is rebuilding the app…" : "Jarvis is designing and coding the app…");
    try {
      const base = String(window.JARVIS_API || "").replace(/\/$/, "");
      if (!base) throw new Error("Jarvis AI router is not configured.");
      const response = await fetch(base + "/build-app", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ prompt, current:isRevision ? currentProject.app : null })
      });
      const data = await response.json();
      if (!response.ok || !data?.app) throw new Error(data?.error || "The app builder could not complete this build.");

      const projects = readProjects();
      let project;
      if (isRevision && currentProject) {
        project = { ...currentProject, app:data.app, description:data.app.description || currentProject.description || "", status:"Built", updatedAt:new Date().toISOString(), revisions:Number(currentProject.revisions || 0) + 1 };
        const index = projects.findIndex(item => item.id === currentProject.id);
        if (index >= 0) projects[index] = project;
      } else {
        project = {
          id:uid(), name:data.app.name || "New App", idea:prompt, description:data.app.description || "", status:"Built",
          app:data.app, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), revisions:0,
          date:new Date().toLocaleDateString(undefined,{month:"short",day:"numeric"})
        };
        projects.unshift(project);
      }
      activeId = project.id;
      writeProjects(projects);
      promptEl.value = "";
      renderProjects();
      openProject(project.id);
      setStatus(`Built with ${data.provider || "Jarvis"}. You can run it now or describe another change.`, "success");
    } catch (error) {
      setStatus(String(error?.message || error), "error");
    } finally { setBusy(false); }
  }

  function activeProject() {
    return readProjects().find(project => project.id === activeId) || null;
  }

  function openProject(id) {
    const project = readProjects().find(item => item.id === id);
    if (!project) return;
    activeId = id;
    if (!project.app) {
      document.querySelector("#labPrompt").value = project.idea || project.description || "";
      document.querySelector("#labPrompt").focus();
      setStatus("This is an older saved idea. Press Build app to turn it into a working preview.", "success");
      hideWorkspace();
      return;
    }
    document.querySelector("#labWorkspace").hidden = false;
    document.querySelector("#labAppName").textContent = project.app.name || project.name || "App";
    document.querySelector("#labAppDescription").textContent = project.app.description || project.description || "";
    document.querySelector("#labNotes").textContent = project.app.notes || "No additional production notes for this build.";
    renderPreview(project.app);
    renderCode();
    showTab("preview");
    document.querySelector("#labWorkspace").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function appDocument(app) {
    const safeJS = String(app?.js || "").replace(/<\/script/gi, "<\\/script");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}${app?.css || ""}</style></head><body>${app?.html || ""}<script>${safeJS}<\/script></body></html>`;
  }

  function renderPreview(app) {
    const frame = document.querySelector("#labPreview");
    if (frame) frame.srcdoc = appDocument(app);
  }

  function renderCode() {
    const project = activeProject();
    const code = document.querySelector("#labCode code");
    if (!project?.app || !code) return;
    code.textContent = String(project.app[activeCodeTab] || "");
  }

  function showTab(tab) {
    document.querySelectorAll("[data-lab-tab]").forEach(button => button.classList.toggle("active", button.dataset.labTab === tab));
    const map = { preview:"#labPreviewPanel", code:"#labCodePanel", notes:"#labNotesPanel" };
    Object.entries(map).forEach(([key, selector]) => { const el = document.querySelector(selector); if (el) el.hidden = key !== tab; });
  }

  function renderProjects() {
    const projects = readProjects();
    const count = document.querySelector("#homeProjectCount");
    if (count) count.textContent = projects.length;
    const box = document.querySelector("#labProjects");
    if (!box) return;
    if (!projects.length) {
      box.innerHTML = '<div class="empty-state">No apps yet. Describe one above — even “build me Tetris” is enough.</div>';
      return;
    }
    box.innerHTML = projects.map(project => `
      <article class="lab-project glass">
        <button class="lab-project-main" type="button" data-open-lab="${escapeHTML(project.id || "")}">
          <div><small>${project.app ? "RUNNABLE APP" : "SAVED IDEA"}${project.revisions ? ` · ${project.revisions} revisions` : ""}</small><h3>${escapeHTML(project.app?.name || project.name || "Project")}</h3><p>${escapeHTML(project.app?.description || project.idea || project.description || "")}</p></div>
          <span>→</span>
        </button>
        <button class="lab-project-delete" type="button" data-delete-lab="${escapeHTML(project.id || "")}" aria-label="Delete project">×</button>
      </article>
    `).join("");
    box.querySelectorAll("[data-open-lab]").forEach(button => button.addEventListener("click", () => openProject(button.dataset.openLab)));
    box.querySelectorAll("[data-delete-lab]").forEach(button => button.addEventListener("click", () => {
      const projects = readProjects().filter(item => item.id !== button.dataset.deleteLab);
      if (activeId === button.dataset.deleteLab) { activeId = null; hideWorkspace(); }
      writeProjects(projects); renderProjects();
    }));
  }

  function newApp() {
    activeId = null;
    hideWorkspace();
    document.querySelector("#labPrompt").value = "";
    document.querySelector("#labPrompt").focus();
    window.scrollTo({top:document.querySelector("#lab").offsetTop,behavior:"smooth"});
  }

  function hideWorkspace() {
    const workspace = document.querySelector("#labWorkspace");
    if (workspace) workspace.hidden = true;
  }

  async function copyActiveCode() {
    const project = activeProject();
    if (!project?.app) return;
    try {
      await navigator.clipboard.writeText(String(project.app[activeCodeTab] || ""));
      setStatus(`${activeCodeTab.toUpperCase()} copied.`, "success");
    } catch { setStatus("Could not copy automatically. Select the code and copy it manually.", "error"); }
  }

  function openFullPreview() {
    const project = activeProject();
    if (!project?.app) return;
    const blob = new Blob([appDocument(project.app)], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener");
    if (!win) setStatus("Safari blocked the preview window. Allow pop-ups for Jarvis and try again.", "error");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function setBusy(busy, message) {
    const build = document.querySelector("#labBuild"), revise = document.querySelector("#labRevise");
    if (build) build.disabled = busy;
    if (revise) revise.disabled = busy;
    if (message) setStatus(message, "busy");
  }

  function setStatus(message, type="") {
    const el = document.querySelector("#labStatus");
    if (!el) return;
    el.textContent = message;
    el.dataset.state = type;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, {once:true});
  else mount();
})();
