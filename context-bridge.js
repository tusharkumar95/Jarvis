(() => {
  const nativeFetch = window.fetch.bind(window);
  const LAB_KEY = "jarvis-lab-projects-v1";
  let brieflyStories = [];
  let brieflyMeta = {};

  function normalized(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function syncBrieflySummaries() {
    if (!brieflyStories.length) return;
    const byTitle = new Map(brieflyStories.map(story => [normalized(story?.title), story]));
    document.querySelectorAll("#brieflyList .news-item").forEach(card => {
      const title = card.querySelector("h3");
      const summary = card.querySelector("p[id^='jarvis-news-summary-']");
      if (!title || !summary) return;
      const story = byTitle.get(normalized(title.textContent));
      if (!story?.summary) return;
      summary.textContent = String(story.summary).trim();
      card.querySelector("[data-jarvis-news]")?.remove();
    });
  }

  async function refreshBriefly() {
    try {
      const response = await nativeFetch("../Briefly/data.json?jarvisContext=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      brieflyStories = Array.isArray(data?.stories) ? data.stories.slice(0, 10) : [];
      brieflyMeta = {
        updated: data?.updated || "",
        engine: data?.engine || "",
        editor: data?.editor || ""
      };
      window.JarvisBriefly = {
        updated: brieflyMeta.updated,
        engine: brieflyMeta.engine,
        editor: brieflyMeta.editor,
        stories: brieflyStories.map(story => ({ ...story }))
      };
      document.dispatchEvent(new CustomEvent("jarvis:briefly-data", { detail: window.JarvisBriefly }));
      requestAnimationFrame(syncBrieflySummaries);
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
    const summary = String(story?.summary || "").trim().slice(0, 430);
    const why = String(story?.why || "").trim().slice(0, 220);
    const sourceCount = Math.max(1, Number(story?.sourceCount || story?.sources?.length || 1));
    const score = Number(story?.importanceScore || 0);
    const trust = story?.verified === true ? "verified" : `source-backed/${String(story?.confidence || "unknown")}`;
    const status = String(story?.status || "").trim();
    const parts = [
      `${index + 1}. [${category}] ${title}`,
      `source: ${source}${sourceCount > 1 ? ` (${sourceCount} sources)` : ""}`,
      `trust: ${trust}${score ? `; importance ${score}` : ""}${status ? `; ${status}` : ""}`,
      summary ? `summary: ${summary}` : "",
      why ? `why it matters: ${why}` : ""
    ].filter(Boolean);
    return parts.join(" — ");
  }

  function buildContext(question) {
    const sections = [];
    const q = String(question || "");

    const wantsProjects = /\b(project|projects|lab|app idea|app ideas|saved idea|saved ideas|my ideas|build idea|build ideas)\b/i.test(q);
    const wantsNews = /\b(briefly|news|headline|headlines|latest story|latest stories|news story|news stories|today.?s news|current news|what happened|overnight|what matters today|important today)\b/i.test(q);

    if (wantsProjects) {
      const projects = labProjects();
      sections.push(
        projects.length
          ? `Saved Lab projects on this device:\n${projects.map(projectLine).join("\n")}`
          : "Saved Lab projects on this device: none."
      );
    }

    if (wantsNews) {
      const meta = [
        brieflyMeta.engine ? `engine=${brieflyMeta.engine}` : "",
        brieflyMeta.updated ? `updated=${brieflyMeta.updated}` : "",
        brieflyMeta.editor ? `editor=${brieflyMeta.editor}` : ""
      ].filter(Boolean).join("; ");
      sections.push(
        brieflyStories.length
          ? `Current Briefly intelligence feed${meta ? ` (${meta})` : ""}:\n${brieflyStories.slice(0, 8).map(storyLine).join("\n")}`
          : "Current Briefly feed: unavailable right now."
      );
    }

    if (!sections.length) return "";
    return [
      "JARVIS APP CONTEXT (use only when relevant to the user's question; do not claim this context is broader than shown. Respect each story's verification/trust label and do not upgrade source-backed items to verified facts without independent support):",
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

  document.addEventListener("click", event => {
    if (!event.target.closest?.('[data-go="briefly"]')) return;
    requestAnimationFrame(syncBrieflySummaries);
  });

  refreshBriefly();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBriefly();
  });

  const memoryScript = document.createElement("script");
  memoryScript.src = "personal-memory.js?v=1";
  document.body.appendChild(memoryScript);
})();
