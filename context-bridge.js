(() => {
  const nativeFetch = window.fetch.bind(window);
  const LAB_KEY = "jarvis-lab-projects-v1";
  let brieflyStories = [];

  async function refreshBriefly() {
    try {
      const response = await nativeFetch("../Briefly/data.json?jarvisContext=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      brieflyStories = Array.isArray(data?.stories) ? data.stories.slice(0, 8) : [];
    } catch {}
  }

  function labProjects() {
    try {
      const value = JSON.parse(localStorage.getItem(LAB_KEY) || "[]");
      return Array.isArray(value) ? value.slice(-8) : [];
    } catch {
      return [];
    }
  }

  function projectLine(project, index) {
    if (typeof project === "string") return `${index + 1}. ${project.slice(0, 300)}`;
    const parts = [project?.name, project?.title, project?.idea, project?.description, project?.status]
      .filter(Boolean)
      .map(value => String(value).trim())
      .filter(Boolean);
    if (parts.length) return `${index + 1}. ${parts.join(" — ").slice(0, 420)}`;
    try { return `${index + 1}. ${JSON.stringify(project).slice(0, 420)}`; }
    catch { return `${index + 1}. Saved Lab project`; }
  }

  function storyLine(story, index) {
    const title = String(story?.title || "Untitled").trim();
    const source = String(story?.source || "Briefly").trim();
    const category = String(story?.cat || story?.category || "News").trim();
    const summary = String(story?.summary || "").trim().slice(0, 280);
    return `${index + 1}. [${category}] ${title} — ${source}${summary ? ` — ${summary}` : ""}`;
  }

  function buildContext(question) {
    const sections = [];
    const q = String(question || "");

    const wantsProjects = /\b(project|projects|lab|app idea|app ideas|saved idea|saved ideas|my ideas|build idea|build ideas)\b/i.test(q);
    const wantsNews = /\b(briefly|news|headline|headlines|latest story|latest stories|news story|news stories|today.?s news|current news)\b/i.test(q);

    if (wantsProjects) {
      const projects = labProjects();
      sections.push(
        projects.length
          ? `Saved Lab projects on this device:\n${projects.map(projectLine).join("\n")}`
          : "Saved Lab projects on this device: none."
      );
    }

    if (wantsNews) {
      sections.push(
        brieflyStories.length
          ? `Current Briefly feed:\n${brieflyStories.slice(0, 6).map(storyLine).join("\n")}`
          : "Current Briefly feed: unavailable right now."
      );
    }

    if (!sections.length) return "";
    return [
      "JARVIS APP CONTEXT (use only when relevant to the user's question; do not claim this context is broader than shown):",
      ...sections
    ].join("\n\n");
  }

  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();

    if (method === "POST" && /\/chat(?:\?|$)/.test(url) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          const context = buildContext(last.content);
          if (context) {
            body.messages = [
              ...messages.slice(0, -1),
              { role: "user", content: context },
              last
            ];
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch {}
    }

    return nativeFetch(input, init);
  };

  refreshBriefly();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBriefly();
  });

  const memoryScript = document.createElement("script");
  memoryScript.src = "personal-memory.js?v=1";
  document.body.appendChild(memoryScript);
})();
